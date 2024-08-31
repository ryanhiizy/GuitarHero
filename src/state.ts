export {
  Tick,
  Pause,
  GameEnd,
  GameSpeed,
  reduceState,
  ClickCircle,
  initialState,
  ReleaseCircle,
};

import * as Tone from "tone";
import { Tail } from "./circle";
import { calculateMultiplier, generateRandomNote, not } from "./util";
import {
  Star,
  ITail,
  State,
  Action,
  ICircle,
  ClickKey,
  Constants,
  PlayableCircles,
} from "./types";

const initialState: State = {
  score: 0,
  multiplier: 1,
  combo: 0,
  time: 0,
  delay: 0,

  tails: [],
  circles: [],
  playableCircles: [],
  bgCircles: [],
  clickedCircles: [],
  random: [],

  exit: [],
  exitTails: [],

  starPhase: false,
  starDuration: 0,

  paused: false,
  gameEnd: false,
} as const;

class Tick implements Action {
  /**
   * Represents a tick in the game loop.
   *
   * @param s input State
   * @returns updated State
   */
  apply(s: State): State {
    const resetState = this.resetState(s);
    const stateAfterCircleTicks = s.circles.reduce(tickCircle, resetState);
    const stateAfterTailTicks = s.tails.reduce(tickTail, stateAfterCircleTicks);

    const {
      exit,
      time,
      delay,
      combo,
      starPhase,
      bgCircles,
      multiplier,
      starDuration,
      playableCircles,
    } = stateAfterTailTicks;

    const updatedStarDuration = starPhase
      ? starDuration + Constants.TICK_RATE_MS
      : 0;
    const isStarPhaseActive =
      starPhase && updatedStarDuration < Star.MAX_DURATION;

    const unclickedExitCircles = exit.filter(not(this.isClicked));
    const updatedCombo = unclickedExitCircles.length === 0 ? combo : 0;

    const baseMultiplier = isStarPhaseActive ? Star.MULTIPLIER + 1 : 1;
    const intermediateMultiplier =
      updatedCombo === 0 ? baseMultiplier : multiplier;
    const updatedMultiplier =
      updatedStarDuration === Star.MAX_DURATION
        ? intermediateMultiplier - Star.MULTIPLIER
        : intermediateMultiplier;

    const updatedTime = time + Constants.TICK_RATE_MS;

    const updatedDelay =
      updatedStarDuration === Star.MAX_DURATION ? delay - Star.DELAY : delay;

    return {
      ...stateAfterTailTicks,
      combo: updatedCombo,
      multiplier: parseFloat(updatedMultiplier.toFixed(1)),
      time: updatedTime,
      delay: updatedDelay,
      circles: [...playableCircles, ...bgCircles],
      clickedCircles: [],
      random: [],
      starPhase: isStarPhaseActive,
      starDuration: starPhase ? updatedStarDuration : 0,
    };
  }

  resetState = (s: State): State => ({
    ...s,
    tails: [],
    playableCircles: [],
    bgCircles: [],
    exit: [],
    exitTails: [],
  });

  isClicked = (circle: PlayableCircles) => circle.isClicked;
}

class ClickCircle implements Action {
  constructor(
    public readonly key: ClickKey,
    public readonly seed: number,
    public readonly samples: { [key: string]: Tone.Sampler },
  ) {}

  /**
   * Handles the click of a key.
   *
   * @param s input State
   * @returns modified State
   */
  apply(s: State): State {
    const { playableCircles, clickedCircles, tails, random, circles } = s;

    const columnIndex = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeCircles = playableCircles.filter(this.isClose(columnIndex));

    if (closeCircles.length === 0)
      return {
        ...s,
        random: [...random, generateRandomNote(this.seed, this.samples)],
      };

    const closestCircle = this.findClosestCircle(closeCircles);
    const filteredCircles = circles.filter(
      not(this.isClosestCircle(closestCircle)),
    );
    const filteredPlayableCircles = playableCircles.filter(
      not(this.isClosestCircle(closestCircle)),
    );
    const clickedClosestCircle = closestCircle.setClicked(true);

    const updateTails = tails.map(this.updateTail(clickedClosestCircle));

    const updateClosestCircle = this.isMisaligned(clickedClosestCircle)
      ? clickedClosestCircle.setRandomDuration()
      : clickedClosestCircle;

    // Different circles have different behaviours when clicked
    const stateAfterCircleClicked = clickedClosestCircle.onClick(s);

    return {
      ...stateAfterCircleClicked,
      tails: updateTails,
      circles: [...filteredCircles, updateClosestCircle],
      playableCircles: filteredPlayableCircles,
      clickedCircles: [...clickedCircles, updateClosestCircle],
    };
  }

