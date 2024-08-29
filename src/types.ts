export { Constants, Viewport, NoteConstants };
export type {
  Note,
  ClickKey,
  ExtraKey,
  Event,
  State,
  ICircle,
  IHitCircle,
  IHoldCircle,
  IBackgroundCircle,
  Action,
  ITail,
  IPlayableCircle,
  PlayableCircles,
  RandomNote,
  IStarCircle,
  GroupedNote,
  GameSpeedType,
};

import * as Tone from "tone";

/** Constants */

const Constants = {
  TICK_RATE_MS: 5,
  SONG_NAME: "RockinRobin",
  MAX_MIDI_VELOCITY: 127,
  NUMBER_OF_COLUMNS: 4,
  COLUMN_WIDTH: 20,
  NOTE_COLORS: ["green", "red", "blue", "yellow"],
  COLUMN_KEYS: ["KeyA", "KeyS", "KeyK", "KeyL"],
  S_TO_MS: 1000,
  TRAVEL_MS: 500,
  EXPIRED_Y: 430,
  POINT_Y: 350,
  TRAVEL_Y_PER_TICK: 3.5,
  CLICK_RANGE_Y: 50,
  SCORE_PER_HIT: 10,
  MULTIPLIER_INCREMENT: 0.2,
  COMBO_FOR_MULTIPLIER: 10,
  MIN_HOLD_DURATION: 1000,
  INSTRUMENTS: ["bass-electric", "flute", "piano", "saxophone", "trombone", "trumpet", "violin"],
  SEED: {
    KeyA: 999,
    KeyS: 888,
    KeyK: 777,
    KeyL: 333,
  },
  STAR_DURATION: 5000,
  STAR_CHANCE: 0.05,
  STAR_COLOR: "cyan",
  STAR_MULTIPLIER: 3,
  STAR_DELAY: -25,
} as const;

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
} as const;

const NoteConstants = {
  RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
  TAIL_WIDTH: 10,
  CLASS_NAME: "playable outline",
} as const;

/** User input */

type ClickKey = "KeyA" | "KeyS" | "KeyK" | "KeyL";

type ExtraKey = "KeyO" | "KeyP" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Types */

type State = Readonly<{
  score: number;
  multiplier: number;
  combo: number;
  time: number;
  delay: number;

  tails: ReadonlyArray<ITail>;
  circles: ReadonlyArray<ICircle>;
  playableCircles: ReadonlyArray<PlayableCircles>;
  bgCircles: ReadonlyArray<IBackgroundCircle>;
  random: ReadonlyArray<RandomNote>;

  clickedCircles: ReadonlyArray<PlayableCircles>;

  exit: ReadonlyArray<PlayableCircles>;
  exitTails: ReadonlyArray<ITail>;

  starPhase: boolean;
  starDuration: number;

  paused: boolean;
  gameEnd: boolean;
}>;

type Note = Readonly<{
  userPlayed: boolean;
  instrumentName: string;
  velocity: number;
  pitch: number;
  start: number;
  end: number;
}>;

type RandomNote = Readonly<{
  note: Note;
  sampler: Tone.Sampler;
}>;

type PlayableCircles = IPlayableCircle<IHitCircle> | IPlayableCircle<IHoldCircle>;
type GroupedNote = [relativeStartTime: number, ...notes: ReadonlyArray<Note>];
type GameSpeedType = "slow" | "default" | "fast";

interface ICircle extends Action, Tickable {
  id: number;
  note: Note;
  sampler: Tone.Sampler;

  playNote(): void;
}

interface IPlayableCircle<T extends IPlayableCircle<T>> extends ICircle {
  cx: number;
  cy: number;
  column: number;
  isClicked: boolean;

  onClick(s: State): State;
  updateBodyView(rootSVG: HTMLElement): void;
  setRandomDuration(): T;
  setClicked(isClicked: boolean): T;
}

interface IHitCircle extends IPlayableCircle<IHitCircle> {}

interface IHoldCircle extends IPlayableCircle<IHoldCircle> {}

interface IStarCircle extends IPlayableCircle<IStarCircle> {}

interface IBackgroundCircle extends ICircle {
  timePassed: number;
}

interface ITail extends Action, Tickable {
  id: string;
  x: number;
  y1: number;
  y2: number;
  circle: IHoldCircle;

  stopNote(): void;
  isClicked(): boolean;
  setUnclicked(): ITail;
  updateBodyView(rootSVG: HTMLElement): void;
}

interface Tickable {
  tick(s: State): State;
}

/**
 * Actions modify state
 */
interface Action {
  apply(s: State): State;
}
