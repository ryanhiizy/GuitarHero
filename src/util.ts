export {
  formatLine,
  parseCSV,
  playNote,
  getColumn,
  not,
  attr,
  isNotNullOrUndefined,
};

import * as Tone from "tone";
import { csvLine, Constants } from "./types";

/** Utility functions */

const formatLine = (line: string): csvLine => {
  const [user_played, instrument_name, velocity, pitch, start, end] =
    line.split(",");
  return {
    user_played: user_played === "True",
    instrument_name,
    velocity: parseInt(velocity),
    pitch: parseInt(pitch),
    start: parseFloat(start),
    end: parseFloat(end),
  };
};

const parseCSV = (csvContents: string): ReadonlyArray<csvLine> => {
  return csvContents.trim().split("\n").slice(1).map(formatLine);
};

const playNote =
  (samples: { [key: string]: Tone.Sampler }) => (line: csvLine) => {
    samples[line.instrument_name].triggerAttackRelease(
      Tone.Frequency(line.pitch, "midi").toNote(),
      line.end - line.start,
      undefined,
      line.velocity / Constants.MAX_MIDI_VELOCITY,
    );
  };

// const getColumn = (
//   pitch: number,
//   minPitch: number,
//   columnSize: number,
// ): number => Math.floor((pitch - minPitch) / columnSize) + 1;

const getColumn = (pitch: number): number => {
  const columnSize = Math.ceil(
    Constants.MAX_MIDI_VELOCITY / Constants.NUMBER_OF_COLUMNS,
  );
  return Math.floor(pitch / columnSize);
};

/**
 * Composable not: invert boolean result of given function
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 */
const not =
  <T>(f: (x: T) => boolean) =>
  (x: T) =>
    !f(x);

/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(
  input: null | undefined | T,
): input is T {
  return input != null;
}

/**
 * set a number of attributes on an Element at once
 * @param e the Element
 * @param o a property bag
 */
const attr = (e: Element, o: { [p: string]: unknown }) => {
  for (const k in o) e.setAttribute(k, String(o[k]));
};
