export {
  initialState,
  Tick,
  reduceState,
  Placeholder,
  CreateCircle,
  createCircle,
  ClickCircle,
  UpdateNote,
};

import { Action, State, Circle, csvLine, Key, Constants } from "./types";
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
    const expired = (circle: Circle) => {
      return circle.y >= 400;
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

class ClickCircle implements Action {
  constructor(public readonly key: Key) {}

  apply(s: State): State {
    console.log(this.key);

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const columnCircles = s.circles.filter(
      (circle) => circle.column === column,
    );
    const closeCircles = columnCircles.filter(
      (circle) => Math.abs(circle.y - 350) <= 20,
    );

    if (closeCircles.length === 0) {
      return s;
    }

    const closeValues = closeCircles.map((circle) => ({
      value: Math.abs(circle.y - 350),
      circle,
    }));

    const closestCircle = closeValues.reduce(
      (acc, circle) => (circle.value < acc.value ? circle : acc),
      closeValues[0],
    );

    return {
      ...s,
      score: s.score + 1,
      circles: s.circles.filter((circle) => circle !== closestCircle.circle),
      hitCircle: closestCircle.circle,
    };
  }
}

class UpdateNote implements Action {
  constructor(public readonly note: csvLine) {}

  apply(s: State): State {
    return {
      ...s,
      note: this.note,
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
