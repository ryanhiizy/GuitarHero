export { initialState, Tick, reduceState, ClickCircle, Restart, GameEnd, Pause };

import { Action, State, ClickKey, Constants, ICircle, PlayableCircleType } from "./types";
import { calculateMultiplier, calculateScore, not } from "./util";

const initialState: State = {
  score: 0,
  multiplier: 1,
  highscore: 0,
  combo: 0,
  time: 0,
  circles: [],
  playableCircles: [],
  bgCircles: [],
  clickedCircles: [],
  exit: [],
  paused: false,
  restart: false,
  gameEnd: false,
} as const;

class Tick implements Action {
  apply(s: State): State {
    const clearState = {
      ...s,
      playableCircles: [],
      bgCircles: [],
      exit: [],
    };

    const updateState = s.circles.reduce(tickState, clearState);
    const { playableCircles, bgCircles, exit, time, combo, multiplier } = updateState;

    const newCombo = exit.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    return {
      ...updateState,
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
    const { combo, multiplier, bgCircles, playableCircles, clickedCircles } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = playableCircles.filter(this.isClose(column));

    if (closeCircles.length === 0) return s;

    const closestCircle = this.findClosestCircle(closeCircles);
    const filterCircles = playableCircles.filter((circle) => circle.id !== closestCircle.id);
    const clickClosestCircle = closestCircle.setClicked(true);

    const newCombo = clickClosestCircle.incrementComboOnClick() ? combo : combo + 1;
    const newMultipler = calculateMultiplier(newCombo, multiplier);
    const newScore = calculateScore(newCombo, newMultipler);

    return {
      ...s,
      score: newScore,
      multiplier: newMultipler,
      combo: newCombo,
      circles: [...filterCircles, ...bgCircles],
      playableCircles: filterCircles,
      clickedCircles: [...clickedCircles, clickClosestCircle],
    };
  }
  isClose = (column: number) => (circle: PlayableCircleType) =>
    circle.column === column && Math.abs(circle.cy - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (circles: ReadonlyArray<PlayableCircleType>): PlayableCircleType =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.POINT_Y);
      const distance = Math.abs(circle.cy - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });
}

class ReleaseCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { tails, combo, multiplier, score, exitTails } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = tails.filter(this.isClose(column));

    if (closeTails.length === 0) return s;

    const closestTail = this.findClosestTail(closeTails);
    const filteredTails = tails.filter(not(this.isClosestTail(closestTail)));
    const unclickedClosestTail = this.setUnclicked(closestTail);

    if (!closestTail.circle.isClicked || !this.isWithinRange(closestTail)) {
      const releasedEarlyTail = { ...unclickedClosestTail, isReleasedEarly: true };

      return {
        ...s,
        combo: 0,
        multiplier: 1,
        tails: [...filteredTails, releasedEarlyTail],
      };
    }

    const newCombo = combo + 1;
    const newMultipler = calculateMultiplier(newCombo, multiplier);
    const newScore = calculateScore(newCombo, newMultipler);

    console.log(unclickedClosestTail);

    return {
      ...s,
      score: newScore,
      multiplier: newMultipler,
      combo: newCombo,
      tails: filteredTails,
      exitTails: [...exitTails, unclickedClosestTail],
    };
  }
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

const tickState = (s: State, circle: ICircle): State => {
  return circle.tick(s);
};

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
