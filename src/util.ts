export {
  formatLine,
  parseCSV,
  getColumn,
  not,
  attr,
  isNotNullOrUndefined,
  getID,
  getGroupedNotes,
  createCircle,
  getMinPitch,
  getMaxPitch,
  calculateMultiplier,
};

import * as Tone from "tone";
import { Note, Constants, IHitCircle, ICircle, ITail } from "./types";
import { BackgroundCircle, Circle, HitCircle, HoldCircle, Tail } from "./circle";

/** Utility functions */
const calculateMultiplier = (combo: number, multiplier: number): number =>
  combo >= Constants.COMBO_FOR_MULTIPLIER && combo % Constants.COMBO_FOR_MULTIPLIER === 0
    ? parseFloat((multiplier + Constants.MULTIPLIER_INCREMENT).toFixed(1))
    : multiplier;

const getPlayablePitches = (csv: ReadonlyArray<Note>): ReadonlyArray<number> =>
  csv.filter((note) => note.userPlayed).map((note) => note.pitch);

const getMinPitch = (csv: ReadonlyArray<Note>): number => Math.min(...getPlayablePitches(csv));

const getMaxPitch = (csv: ReadonlyArray<Note>): number => Math.max(...getPlayablePitches(csv));

const getID = (note: Note) => parseFloat(`${note.velocity}${note.pitch}${note.start}`);

const formatLine = (line: string): Note => {
  const [userPlayed, instrumentName, velocity, pitch, start, end] = line.split(",");
  return {
    userPlayed: userPlayed === "True",
    instrumentName,
    velocity: parseInt(velocity),
    pitch: parseInt(pitch),
    start: parseFloat(start),
    end: parseFloat(end),
  };
};

const parseCSV = (csvContents: string): ReadonlyArray<Note> => {
  return csvContents.trim().split("\n").slice(1).map(formatLine);
};

const getColumn = (minPitch: number, maxPitch: number, pitch: number): number => {
  const columnSize = (maxPitch - minPitch) / Constants.NUMBER_OF_COLUMNS;
  const column = Math.floor((pitch - minPitch) / columnSize);
  return column === Constants.NUMBER_OF_COLUMNS ? column - 1 : column;
};

const getGroupedNotesHelper = (csv: ReadonlyArray<Note>): Readonly<{ [key: string]: ReadonlyArray<Note> }> =>
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

const getGroupedNotes = (csv: ReadonlyArray<Note>): ReadonlyArray<ReadonlyArray<number | Note>> => {
  const groupedNotes = getGroupedNotesHelper(csv);

  return Object.entries(groupedNotes).reduce(
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
};

const createCircle =
  (minPitch: number, maxPitch: number, samples: { [key: string]: Tone.Sampler }) =>
  (note: Note): ICircle | ITail => {
    const ID = getID(note);
    const sampler = samples[note.instrumentName];

    if (note.userPlayed) {
      const column = getColumn(minPitch, maxPitch, note.pitch);
      const duration = (note.end - note.start) * Constants.S_TO_MS;

      if (duration >= Constants.MIN_HOLD_DURATION) {
        const newHoldCircle = new HoldCircle(ID, note, column, sampler);
        const y1 = newHoldCircle.cy - (duration * Constants.TRAVEL_Y_PER_TICK) / Constants.TICK_RATE_MS;

        return new Tail(`${ID}t`, newHoldCircle.cx, y1, newHoldCircle.cy, newHoldCircle);
      } else {
        return new HitCircle(ID, note, column, sampler);
      }
    } else {
      return new BackgroundCircle(ID, note, sampler);
    }
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
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
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
