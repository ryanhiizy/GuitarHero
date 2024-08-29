export { initialState, Tick, reduceState, ClickCircle, GameEnd, Pause, ReleaseCircle, GameSpeed };

import * as Tone from "tone";
import { PlayableCircle, Tail } from "./circle";
import { Action, State, ClickKey, Constants, ICircle, ITail, PlayableCircles, GameSpeedType } from "./types";
import { calculateMultiplier, generateRandomNote, not } from "./util";

const initialState: State = {
  score: 0,
  multiplier: 1,
  combo: 0,
  time: 0,
  delay: 0,

  tails: [],
  circles: [],
  playableCircles: [],
  bgCircles: [],
  random: [],

  clickedCircles: [],

  exit: [],
  exitTails: [],

  starPhase: false,
  starDuration: 0,

  paused: false,
  gameEnd: false,
} as const;

class Tick implements Action {
  apply(s: State): State {
    const clearState = {
      ...s,
      tails: [],
      playableCircles: [],
      bgCircles: [],
      exit: [],
      exitTails: [],
    };

    const updateCircleState = s.circles.reduce(tickCircle, clearState);
    const updateTailState = s.tails.reduce(tickTail, updateCircleState);
    const { playableCircles, bgCircles, exit, time, combo, multiplier, starDuration, starPhase, delay } =
      updateTailState;

    const updateStarDuration = starPhase ? starDuration + Constants.TICK_RATE_MS : 0;
    const updateStarPhase = starPhase && updateStarDuration < Constants.STAR_DURATION;

    const nonClickedExit = exit.filter((circle) => !circle.isClicked);

    const newCombo = nonClickedExit.length === 0 ? combo : 0;
    const multiplierMin = updateStarPhase ? Constants.STAR_MULTIPLIER + 1 : 1;
    const newMultiplier = newCombo === 0 ? multiplierMin : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    // console.log(performance.now(), updateTailState);

    return {
      ...updateTailState,
      combo: newCombo,
      multiplier:
        updateStarDuration === Constants.STAR_DURATION
          ? parseFloat((newMultiplier - Constants.STAR_MULTIPLIER).toFixed(2))
          : newMultiplier,
      time: newTime,
      circles: [...playableCircles, ...bgCircles],
      clickedCircles: [],
      random: [],
      starPhase: updateStarPhase,
      starDuration: starPhase ? updateStarDuration : 0,
      delay: updateStarDuration === Constants.STAR_DURATION ? delay - Constants.STAR_DELAY : delay,
    };
  }
}

class ClickCircle implements Action {
  constructor(
    public readonly key: ClickKey,
    public readonly seed: number,
    public readonly samples: { [key: string]: Tone.Sampler },
  ) {}

  apply(s: State): State {
    const { bgCircles, playableCircles, clickedCircles, tails, random, circles } = s;

    // console.log(s.circles);

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = playableCircles.filter(this.isCloseTail(column));

    if (closeCircles.length === 0) return { ...s, random: [...random, generateRandomNote(this.seed, this.samples)] };

    const closestCircle = this.findClosestCircle(closeCircles);
    // When a HitCircle is added, it's only added to the circles array. It will be added
    // to the playableCircles array in the next tick. This is a problem when you add HitCircles
    // and ClickCircles between ticks because this filterCircles line which is used to
    // reconstruct the circles array, will not have the HitCircles that were just added in between ticks.
    const filterCircles = circles.filter(not(this.isClosestCircle(closestCircle)));
    const filterPlayableCircles = playableCircles.filter(not(this.isClosestCircle(closestCircle)));
    const clickClosestCircle = closestCircle.setClicked(true);

    const updateTails = tails.map(this.updateTail(clickClosestCircle));

    const updateClosestCircle = this.isMisaligned(clickClosestCircle)
      ? clickClosestCircle.setRandomDuration()
      : clickClosestCircle;

    const updateScoreState = clickClosestCircle.onClick(s);

    return {
      ...updateScoreState,
      tails: updateTails,
      circles: [...filterCircles, updateClosestCircle],
      playableCircles: filterPlayableCircles,
      clickedCircles: [...clickedCircles, updateClosestCircle],
    };
  }

  isCloseTail = (column: number) => (circle: PlayableCircles) =>
    circle.column === column && Math.abs(circle.cy - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (circles: ReadonlyArray<PlayableCircles>): PlayableCircles =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.POINT_Y);
      const distance = Math.abs(circle.cy - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });

  isMisaligned = (circle: PlayableCircles) => Math.abs(circle.cy - Constants.POINT_Y) > Constants.CLICK_RANGE_Y / 2;

  isClosestCircle = (closest: ICircle) => (circle: ICircle) => circle === closest;

  updateTail =
    (closestCircle: PlayableCircles) =>
    (tail: ITail): ITail =>
      tail.circle.id === closestCircle.id ? new Tail(tail.id, tail.x, tail.y1, tail.y2, closestCircle) : tail;
}

class ReleaseCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { tails, combo, multiplier, exitTails, score } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = tails.filter(this.isCloseTail(column));

    if (closeTails.length === 0) return s;

    const closestTail = this.findClosestTail(closeTails);
    const unclickedClosestTail = closestTail.setUnclicked();
    const filteredTails = tails.filter(not(this.isClosestTail(closestTail)));

    if (!this.isWithinRange(closestTail)) {
      return {
        ...s,
        combo: 0,
        multiplier: 1,
        tails: [...filteredTails, unclickedClosestTail],
      };
    }

    const newCombo = combo + 1;
    const newMultiplier = calculateMultiplier(newCombo, multiplier);
    const newScore = score + Constants.SCORE_PER_HIT * newMultiplier;

    return {
      ...s,
      score: newScore,
      multiplier: newMultiplier,
      combo: newCombo,
      tails: filteredTails,
      exitTails: [...exitTails, unclickedClosestTail],
    };
  }

  getRange = (tail: ITail) => Math.abs(tail.y1 - Constants.POINT_Y);

  isCloseTail = (column: number) => (tail: ITail) => tail.isClicked() && tail.circle.column === column;

  findClosestTail = (tails: ReadonlyArray<ITail>): ITail =>
    tails.reduce((closest, tail) => {
      const closestDistance = this.getRange(closest);
      const distance = this.getRange(tail);
      return distance < closestDistance ? tail : closest;
    });

  isClosestTail = (closest: ITail) => (tail: ITail) => tail === closest;

  isWithinRange = (tail: ITail) => this.getRange(tail) <= Constants.CLICK_RANGE_Y;
}

class GameSpeed implements Action {
  constructor(public readonly delay: number) {}

  apply(s: State): State {
    return {
      ...s,
      delay: this.delay,
    };
  }
}

class Pause implements Action {
  constructor(public readonly isPaused: boolean) {}

  apply(s: State): State {
    return {
      ...s,
      tails: s.tails.map((tail) => tail.setUnclicked()),
      paused: this.isPaused,
    };
  }
}

class GameEnd implements Action {
  apply(s: State): State {
    return {
      ...s,
      gameEnd: true,
    };
  }
}

const tickTail = (s: State, tail: ITail): State => {
  return tail.tick(s);
};

const tickCircle = (s: State, circle: ICircle): State => {
  return circle.tick(s);
};

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
