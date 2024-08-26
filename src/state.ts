export { initialState, Tick, reduceState, ClickCircle, Restart, GameEnd, Pause, ReleaseCircle };

import { Tail } from "./circle";
import { Action, State, ClickKey, Constants, ICircle, IHitCircle, ITail } from "./types";
import { calculateMultiplier, not } from "./util";

const initialState: State = {
  score: 0,
  multiplier: 1,
  highscore: 0,
  combo: 0,
  time: 0,

  tails: [],
  circles: [],
  playableCircles: [],
  bgCircles: [],

  clickedCircles: [],

  exit: [],
  exitTails: [],

  paused: false,
  restart: false,
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
    const { playableCircles, bgCircles, exit, time, combo, multiplier } = updateTailState;

    const newCombo = exit.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    return {
      ...updateTailState,
      combo: newCombo,
      multiplier: newMultiplier,
      time: newTime,
      circles: [...playableCircles, ...bgCircles],
      clickedCircles: [],
      restart: false,
    };
  }
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { combo, multiplier, bgCircles, playableCircles, clickedCircles, tails, score } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = playableCircles.filter(this.isCloseTail(column));

    if (closeCircles.length === 0) return s;

    const closestCircle = this.findClosestCircle(closeCircles);
    const filterCircles = playableCircles.filter(not(this.isClosestCircle(closestCircle)));
    const clickClosestCircle = closestCircle.setClicked(true);

    const updateTails = tails.map(this.updateTail(clickClosestCircle));

    const duration = (clickClosestCircle.note.end - clickClosestCircle.note.start) * Constants.S_TO_MS;
    const newCombo = duration >= Constants.MIN_HOLD_DURATION ? combo : combo + 1;
    const newMultipler = calculateMultiplier(newCombo, multiplier);
    const newScore = duration >= Constants.MIN_HOLD_DURATION ? score : score + Constants.SCORE_PER_HIT * newMultipler;

    return {
      ...s,
      score: newScore,
      multiplier: newMultipler,
      combo: newCombo,
      tails: updateTails,
      circles: [...filterCircles, ...bgCircles],
      playableCircles: filterCircles,
      clickedCircles: [...clickedCircles, clickClosestCircle],
    };
  }
  isCloseTail = (column: number) => (circle: IHitCircle) =>
    circle.column === column && Math.abs(circle.cy - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (circles: ReadonlyArray<IHitCircle>): IHitCircle =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.POINT_Y);
      const distance = Math.abs(circle.cy - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });

  isClosestCircle = (closest: IHitCircle) => (circle: IHitCircle) => circle === closest;

  updateTail =
    (closestCircle: IHitCircle) =>
    (tail: ITail): ITail =>
      tail.circle.id === closestCircle.id
        ? new Tail(tail.id, tail.x, tail.y1, tail.y2, closestCircle.setClicked(true))
        : tail;
}

class ReleaseCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { tails, combo, multiplier, exitTails, score } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = tails.filter(this.isCloseTail(column));

    if (closeTails.length === 0) return s;

    const closestTail = this.findClosestTail(closeTails);
    const filteredTails = tails.filter(not(this.isClosestTail(closestTail)));
    const unclickedClosestTail = closestTail.setUnclicked();

    if (!closestTail.circle.isClicked || !this.isWithinRange(closestTail)) {
      const releasedEarlyTail = closestTail.setReleasedEarly();

      return {
        ...s,
        combo: 0,
        multiplier: 1,
        tails: [...filteredTails, releasedEarlyTail],
      };
    }

    const newCombo = combo + 1;
    const newMultipler = calculateMultiplier(newCombo, multiplier);
    const newScore = score + Constants.SCORE_PER_HIT * newMultipler;

    return {
      ...s,
      score: newScore,
      multiplier: newMultipler,
      combo: newCombo,
      tails: filteredTails,
      exitTails: [...exitTails, unclickedClosestTail],
    };
  }

  getRange = (tail: ITail) => Math.abs(tail.y1 - Constants.POINT_Y);

  isCloseTail = (column: number) => (tail: ITail) => tail.circle.column === column && tail.y2 === Constants.POINT_Y;

  findClosestTail = (tails: ReadonlyArray<ITail>): ITail =>
    tails.reduce((closest, tail) => {
      const closestDistance = this.getRange(closest);
      const distance = this.getRange(tail);
      return distance < closestDistance ? tail : closest;
    });

  isClosestTail = (closest: ITail) => (tail: ITail) => tail === closest;

  isWithinRange = (tail: ITail) => this.getRange(tail) <= Constants.CLICK_RANGE_Y;
}

class Pause implements Action {
  constructor(public readonly isPaused: boolean) {}

  apply(s: State): State {
    return {
      ...s,
      paused: this.isPaused,
    };
  }
}

class Restart implements Action {
  apply(s: State): State {
    return {
      ...s,
      restart: true,
      gameEnd: false,
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
