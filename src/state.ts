export {
  initialState,
  Tick,
  reduceState,
  Placeholder,
  CreateCircle,
  createCircle,
};

import { Action, State, Circle, csvLine } from "./types";
import { not } from "./util";

///////////////////
// INITIAL SETUP //
///////////////////

const initialState: State = {
  score: 0,
  time: 0,
  circles: [],
  exit: [],
  gameEnd: false,
} as const;

const createCircle =
  (id: number) =>
  (column: number) =>
  (start: number) =>
  (note: csvLine) =>
  (x: number) =>
  (y: number): Circle => {
    return {
      id,
      x,
      y,
      column,
      start,
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
    const expired = (circle: Circle) => {
      return circle.y >= 350;
    };
    const expiredCircles = s.circles.filter(expired);
    const activeCircles = s.circles.filter(not(expired));

    return {
      ...s,
      time: this.elapsed,
      circles: activeCircles.map(Tick.moveCircle),
      exit: expiredCircles,
    };
  }

  static moveCircle = (circle: Circle): Circle => {
    return {
      ...circle,
      y: circle.y + 3.5,
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

// class ClickCircle implements Action {}

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
