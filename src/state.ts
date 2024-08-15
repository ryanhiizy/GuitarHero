export {
  initialState,
  Tick,
  reduceState,
  Placeholder,
  CreateCircle,
  createCircle,
  ClickCircle,
  Restart,
  GameEnd,
};

import { Action, State, Circle, csvLine, ClickKey, Constants } from "./types";
import { not } from "./util";

///////////////////
// INITIAL SETUP //
///////////////////

const initialState: State = {
  score: 0,
  time: 0,
  circles: [],
  playableCircles: [],
  backgroundCircles: [],
  exit: [],
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
  constructor(public readonly elapsed: number) {}

  apply(s: State): State {
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

    return {
      ...s,
      time: this.elapsed,
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

    return {
      ...s,
      score: s.score + 1,
      circles: filteredCircles.concat(s.backgroundCircles),
      playableCircles: filteredCircles,
      hitCircle: closestCircle,
    };
  }
}

class Restart implements Action {
  apply(s: State): State {
    return {
      ...initialState,
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