  isClose = (column: number) => (circle: PlayableCircles) =>
    circle.column === column &&
    Math.abs(circle.cy - Constants.TARGET_Y) <= Constants.CLICK_RANGE_Y;

  findClosestCircle = (
    circles: ReadonlyArray<PlayableCircles>,
  ): PlayableCircles =>
    circles.reduce((closest, circle) => {
      const closestDistance = Math.abs(closest.cy - Constants.TARGET_Y);
      const distance = Math.abs(circle.cy - Constants.TARGET_Y);
      return distance < closestDistance ? circle : closest;
    });

  isMisaligned = (circle: PlayableCircles) =>
    Math.abs(circle.cy - Constants.TARGET_Y) > Constants.CLICK_RANGE_Y / 2;

  isClosestCircle = (closest: ICircle) => (circle: ICircle) =>
    circle === closest;

  updateTail =
    (closestCircle: PlayableCircles) =>
    (tail: ITail): ITail =>
      tail.circle.id === closestCircle.id
        ? new Tail(tail.id, tail.x, tail.y1, tail.y2, closestCircle)
        : tail;
}

class ReleaseCircle implements Action {
  constructor(public readonly key: ClickKey) {}

  /**
   * Handles the release of a key.
   *
   * @param s input State
   * @returns updated State
   */
  apply(s: State): State {
    const { tails, combo, multiplier, exitTails, score } = s;

    const columnIndex = Constants.COLUMN_KEYS.indexOf(this.key);
    const closeTails = tails.filter(this.isClose(columnIndex));

    if (closeTails.length === 0) return s;

    const closestTail = this.findClosestTail(closeTails);
    const unclickedClosestTail = closestTail.setClicked(false);
    const filteredTails = tails.filter(not(this.isClosestTail(closestTail)));

    if (!this.isWithinRange(closestTail)) {
      return {
        ...s,
        combo: 0,
        multiplier: 1,
        tails: [...filteredTails, unclickedClosestTail],
      };
    }

    const updatedCombo = combo + 1;
    const updatedMultiplier = calculateMultiplier(updatedCombo, multiplier);
    const updatedScore = score + Constants.SCORE_PER_HIT * updatedMultiplier;

    return {
      ...s,
      score: updatedScore,
      multiplier: updatedMultiplier,
      combo: updatedCombo,
      tails: filteredTails,
      exitTails: [...exitTails, unclickedClosestTail],
    };
  }

  isClose = (column: number) => (tail: ITail) =>
    tail.isClicked() && tail.circle.column === column;

  getRange = (tail: ITail) => Math.abs(tail.y1 - Constants.TARGET_Y);

  findClosestTail = (tails: ReadonlyArray<ITail>): ITail =>
    tails.reduce((closest, tail) => {
      const closestDistance = this.getRange(closest);
      const distance = this.getRange(tail);
      return distance < closestDistance ? tail : closest;
    });

  isClosestTail = (closest: ITail) => (tail: ITail) => tail === closest;

  isWithinRange = (tail: ITail) =>
    this.getRange(tail) <= Constants.CLICK_RANGE_Y;
}

class GameSpeed implements Action {
  constructor(public readonly delay: number) {}

  /**
   * Update the state to provide the initial game speed.
   *
   * @param s input State
   * @returns updated State
   */
  apply(s: State): State {
    return {
      ...s,
      delay: this.delay,
    };
  }
}

class Pause implements Action {
  constructor(public readonly isPaused: boolean) {}

  /**
   * Update the state to match the current pause status.
   *
   * @param s input State
   * @returns updated State
   */
  apply(s: State): State {
    // If the game is paused, set all tails to not clicked.
    // This is to stop notes from being played continuously when the game is paused.
    return {
      ...s,
      tails: this.isPaused
        ? s.tails.map((tail) => tail.setClicked(false))
        : s.tails,
      paused: this.isPaused,
    };
  }
}

class GameEnd implements Action {
  /**
   * Update the state to indicate the game has ended.
   *
   * @param s input State
   * @returns updated State
   */
  apply(s: State): State {
    return {
      ...s,
      gameEnd: true,
    };
  }
}

/**
 * Update the state when a tail is ticked.
 *
 * @param s input State
 * @param tail tail to tick
 * @returns updated State
 */
const tickTail = (s: State, tail: ITail): State => {
  return tail.tick(s);
};

/**
 * Update the state when a circle is ticked.
 *
 * @param s input State
 * @param circle circle to tick
 * @returns updated State
 */
const tickCircle = (s: State, circle: ICircle): State => {
  return circle.tick(s);
};

/**
 * State transducer.
 *
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const reduceState = (s: State, action: Action): State => action.apply(s);
