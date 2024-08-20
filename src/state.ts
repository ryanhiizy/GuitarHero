export {
  initialState,
  Tick,
  reduceState,
  ClickCircle,
  Restart,
  GameEnd,
  Pause,
};

import { Action, State, ClickKey, Constants, ICircle } from "./types";
import { HitCircle } from "./circle";

const initialState: State = {
  score: 0,
  multiplier: 1,
  highscore: 0,
  combo: 0,
  comboCount: 0,
  time: 0,
  circles: [],
  hitCircles: [],
  backgroundCircles: [],
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
      hitCircles: [],
      backgroundCircles: [],
      exit: [],
    };

    const updatedState = s.circles.reduce(tickState, clearState);
    const { hitCircles, backgroundCircles, exit, time, combo, multiplier } =
      updatedState;

    const newCombo = exit.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    return {
      ...updatedState,
      combo: newCombo,
      multiplier: newMultiplier,
      time: newTime,
      circles: [...hitCircles, ...backgroundCircles],
      clickedCircles: [],
      restart: false,
    };
  }
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    console.log(this.key);

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = s.hitCircles.filter(
      (circle) =>
        circle.column === column &&
        Math.abs(circle.cy - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y,
    );

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = closeCircles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.POINT_Y);
      const distance = Math.abs(circle.cy - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });

    const filteredCircles = s.hitCircles.filter(
      (circle) => circle !== closestCircle,
    );

    const comboForMultiplier = s.combo + 1 - s.comboCount;
    const multiplier =
      comboForMultiplier === Constants.COMBO_FOR_MULTIPLIER
        ? s.multiplier + Constants.MULTIPLIER_INCREMENT
        : s.multiplier;

    return {
      ...s,
      multiplier: parseFloat(multiplier.toFixed(1)),
      score: s.score + Constants.SCORE_PER_HIT * s.multiplier,
      combo: s.combo + 1,
      comboCount: Math.floor(s.combo / 10) * 10,
      circles: [...filteredCircles, ...s.backgroundCircles],
      hitCircles: filteredCircles,
      clickedCircles: [...s.clickedCircles, { ...closestCircle, isHit: true }],
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
