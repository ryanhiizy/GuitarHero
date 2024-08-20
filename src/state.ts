export { initialState, Tick, reduceState, CreateCircle, ClickCircle, Restart, GameEnd, Pause };

import { not } from "./util";
import { Action, State, Circle, Note, ClickKey, Constants } from "./types";

const initialState: State = {
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

class Tick implements Action {
  apply(s: State): State {
    const { circles, combo, multiplier, time, score, highscore } = s;

    const playableCircles = circles.filter(this.isPlayable);
    const backgroundCircles = circles.filter(this.isBackground);

    const expiredCircles = playableCircles.filter(this.isExpired);
    const activeCircles = playableCircles.filter(not(this.isExpired));

    const updatedActiveCircles = activeCircles.map(this.incrementY);
    const updatedBackgroundCircles = backgroundCircles.map(this.incrementDuration);

    const newCombo = expiredCircles.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newHighscore = Math.max(score, highscore);
    const newTime = time + Constants.TICK_RATE_MS;

    return {
      ...s,
      highscore: newHighscore,
      combo: newCombo,
      multiplier: newMultiplier,
      time: newTime,
      circles: [...updatedActiveCircles, ...updatedBackgroundCircles],
      playableCircles: activeCircles,
      backgroundCircles: updatedBackgroundCircles,
      hitCircles: [],
      exit: expiredCircles,
      restart: false,
    };
  }

  isPlayable = (circle: Circle) => circle.userPlayed;

  isBackground = (circle: Circle) =>
    !circle.userPlayed && circle.duration + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS;

  isExpired = (circle: Circle) => circle.y >= Constants.EXPIRED_Y;

  incrementDuration = (circle: Circle): Circle => ({
    ...circle,
    duration: circle.duration + Constants.TICK_RATE_MS,
  });

  incrementY = (circle: Circle): Circle => ({
    ...circle,
    y: circle.y + Constants.TRAVEL_Y_PER_TICK,
  });
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { playableCircles, combo, comboCount, multiplier, score, backgroundCircles, hitCircles } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = playableCircles.filter(this.isClose(column));

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = playableCircles.filter(not(this.isClosestCircle(closestCircle)));
    const updateClosestCircle = this.setHit(closestCircle);

    const newCombo = combo + 1;
    const newComboCount = Math.floor(newCombo / 10) * 10;
    const newMultiplier = this.calculateMultiplier(combo, comboCount, multiplier);
    const formatMultiplier = parseFloat(newMultiplier.toFixed(1));
    const newScore = score + Constants.SCORE_PER_HIT * multiplier;

    return {
      ...s,
      multiplier: formatMultiplier,
      score: newScore,
      combo: newCombo,
      comboCount: newComboCount,
      circles: [...filteredCircles, ...backgroundCircles],
      playableCircles: filteredCircles,
      hitCircles: [...hitCircles, updateClosestCircle],
    };
  }

  setHit = (circle: Circle): Circle => ({
    ...circle,
    isHit: true,
  });

  isClosestCircle = (closest: Circle) => (circle: Circle) => circle === closest;

  isClose = (column: number) => (circle: Circle) =>
    circle.column === column && Math.abs(circle.y - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (circles: ReadonlyArray<Circle>): Circle =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.y - Constants.POINT_Y);
      const distance = Math.abs(circle.y - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });

  calculateMultiplier = (combo: number, comboCount: number, multiplier: number): number => {
    const comboForMultiplier = combo + 1 - comboCount;
    return comboForMultiplier === Constants.COMBO_FOR_MULTIPLIER
      ? multiplier + Constants.MULTIPLIER_INCREMENT
      : multiplier;
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
