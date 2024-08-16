export { Constants, Viewport, Note };
export type { csvLine, ClickKey, ExtraKey, Event, State, Circle, Action };

/** Constants */

const Constants = {
  TICK_RATE_MS: 5,
  SONG_NAME: "bus",
  MAX_MIDI_VELOCITY: 127,
  NUMBER_OF_COLUMNS: 4,
  COLUMN_WIDTH: 20,
  NOTE_COLORS: ["green", "red", "blue", "yellow"],
  COLUMN_KEYS: ["KeyA", "KeyS", "KeyK", "KeyL"],
  S_TO_MS: 1000,
  TRAVEL_MS: 250,
  EXPIRED_Y: 430,
  POINT_Y: 350,
  TRAVEL_Y_PER_TICK: 7,
  CLICK_RANGE_Y: 30,
  SCORE_PER_HIT: 10,
  MULTIPLIER_INCREMENT: 0.2,
  COMBO_FOR_MULTIPLIER: 10,
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
  circles: ReadonlyArray<Circle>;
  playableCircles: ReadonlyArray<Circle>;
  backgroundCircles: ReadonlyArray<Circle>;
  exit: ReadonlyArray<Circle>;
  hitCircle?: Circle;
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
