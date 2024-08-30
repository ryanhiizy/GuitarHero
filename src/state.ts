export { Tick, Pause, GameEnd, GameSpeed, ClickCircle, reduceState, initialState, ReleaseCircle };

import * as Tone from "tone";
import { Tail } from "./circle";
import { calculateMultiplier, generateRandomNote, not } from "./util";
import { Star, ITail, State, Action, ICircle, ClickKey, Constants, PlayableCircles } from "./types";

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
    const resetState = {
      ...s,
      tails: [],
      playableCircles: [],
      bgCircles: [],
      exit: [],
      exitTails: [],
    };

    const updatedStateAfterCircles = s.circles.reduce(tickCircle, resetState);
    const updatedStateAfterTails = s.tails.reduce(tickTail, updatedStateAfterCircles);

    const updatedStarDuration = s.starPhase ? s.starDuration + Constants.TICK_INTERVAL : 0;
    const isStarPhaseActive = s.starPhase && updatedStarDuration < Star.MAX_DURATION;

    const unclickedExit = s.exit.filter((circle) => !circle.isClicked);
    const updatedCombo = unclickedExit.length === 0 ? s.combo : 0;

    const baseMultiplier = isStarPhaseActive ? Star.MULTIPLIER + 1 : 1;
    const newMultiplier = updatedCombo === 0 ? baseMultiplier : s.multiplier;
    const updatedMultiplier =
      updatedStarDuration === Star.MAX_DURATION
        ? parseFloat((newMultiplier - Star.MULTIPLIER).toFixed(2))
        : newMultiplier;

    const incrementedTime = s.time + Constants.TICK_INTERVAL;
    const updatedDelay = updatedStarDuration === Star.MAX_DURATION ? s.delay - Star.DELAY : s.delay;

    return {
      ...updatedStateAfterTails,
      combo: updatedCombo,
      multiplier: updatedMultiplier,
      time: incrementedTime,
      circles: [...s.playableCircles, ...s.bgCircles],
      clickedCircles: [],
      random: [],
      starPhase: isStarPhaseActive,
      starDuration: s.starPhase ? updatedStarDuration : 0,
      delay: updatedDelay,
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
    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = s.playableCircles.filter(this.isWithinClickRange(column));

    if (closeCircles.length === 0) return this.handleMissedClick(s);

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = s.circles.filter(not(this.isClosestCircle(closestCircle)));
    const filteredPlayableCircles = s.playableCircles.filter(not(this.isClosestCircle(closestCircle)));
    const clickedClosestCircle = closestCircle.setClicked(true);

    const updatedTails = s.tails.map(this.updateTail(clickedClosestCircle));

    const updateClosestCircle = this.isMisaligned(clickedClosestCircle)
      ? clickedClosestCircle.setRandomDuration()
      : clickedClosestCircle;

    const updateScoreState = clickedClosestCircle.onClick(s);

    return {
      ...updateScoreState,
      tails: updatedTails,
      circles: [...filteredCircles, updateClosestCircle],
      playableCircles: filteredPlayableCircles,
      clickedCircles: [...s.clickedCircles, updateClosestCircle],
    };
  }

  isWithinClickRange = (column: number) => (circle: PlayableCircles) =>
    circle.column === column && Math.abs(circle.cy - Constants.TARGET_Y) <= Constants.CLICK_RANGE_Y;

  handleMissedClick = (s: State): State => ({
    ...s,
    random: [...s.random, generateRandomNote(this.seed, this.samples)],
  });

  findClosestCircle = (circles: ReadonlyArray<PlayableCircles>): PlayableCircles =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.TARGET_Y);
      const distance = Math.abs(circle.cy - Constants.TARGET_Y);
      return distance < closestDistance ? circle : closest;
    });

  isClosestCircle = (closest: ICircle) => (circle: ICircle) => circle === closest;

  isMisaligned = (circle: PlayableCircles) => Math.abs(circle.cy - Constants.TARGET_Y) > Constants.CLICK_RANGE_Y / 2;

  updateTail =
    (closestCircle: PlayableCircles) =>
    (tail: ITail): ITail =>
      tail.circle.id === closestCircle.id ? new Tail(tail.id, tail.x, tail.y1, tail.y2, closestCircle) : tail;
}

class ReleaseCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = s.tails.filter(this.isCloseTail(column));

    if (closeTails.length === 0) return s;

    const closestTail = this.findClosestTail(closeTails);
    const unclickedClosestTail = closestTail.setClicked(false);
    const filteredTails = s.tails.filter(not(this.isClosestTail(closestTail)));

    if (!this.isWithinRange(closestTail)) {
      return {
        ...s,
        combo: 0,
        multiplier: 1,
        tails: [...filteredTails, unclickedClosestTail],
      };
    }

    const updatedStateWithScore = unclickedClosestTail.circle.updateStateWithScore(s);

    return {
      ...updatedStateWithScore,
      tails: filteredTails,
      exitTails: [...s.exitTails, unclickedClosestTail],
    };
  }

  getRange = (tail: ITail) => Math.abs(tail.y1 - Constants.TARGET_Y);

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
      tails: s.tails.map((tail) => tail.setClicked(false)),
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
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
