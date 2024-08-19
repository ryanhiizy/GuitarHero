export {
  IState,
  ILine,
  Tick,
  reduceState,
  createCircle,
  CreateCircle,
  ClickCircle,
  Restart,
  GameEnd,
  Pause,
};

import { count } from "rxjs";
import { Action, State, Circle, Note, ClickKey, Constants } from "./types";
import { getColumn, not } from "./util";

///////////////////
// INITIAL SETUP //
///////////////////

const IState: State = {
  score: 0,
  multiplier: 1,
  highscore: 0,
  combo: 0,
  comboCount: 0,
  time: 0,
  circles: [],
  playableCircles: [],
  backgroundCircles: [],
  exit: [],
  hitCircles: [],
  paused: false,
  restart: false,
  gameEnd: false,
} as const;

const ILine: Note = {
  userPlayed: false,
  instrument_name: "",
  velocity: 0,
  pitch: 0,
  start: 0,
  end: 0,
} as const;

const createCircle = (
  id: number,
  userPlayed: boolean,
  column: number,
  note: Note,
  x: number,
  y: number = 0,
): Circle => {
  return {
    id,
    x,
    y,
    userPlayed,
    column,
    duration: 0,
    isHit: false,
    note,
  };
};

class Tick implements Action {
  apply(s: State): State {
    const { circles, combo, multiplier, time } = s;

    const playableCircles = circles.filter((circle) => circle.userPlayed);
    const backgroundCircles = circles.filter(
      (circle) =>
        !circle.userPlayed &&
        circle.duration + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS,
    );

    const tickBackgroundCircles = backgroundCircles.map((circle) => ({
      ...circle,
      duration: circle.duration + Constants.TICK_RATE_MS,
    }));

    const expired = (circle: Circle) => circle.y >= Constants.EXPIRED_Y;
    const expiredCircles = playableCircles.filter(expired);
    const activeCircles = playableCircles.filter(not(expired));

    const moveActiveCircles = activeCircles.map(this.moveCircle);

    const newCombo = expiredCircles.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;

    return {
      ...s,
      highscore: Math.max(s.score, s.highscore),
      combo: newCombo,
      multiplier: newMultiplier,
      time: time + Constants.TICK_RATE_MS,
      circles: [...moveActiveCircles, ...tickBackgroundCircles],
      playableCircles: activeCircles,
      backgroundCircles: tickBackgroundCircles,
      hitCircles: [],
      exit: expiredCircles,
      restart: false,
    };
  }

  moveCircle = (circle: Circle): Circle => {
    return {
      ...circle,
      y: circle.y + Constants.TRAVEL_Y_PER_TICK,
    };
  };
}

class CreateCircle implements Action {
  constructor(public readonly circle: Circle) {}

  apply(s: State): State {
    return {
      ...s,
      circles: [...s.circles, this.circle],
    };
  }
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = s.playableCircles.filter((circle) => {
      return (
        circle.column === column &&
        Math.abs(circle.y - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y
      );
    });

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = closeCircles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.y - Constants.POINT_Y);
      const distance = Math.abs(circle.y - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });

    const filteredCircles = s.playableCircles.filter(
      (circle) => circle !== closestCircle,
    );

    // combo/multiplier calculation
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
      playableCircles: filteredCircles,
      hitCircles: [...s.hitCircles, { ...closestCircle, isHit: true }],
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

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
