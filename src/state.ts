export { initialState, Tick, reduceState, CreateCircle, ClickCircle, Restart, GameEnd, Pause, KeyUp };

import { createTail, not } from "./util";
import { Action, State, Circle, Note, ClickKey, Constants, Tail } from "./types";

const initialState: State = {
  score: 0,
  multiplier: 1,
  highscore: 0,
  combo: 0,
  comboCount: 0,
  time: 0,

  tails: [],
  circles: [],
  hitCircles: [],
  holdCircles: [],
  bgCircles: [],

  clickedHitCircles: [],
  clickedHoldCircles: [],

  exit: [],
  exitTails: [],

  paused: false,
  restart: false,
  gameEnd: false,
} as const;

class Tick implements Action {
  apply(s: State): State {
    const { circles, clickedHoldCircles, tails, combo, multiplier, time } = s;

    console.log(s);

    const hitCircles = circles.filter(this.isHit);
    const holdCircles = circles.filter(this.isHold);
    const bgCircles = circles.filter(this.isBackground);

    const expiredHitCircles = hitCircles.filter(this.isHitExpired);
    const activeHitCircles = hitCircles.filter(not(this.isHitExpired));
    const updatedHitCircles = activeHitCircles.map(this.incrementHitY);

    const expiredHoldCircles = holdCircles.filter(this.isHoldExpired);
    const activeHoldCircles = holdCircles.filter(not(this.isHoldExpired));
    const movedHoldCircles = activeHoldCircles.map(this.incrementHoldY);
    const updatedHoldCircles = movedHoldCircles.map(this.incrementHoldTime);

    const expiredTails = tails.filter(this.isTailExpired);
    const activeTails = tails.filter(not(this.isTailExpired));
    const movedTails = activeTails.map(this.incrementTailY);
    const updatedTails = movedTails.map(this.updateTail(updatedHoldCircles));

    const updatedBgCircles = bgCircles.map(this.incrementBgTime);

    const updatedClickedHoldCircles = clickedHoldCircles.map(this.incrementHoldTime);
    const filteredClickedHoldCircles = updatedClickedHoldCircles.filter(not(this.isClickedHoldExpired));
    const movedClickedHoldCircles = filteredClickedHoldCircles.map(this.incrementHoldY);

    const newCircles = [...updatedHitCircles, ...updatedHoldCircles, ...updatedBgCircles];
    const expiredCircles = [...expiredHitCircles, ...expiredHoldCircles];

    const newCombo = expiredCircles.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    return {
      ...s,
      combo: newCombo,
      multiplier: newMultiplier,
      time: newTime,
      circles: newCircles,
      hitCircles: updatedHitCircles,
      holdCircles: updatedHoldCircles,
      bgCircles: updatedBgCircles,
      clickedHitCircles: [],
      clickedHoldCircles: movedClickedHoldCircles,
      tails: updatedTails,
      exit: expiredCircles,
      exitTails: expiredTails,
      restart: false,
    };
  }

  updateTail =
    (holdCircles: ReadonlyArray<Circle>) =>
    (tail: Tail): Tail => {
      const matchingCircle = holdCircles
        .filter((circle) => circle.y === Constants.POINT_Y && circle.time > 0)
        .find((circle) => tail.id === `${circle.id}t`);
      return matchingCircle ? this.setMissed(tail) : tail;
    };

  setMissed = (tail: Tail): Tail => ({
    ...tail,
    isMissed: true,
  });

  isHit = (circle: Circle) => circle.userPlayed && !circle.isHoldCircle;

  isHold = (circle: Circle) => circle.isHoldCircle;

  isBackground = (circle: Circle) => !circle.userPlayed && circle.time + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS;

  isHitExpired = (circle: Circle) => circle.y > Constants.EXPIRED_Y;

  isHoldExpired = (circle: Circle) => circle.y === Constants.POINT_Y && circle.time >= circle.duration;

  isClickedHoldExpired = (circle: Circle) => circle.time > circle.duration;

