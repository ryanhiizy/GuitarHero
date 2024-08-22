export {
  formatLine,
  parseCSV,
  playNote,
  getColumn,
  not,
  attr,
  isNotNullOrUndefined,
  getGroupedNotes,
  getMinPitch,
  getMaxPitch,
  createCircle,
  startNote,
  stopNote,
  clearCircles,
  createTail,
};

import * as Tone from "tone";
import { Note, Constants, Circle, Tail } from "./types";

/** Utility functions */

const getPlayablePitches = (csv: ReadonlyArray<Note>): ReadonlyArray<number> =>
  csv.filter((note) => note.userPlayed).map((note) => note.pitch);

const getMinPitch = (csv: ReadonlyArray<Note>): number => Math.min(...getPlayablePitches(csv));

const getMaxPitch = (csv: ReadonlyArray<Note>): number => Math.max(...getPlayablePitches(csv));

const getID = (note: Note) => parseFloat(`${note.velocity}${note.pitch}${note.start}`);

const createCircle = (
  note: Note,
  minPitch: number,
  maxPitch: number,
  samples: { [key: string]: Tone.Sampler },
): Circle => {
  const id = getID(note);
  const column = getColumn(note.pitch, minPitch, maxPitch);
  const duration = (note.end - note.start) * Constants.S_TO_MS;
  const isHoldCircle = note.userPlayed && duration >= Constants.MIN_HOLD_DURATION;
  const x = (column + 1) * Constants.COLUMN_WIDTH;
  const sampler = samples[note.instrument_name];

  return {
    id,
    x: x,
    y: 0,
    userPlayed: note.userPlayed,
    column: column,
    time: 0,
    duration: duration,
    isHoldCircle: isHoldCircle,
    isClicked: false,
    note,
    sampler,
  };
};

const createTail = (circle: Circle): Tail => ({
  id: `${circle.id}t`,
  x1: circle.x,
  y1: circle.y - circle.duration * (Constants.TRAVEL_Y_PER_TICK / Constants.TICK_RATE_MS),
  x2: circle.x,
  y2: circle.y,
  circle,
  isReleasedEarly: false,
});

const formatLine = (line: string): Note => {
  const [userPlayed, instrument_name, velocity, pitch, start, end] = line.split(",");
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

const playNote = (samples: { [key: string]: Tone.Sampler }) => (circle: Circle) => {
  const note = circle.note;
  const normalizedVelocity = Math.min(Math.max(note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

  samples[note.instrument_name].triggerAttackRelease(
    Tone.Frequency(note.pitch, "midi").toNote(),
    note.end - note.start,
    undefined,
    normalizedVelocity,
  );
};

const startNote = (circle: Circle) => {
  console.log("startNote", circle);
  const note = circle.note;
  const normalizedVelocity = Math.min(Math.max(note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

  return circle.sampler.triggerAttack(Tone.Frequency(note.pitch, "midi").toNote(), undefined, normalizedVelocity);
};

const stopNote = (circle: Circle) =>
  circle.sampler.triggerRelease(Tone.Frequency(circle.note.pitch, "midi").toNote(), undefined);

const getColumn = (pitch: number, minPitch: number, maxPitch: number): number => {
  const columnSize = (maxPitch - minPitch) / Constants.NUMBER_OF_COLUMNS;
  const column = Math.floor((pitch - minPitch) / columnSize);
  return column === Constants.NUMBER_OF_COLUMNS ? column - 1 : column;
};

const clearCircles = () => {
  const circles = document.querySelectorAll(".playable");
  circles.forEach((circle) => {
    circle.remove();
  });
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
