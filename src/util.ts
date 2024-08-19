export {
  formatLine,
  parseCSV,
  playNote,
  getColumn,
  not,
  attr,
  isNotNullOrUndefined,
  getNonOverlappingColumn,
  getGroupedNotes,
  getRelativeGroupedNotes,
};

import * as Tone from "tone";
import { Note, Constants, Circle } from "./types";

/** Utility functions */

const formatLine = (line: string): Note => {
  const [userPlayed, instrument_name, velocity, pitch, start, end] =
    line.split(",");
  return {
    userPlayed: userPlayed === "True",
    instrument_name,
    velocity: parseInt(velocity),
    pitch: parseInt(pitch),
    start: parseFloat(start),
    end: parseFloat(end),
  };
};

const parseCSV = (csvContents: string): ReadonlyArray<Note> => {
  return csvContents.trim().split("\n").slice(1).map(formatLine);
};

const playNote = (samples: { [key: string]: Tone.Sampler }) => (line: Note) => {
  const normalizedVelocity = Math.min(Math.max(line.velocity, 0), 1);

  samples[line.instrument_name].triggerAttackRelease(
    Tone.Frequency(line.pitch, "midi").toNote(),
    line.end - line.start,
    undefined,
    normalizedVelocity / Constants.MAX_MIDI_VELOCITY,
  );
};

const getColumn = (
  minPitch: number,
  maxPitch: number,
  pitch: number,
): number => {
  const columnSize = (maxPitch - minPitch) / Constants.NUMBER_OF_COLUMNS;
  const column = Math.floor((pitch - minPitch) / columnSize);
  return column === Constants.NUMBER_OF_COLUMNS ? column - 1 : column;
};

const getNonOverlappingColumn =
  (arr: ReadonlyArray<Circle | undefined>) =>
  (
    circle: Circle,
  ): Readonly<{
    circle: Circle;
    column: number;
  }> => {
    const column = circle.column;
    if (arr[column] === undefined) {
      return { circle, column };
    }
    const nextColumn = !column ? Constants.NUMBER_OF_COLUMNS : column - 1;
    return getNonOverlappingColumn(arr)(circle);
  };

const getGroupedNotes = (
  csv: ReadonlyArray<Note>,
): Readonly<{ [key: string]: ReadonlyArray<Note> }> =>
  csv.reduce(
    (acc, note) => {
      const currentStartTime = (note.start * Constants.S_TO_MS).toFixed(3);

      // Update the notes object with the new note
      const updatedNotes = {
        ...acc,
        [currentStartTime]: [...(acc[currentStartTime] || []), note],
      };

      // Return the updated accumulator
      return updatedNotes;
    },
    {} as Readonly<{ [key: string]: ReadonlyArray<Note> }>,
  );

const getRelativeGroupedNotes = (
  groupedNotes: Readonly<{ [key: string]: ReadonlyArray<Note> }>,
): ReadonlyArray<ReadonlyArray<number | Note>> =>
  Object.entries(groupedNotes).reduce(
    (acc, [start, notes]) => {
      const relativeStartTime = parseFloat(start) - acc.previousStartTime;
      return {
        notes: [...acc.notes, [relativeStartTime, ...notes]],
        previousStartTime: parseFloat(start),
      };
    },
    {
      notes: [] as ReadonlyArray<ReadonlyArray<number | Note>>,
      previousStartTime: 0,
    },
  ).notes;

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