  isTailExpired = (tail: Tail) => tail.y1 >= Constants.POINT_Y;

  incrementBgTime = (circle: Circle): Circle => ({
    ...circle,
    time: circle.time + Constants.TICK_RATE_MS,
  });

  incrementHoldTime = (circle: Circle): Circle => ({
    ...circle,
    time: circle.y === Constants.POINT_Y ? circle.time + Constants.TICK_RATE_MS : circle.time,
  });

  incrementHitY = (circle: Circle): Circle => ({
    ...circle,
    y: circle.y + Constants.TRAVEL_Y_PER_TICK,
  });

  incrementHoldY = (circle: Circle): Circle => ({
    ...circle,
    y: Math.min(circle.y + Constants.TRAVEL_Y_PER_TICK, Constants.POINT_Y),
  });

  incrementTailY = (tail: Tail): Tail => ({
    ...tail,
    y1: tail.y1 + Constants.TRAVEL_Y_PER_TICK,
    y2: Math.min(tail.y2 + Constants.TRAVEL_Y_PER_TICK, Constants.POINT_Y),
  });
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { combo, comboCount, multiplier, score, circles, bgCircles, clickedHitCircles, clickedHoldCircles } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const playableCircles = circles.filter(this.isPlayable);
    const closeCircles = playableCircles.filter(this.isClose(column));

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = playableCircles.filter(not(this.isClosestCircle(closestCircle)));

    const newHitCircles = filteredCircles.filter(not(this.isHold));
    const newHoldCircles = filteredCircles.filter(this.isHold);

    const newCombo = combo + 1;
    const newComboCount = Math.floor(newCombo / 10) * 10;
    const newMultiplier = this.calculateMultiplier(combo, comboCount, multiplier);
    const formatMultiplier = parseFloat(newMultiplier.toFixed(1));
    const newScore = score + Constants.SCORE_PER_HIT * multiplier;

    return {
      ...s,
      score: newScore,
      multiplier: formatMultiplier,
      combo: newCombo,
      comboCount: newComboCount,
      circles: [...filteredCircles, ...bgCircles],
      hitCircles: newHitCircles,
      holdCircles: newHoldCircles,
      clickedHitCircles: !this.isHold(closestCircle) ? [...clickedHitCircles, closestCircle] : clickedHitCircles,
      clickedHoldCircles: this.isHold(closestCircle) ? [...clickedHoldCircles, closestCircle] : clickedHoldCircles,
    };
  }

  isPlayable = (circle: Circle) => circle.userPlayed;

  isHold = (circle: Circle) => circle.isHoldCircle;

  isClosestCircle = (closest: Circle) => (circle: Circle) => circle === closest;

  isClose = (column: number) => (circle: Circle) =>
    circle.userPlayed && circle.column === column && Math.abs(circle.y - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

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

class KeyUp implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { clickedHoldCircles, circles } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = clickedHoldCircles.filter(this.isClose(column));

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = clickedHoldCircles.filter(not(this.isClosestCircle(closestCircle)));

    return {
      ...s,
      clickedHoldCircles: filteredCircles,
      circles: [...circles, closestCircle],
    };
  }

  isClosestCircle = (closest: Circle) => (circle: Circle) => circle === closest;

  isClose = (column: number) => (circle: Circle) =>
    circle.column === column && Math.abs(circle.y - Constants.POINT_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (circles: ReadonlyArray<Circle>): Circle =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.y - Constants.POINT_Y);
      const distance = Math.abs(circle.y - Constants.POINT_Y);
      return distance < closestDistance ? circle : closest;
    });
}

class CreateCircle implements Action {
  constructor(public readonly circle: Circle) {}

  apply(s: State): State {
    const { circles, tails } = s;

    const newCircles = [...circles, this.circle];
    const newTails = this.circle.duration >= Constants.MIN_HOLD_DURATION ? [...tails, createTail(this.circle)] : tails;

    return {
      ...s,
      circles: newCircles,
      tails: newTails,
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
