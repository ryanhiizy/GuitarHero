export { Constants, Viewport, NoteConstants };
export type { Note, ClickKey, ExtraKey, Event, State, Circle, Action, Tail };

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
  CLICK_RANGE_Y: 40,
  SCORE_PER_HIT: 10,
  MULTIPLIER_INCREMENT: 0.2,
  COMBO_FOR_MULTIPLIER: 10,
  MIN_HOLD_DURATION: 1000,
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

  tails: ReadonlyArray<Tail>;
  circles: ReadonlyArray<Circle>;
  hitCircles: ReadonlyArray<Circle>;
  holdCircles: ReadonlyArray<Circle>;
  bgCircles: ReadonlyArray<Circle>;

  clickedHitCircles: ReadonlyArray<Circle>;
  clickedHoldCircles: ReadonlyArray<Circle>;

  exit: ReadonlyArray<Circle>;
  exitTails: ReadonlyArray<Tail>;

  paused: boolean;
  restart: boolean;
  gameEnd: boolean;
}>;

type Circle = Readonly<{
  id: number;
  x: number;
  y: number;
  userPlayed: boolean;
  column: number;
  time: number;
  duration: number;
  isHoldCircle: boolean;
  sampler: Tone.Sampler;
  note: Note;
}>;

type Tail = Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  column: number;
  isMissed: boolean;
}>;

type Note = Readonly<{
  userPlayed: boolean;
  instrument_name: string;
  velocity: number;
  pitch: number;
  start: number;
  end: number;
}>;

/**
 * Actions modify state
 */
interface Action {
  apply(s: State): State;
}
