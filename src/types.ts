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
  CLICK_RANGE_Y: 25,
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
} as const;

/** User input */

type ClickKey = "KeyA" | "KeyS" | "KeyK" | "KeyL";

type ExtraKey = "KeyO" | "KeyP" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Types */

type State = Readonly<{
  score: number;
  multiplier: number;
  highscore: number;
  combo: number;
  comboCount: number;
  time: number;
  circles: ReadonlyArray<ICircle>;
  hitCircles: ReadonlyArray<IHitCircle>;
  backgroundCircles: ReadonlyArray<IBackgroundCircle>;
  clickedCircles: ReadonlyArray<IHitCircle>;
  exit: ReadonlyArray<IHitCircle>;
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

interface ICircle {
  id: number;
  note: Note;

  tick(s: State): State;
}

interface IHitCircle extends ICircle {
  cx: number;
  cy: number;
  isHit: boolean;
  column: number;
  duration: number;
}

interface IHoldCircle extends IHitCircle {
  synth: Tone.Synth<Tone.SynthOptions>;
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
