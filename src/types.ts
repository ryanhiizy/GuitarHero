export { Constants, Viewport, NoteConstants };
export type {
  Note,
  ClickKey,
  ExtraKey,
  Event,
  State,
  ICircle,
  IPlayableCircle,
  PlayableCircleType,
  IHitCircle,
  IHoldCircle,
  IBackgroundCircle,
  Action,
  ITail,
};

import * as Tone from "tone";

/** Constants */

const Constants = {
  TICK_RATE_MS: 5,
  SONG_NAME: "past",
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
  CLICK_RANGE_Y: 40,
  SCORE_PER_HIT: 10,
  MULTIPLIER_INCREMENT: 0.2,
  COMBO_FOR_MULTIPLIER: 10,
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

type PlayableCircleType = IPlayableCircle<IHitCircle> | IPlayableCircle<IHoldCircle>;

type State = Readonly<{
  score: number;
  multiplier: number;
  highscore: number;
  combo: number;
  time: number;

  tails: ReadonlyArray<ITail>;
  circles: ReadonlyArray<ICircle>;
  playableCircles: ReadonlyArray<PlayableCircleType>;
  bgCircles: ReadonlyArray<IBackgroundCircle>;
  clickedCircles: ReadonlyArray<PlayableCircleType>;
  exit: ReadonlyArray<PlayableCircleType>;

  paused: boolean;
  restart: boolean;
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

interface ITail {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  circle: IHoldCircle;
  isReleasedEarly: boolean;

  updateBodyView(rootSVG: HTMLElement): void;
}

interface ICircle {
  id: number;
  note: Note;

  tick(s: State): State;
  playNote(samples: { [key: string]: Tone.Sampler }): void;
}

interface IPlayableCircle<T extends IPlayableCircle<T>> extends ICircle {
  cx: number;
  cy: number;
  column: number;
  isClicked: boolean;

  setClicked(isClicked: boolean): T;
  updateBodyView(rootSVG: HTMLElement): void;
  incrementComboOnClick(): boolean;
}

interface IHitCircle extends IPlayableCircle<IHitCircle> {}
interface IHoldCircle extends IPlayableCircle<IHoldCircle> {
  duration: number;
  sampler: Tone.Sampler;
}

interface IBackgroundCircle extends ICircle {
  timePassed: number;
}

/**
 * Actions modify state
 */
interface Action {
  apply(s: State): State;
}
