export { initialState, Tick, reduceState, CreateCircle, ClickCircle, Restart, GameEnd, Pause, KeyUp };

import * as Tone from "tone";
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
    const { circles, tails, combo, multiplier, time } = s;

    const hitCircles = circles.filter(this.isHit);
    const holdCircles = circles.filter(this.isHold);
    const bgCircles = circles.filter(this.isBackground);

    const expiredHitCircles = hitCircles.filter(this.isExpired);
    const activeHitCircles = hitCircles.filter(not(this.isExpired));
    const movedHitCircles = activeHitCircles.map(this.incrementY);

    const expiredHoldCircles = holdCircles.filter(this.isExpired);
    const activeHoldCircles = holdCircles.filter(not(this.isExpired));
    const movedHoldCircles = activeHoldCircles.map(this.incrementY);

    const expiredTails = tails.filter(this.isTailExpired);
    const activeTails = tails.filter(not(this.isTailExpired));
    const movedTails = activeTails.map(this.incrementTailY);

    const tickedBgCircles = bgCircles.map(this.incrementTime);

    const newCircles = [...movedHitCircles, ...movedHoldCircles, ...tickedBgCircles];
    const expiredCircles = [...expiredHitCircles, ...expiredHoldCircles];

    const newCombo = expiredCircles.length === 0 ? combo : 0;
    const newMultiplier = newCombo === 0 ? 1 : multiplier;
    const newTime = time + Constants.TICK_RATE_MS;

    // TODO: add scoring for expired tails when y1 === y2

    return {
      ...s,
      combo: newCombo,
      multiplier: newMultiplier,
      time: newTime,
      circles: newCircles,
      hitCircles: movedHitCircles,
      holdCircles: movedHoldCircles,
      bgCircles: tickedBgCircles,
      clickedHitCircles: [],
      clickedHoldCircles: [],
      tails: movedTails,
      exit: expiredCircles,
      exitTails: expiredTails,
      restart: false,
    };
  }

  isHit = (circle: Circle) => circle.userPlayed && !circle.isHoldCircle;

  isHold = (circle: Circle) => circle.isHoldCircle;

  isBackground = (circle: Circle) => !circle.userPlayed && circle.time + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS;

  isExpired = (circle: Circle) => circle.y >= Constants.EXPIRED_Y;

  isTailExpired = (tail: Tail) => tail.y1 >= Constants.EXPIRED_Y || tail.y1 === tail.y2;

  incrementTime = (circle: Circle): Circle => ({
    ...circle,
    time: circle.time + Constants.TICK_RATE_MS,
  });

  incrementY = (circle: Circle): Circle => ({
    ...circle,
    y: circle.y + Constants.TRAVEL_Y_PER_TICK,
  });

  incrementTailY = (tail: Tail): Tail => {
    const circle = tail.circle;
    const movedY1 = tail.y1 + Constants.TRAVEL_Y_PER_TICK;
    const newY1 = circle.isClicked ? Math.min(movedY1, Constants.POINT_Y) : movedY1;
    const movedY2 = tail.y2 + Constants.TRAVEL_Y_PER_TICK;
    const newY2 = circle.isClicked ? Math.min(movedY2, Constants.POINT_Y) : movedY2;

    return {
      ...tail,
      y1: newY1,
      y2: newY2,
    };
  };
}

class ClickCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { combo, multiplier, score, circles, bgCircles, clickedHitCircles, clickedHoldCircles, tails } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const playableCircles = circles.filter(this.isPlayable);
    const closeCircles = playableCircles.filter(this.isClose(column));

    if (closeCircles.length === 0) {
      return s;
    }

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = playableCircles.filter(not(this.isClosestCircle(closestCircle)));
    const updatedClosestCircle = this.setClicked(closestCircle);

    const updatedTails = tails.map((tail) =>
      tail.circle.id === closestCircle.id ? { ...tail, circle: this.setClicked(tail.circle) } : tail,
    );

    const newHitCircles = filteredCircles.filter(not(this.isHold));
    const newHoldCircles = filteredCircles.filter(this.isHold);

    const newCombo = this.isHold(updatedClosestCircle) ? combo : combo + 1;
    const newComboCount = Math.floor(newCombo / 10) * 10;
    const newMultiplier = this.calculateMultiplier(newCombo, newComboCount, multiplier);
    const formatMultiplier = parseFloat(newMultiplier.toFixed(1));
    const newScore = this.isHold(updatedClosestCircle) ? score : score + Constants.SCORE_PER_HIT * multiplier;

    return {
      ...s,
      score: newScore,
      multiplier: formatMultiplier,
      combo: newCombo,
      comboCount: newComboCount,
      circles: [...filteredCircles, ...bgCircles],
      hitCircles: newHitCircles,
      holdCircles: newHoldCircles,
      tails: updatedTails,
      clickedHitCircles: !this.isHold(updatedClosestCircle)
        ? [...clickedHitCircles, updatedClosestCircle]
        : clickedHitCircles,
      clickedHoldCircles: this.isHold(updatedClosestCircle)
        ? [...clickedHoldCircles, updatedClosestCircle]
        : clickedHoldCircles,
    };
  }

  setClicked = (circle: Circle): Circle => ({
    ...circle,
    isClicked: true,
  });

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
    const comboForMultiplier = combo - comboCount;
    return comboForMultiplier === Constants.COMBO_FOR_MULTIPLIER
      ? multiplier + Constants.MULTIPLIER_INCREMENT
      : multiplier;
  };
}

class KeyUp implements Action {
  constructor(public readonly key: ClickKey) {}

  apply(s: State): State {
    const { tails, combo, multiplier, score, exitTails } = s;

    const column = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = tails.filter(this.isClose(column));

    if (closeTails.length === 0) {
      return s;
    }

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
    const newComboCount = Math.floor(newCombo / 10) * 10;
    const newMultiplier = this.calculateMultiplier(newCombo, newComboCount, multiplier);
    const formatMultiplier = parseFloat(newMultiplier.toFixed(1));
    const newScore = score + Constants.SCORE_PER_HIT * multiplier;

    return {
      ...s,
      score: newScore,
      multiplier: formatMultiplier,
      combo: newCombo,
      comboCount: newComboCount,
      tails: filteredTails,
      exitTails: [...exitTails, unclickedClosestTail],
    };
  }

  setUnclicked = (tail: Tail): Tail => ({
    ...tail,
    circle: {
      ...tail.circle,
      isClicked: false,
    },
  });

  getRange = (tail: Tail) => Math.abs(tail.y1 - Constants.POINT_Y);

  isWithinRange = (tail: Tail) => this.getRange(tail) <= Constants.CLICK_RANGE_Y;

  isClosestTail = (closest: Tail) => (tail: Tail) => tail === closest;

  isClose = (column: number) => (tail: Tail) => tail.circle.column === column && tail.y2 === Constants.POINT_Y;

  findClosestTail = (tails: ReadonlyArray<Tail>): Tail =>
    tails.reduce((closest, tail) => {
      const closestDistance = this.getRange(closest);
      const distance = this.getRange(tail);
      return distance < closestDistance ? tail : closest;
    });

  calculateMultiplier = (combo: number, comboCount: number, multiplier: number): number => {
    const comboForMultiplier = combo - comboCount;
    return comboForMultiplier === Constants.COMBO_FOR_MULTIPLIER
      ? multiplier + Constants.MULTIPLIER_INCREMENT
      : multiplier;
  };
}

class CreateCircle implements Action {
  constructor(public readonly circle: Circle) {}

  apply(s: State): State {
    const { circles, tails } = s;

    const newCircles = [...circles, this.circle];
    const newTails = this.circle.isHoldCircle ? [...tails, createTail(this.circle)] : tails;

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
