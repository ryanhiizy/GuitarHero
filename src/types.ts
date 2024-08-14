export { Constants, Viewport, Note };
export type { csvLine, Key, Event };

/** Constants */

const Constants = {
  TICK_RATE_MS: 500,
  SONG_NAME: "RockinRobin",
  MAX_MIDI_VELOCITY: 127,
  NUMBER_OF_COLUMNS: 4,
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

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

type Event = "keydown" | "keyup" | "keypress";

/** Types */

type csvLine = Readonly<{
  user_played: boolean;
  instrument_name: string;
  velocity: number;
  pitch: number;
  start: number;
  end: number;
}>;
