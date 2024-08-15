export { Constants, Viewport, Note };
export type { csvLine, Key, Event, State, Circle, Action };

/** Constants */

const Constants = {
  TICK_RATE_MS: 10,
  SONG_NAME: "ComparedChild2",
  MAX_MIDI_VELOCITY: 127,
  NUMBER_OF_COLUMNS: 4,
  COLUMN_WIDTH: 20,
  NOTE_COLORS: ["green", "red", "blue", "yellow"],
  COLUMN_KEYS: ["KeyA", "KeyS", "KeyK", "KeyL", "KeyO", "KeyP", "KeyR"],
} as const;

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
} as const;

const Note = {
  RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
  TAIL_WIDTH: 10,
} as const;

/** User input */

type Key = "KeyA" | "KeyS" | "KeyK" | "KeyL" | "KeyO" | "KeyP" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Types */

type State = Readonly<{
  score: number;
  time: number;
  circles: ReadonlyArray<Circle>;
  playableCircles: ReadonlyArray<Circle>;
  backgroundCircles: ReadonlyArray<Circle>;
  exit: ReadonlyArray<Circle>;
  hitCircle?: Circle;
  restart: boolean;
  gameEnd: boolean;
}>;

type Circle = Readonly<{
  id: number;
  x: number;
  y: number;
  userPlayed: boolean;
  column: number;
  start: number;
  duration: number;
  isHit: boolean;
  note: csvLine;
}>;

type csvLine = Readonly<{
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
