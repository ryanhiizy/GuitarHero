export {
  IState,
  Tick,
  reduceState,
  Placeholder,
  createCircle,
  CreateCircle,
  ClickCircle,
  Restart,
  GameEnd,
  Pause,
  Resume,
};

import { count } from "rxjs";
import { Action, State, Circle, csvLine, ClickKey, Constants } from "./types";
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
  paused: false,
  restart: false,
  gameEnd: false,
} as const;

const createCircle =
  (id: number) =>
  (userPlayed: boolean) =>
  (column: number) =>
  (note: csvLine) =>
  (x: number) =>
  (y: number): Circle => {
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

class Placeholder implements Action {
  apply(s: State): State {
    return s;
  }
}

class Tick implements Action {
  apply(s: State): State {
    // i think i can just tick the bg
    const tickCircles = s.circles.map((circle) => ({
      ...circle,
      duration: circle.duration + Constants.TICK_RATE_MS,
    }));

    const playableCircles = tickCircles.filter((circle) => circle.userPlayed);
    const backgroundCircles = tickCircles.filter(
      (circle) => !circle.userPlayed && circle.duration <= Constants.TRAVEL_MS,
    );

    const expired = (circle: Circle) => circle.y >= Constants.EXPIRED_Y;
    const expiredCircles = playableCircles.filter(expired);
    const activeCircles = playableCircles.filter(not(expired));
    const moveActiveCircles = activeCircles.map(Tick.moveCircle);

    const combo = expiredCircles.length === 0 ? s.combo : 0;
    const multiplier = combo === 0 ? 1 : s.multiplier;

    return {
      ...s,
      combo: combo,
      multiplier: multiplier,
      time: s.time + Constants.TICK_RATE_MS,
      circles: moveActiveCircles.concat(backgroundCircles),
      playableCircles: activeCircles,
      backgroundCircles: backgroundCircles,
      exit: expiredCircles,
      restart: false,
    };
  }

  static moveCircle = (circle: Circle): Circle => {
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
    const columnCircles = s.playableCircles.filter(
      (circle) => circle.column === column,
    );
    const closeCircles = columnCircles.filter(
      (circle) =>
        Math.abs(circle.y - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y,
    );

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
      circles: filteredCircles.concat(s.backgroundCircles),
      playableCircles: filteredCircles,
      hitCircle: { ...closestCircle, isHit: true },
    };
  }
}

class Pause implements Action {
  apply(s: State): State {
    return {
      ...s,
      paused: true,
    };
  }
}

class Resume implements Action {
  apply(s: State): State {
    return {
      ...s,
      paused: false,
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
