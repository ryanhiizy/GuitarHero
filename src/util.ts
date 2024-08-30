export {
  RNG,
  not,
  attr,
  getID,
  parseCSV,
  getColumn,
  getMinPitch,
  getMaxPitch,
  clearCanvas,
  createCircle,
  calculateDelay,
  playRandomNote,
  parseLineToNote,
  getGroupedNotes,
  generateRandomNote,
  calculateMultiplier,
  isNotNullOrUndefined,
  generateRandomDurationNote,
};

import * as Tone from "tone";
import { BackgroundCircle, HitCircle, HoldCircle, StarCircle, Tail } from "./circle";
import { Note, Constants, ICircle, ITail, RandomNote, GroupedNote, GameSpeedType, Star } from "./types";

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
abstract class RNG {
  // LCG using GCC's constants
  static m = 0x80000000; // 2**31
  static a = 1103515245;
  static c = 12345;

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @param seed
   * @returns a hash of the seed
   *
   * @see https://stackblitz.com/edit/asteroids2023
   */
  public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

  /**
   * Takes hash value and scales it to the specified range [lower, upper]
   * @param hash
   * @param lower
   * @param upper
   * @returns scaled value within the range [lower, upper]
   *
   * @see https://stackblitz.com/edit/asteroids2023
   */
  public static scale = (lower: number, upper: number) => (hash: number) => {
    return lower + (hash / (RNG.m - 1)) * (upper - lower);
  };
}

// Functions that accept a hash to scale to an appropriate range
const scaleToDuration = RNG.scale(0.1, 0.5);
const scaleToVelocity = RNG.scale(0.5, 0.8);
const scaleToPitch = RNG.scale(40, 70);
const scaleToInstrument = RNG.scale(0, Constants.INSTRUMENTS.length - 1);

const generateRandomDurationNote = (note: Note): Note => ({
  ...note,
  end: note.start + scaleToDuration(RNG.hash(getID(note))),
});

const generateRandomNote = (seed: number, samples: { [key: string]: Tone.Sampler }): RandomNote => {
  const seed1 = RNG.hash(seed);
  const seed2 = RNG.hash(seed1);
  const seed3 = RNG.hash(seed2);
  const randomInstrument = Constants.INSTRUMENTS[Math.round(scaleToInstrument(seed1))];
  return {
    note: {
      userPlayed: false,
      instrumentName: randomInstrument,
      velocity: scaleToVelocity(seed1),
      pitch: Math.round(scaleToPitch(seed2)),
      start: 0,
      end: scaleToDuration(seed3),
    },
    sampler: samples[randomInstrument],
  };
};

const playRandomNote = (randomNote: RandomNote) => {
  randomNote.sampler.triggerAttackRelease(
    Tone.Frequency(randomNote.note.pitch, "midi").toNote(),
    randomNote.note.end,
    undefined,
    randomNote.note.velocity / 2,
  );
};

// Check if the combo is a multiple of the treshold and increment the multiplier
const calculateMultiplier = (combo: number, multiplier: number): number =>
  combo > 0 && combo % Constants.COMBO_TRESHOLD === 0
    ? parseFloat((multiplier + Constants.MULTIPLIER_INCREMENT).toFixed(1))
    : multiplier;

// Get the pitches of the notes which are user played
const getPlayablePitches = (csv: ReadonlyArray<Note>): ReadonlyArray<number> =>
  csv.filter((note) => note.userPlayed).map((note) => note.pitch);

const getMinPitch = (csv: ReadonlyArray<Note>): number => Math.min(...getPlayablePitches(csv));

const getMaxPitch = (csv: ReadonlyArray<Note>): number => Math.max(...getPlayablePitches(csv));

// The columns are evenly distributed between the min and max pitch of user played notes
const getColumn = (minPitch: number, maxPitch: number, pitch: number): number => {
  const columnSize = (maxPitch - minPitch) / Constants.NUM_COLUMNS;
  const column = Math.min(Constants.NUM_COLUMNS - 1, Math.floor((pitch - minPitch) / columnSize));
  return column;
};

const getID = (note: Note) => parseFloat(`${note.velocity}${note.pitch}${note.start}`);

const parseCSV = (csvContents: string): ReadonlyArray<Note> => {
  return csvContents.trim().split("\n").slice(1).map(parseLineToNote);
};

const parseLineToNote = (line: string): Note => {
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

/**
 * Before passing the notes to the note$ stream, they have to be grouped.
 * This is because to implement the dynamic speed of the song and pause
 * functionality, concatMap has to be used. However, concatMap causes the
 * notes which are supposed to be played at the same time to be played out
 * of sync. To prevent this, the notes are grouped by their start time and
 * the relative start times are calculated for concatMap to work properly.
 */

// Group notes by their start time
// Example:
// 0: [Note, Note]
// 300: [Note, Note]
// 600: [Note, Note]
const getGroupedNotesHelper = (csvArray: ReadonlyArray<Note>): Readonly<{ [key: string]: ReadonlyArray<Note> }> =>
  csvArray.reduce<Readonly<{ [key: string]: ReadonlyArray<Note> }>>((acc, note) => {
    const startTime = note.start * Constants.S_TO_MS;
    const existingNotes = acc[startTime] || [];

    return {
      ...acc,
      [startTime]: [...existingNotes, note],
    };
  }, {});

// Get the grouped notes and calculate the relative start times
// Format: [relativeStartTime, ...notes] (groups may have equal relative start times so it has to be an array)
// Example:
// [0, Note, Note]
// [300, Note, Note]
// [300, Note, Note] (600 - 300)
const getGroupedNotes = (csvArray: ReadonlyArray<Note>): ReadonlyArray<GroupedNote> => {
  const groupedNotes = getGroupedNotesHelper(csvArray);

  return Object.entries(groupedNotes).reduce<{
    notes: ReadonlyArray<GroupedNote>;
    previousStartTime: number;
  }>(
    (acc, [startTime, notes]) => {
      const relativeStartTime = parseFloat(startTime) - acc.previousStartTime;
      return {
        notes: [...acc.notes, [relativeStartTime, ...notes]],
        previousStartTime: parseFloat(startTime),
      };
    },
    { notes: [], previousStartTime: 0 },
  ).notes;
};

// Calculates the delay to be added or subtracted between notes to match the initial game speed
const calculateDelay = (csvArray: ReadonlyArray<Note>, gameSpeed: GameSpeedType): number => {
  const factor = Constants.SPEED_FACTORS[gameSpeed];
  const firstNote = csvArray[0];
  const lastNote = csvArray[csvArray.length - 1];
  const totalDuration = (lastNote.end - firstNote.start) * 1000;
  const numOfLines = csvArray.length - 1;

  return Math.floor((factor * totalDuration) / numOfLines);
};

// Calculates the factor to be multiplied with the duration of the notes
// to match the current game speed based on the current delay
const calculateDelayFactor = (delay: number, csvArray: ReadonlyArray<Note>): number => {
  const firstNote = csvArray[0];
  const lastNote = csvArray[csvArray.length - 1];

  const originalTotalDuration = (lastNote.end - firstNote.start) * 1000;
  const totalAdjustment = (csvArray.length - 1) * delay;
  const newTotalDuration = originalTotalDuration + totalAdjustment;
  const factor = newTotalDuration / originalTotalDuration;

  return factor;
};

const noteAfterDelay = (factor: number, note: Note): Note => ({
  ...note,
  end: note.start + (note.end - note.start) * factor,
});

const clearCanvas = () => {
  const circles = document.querySelectorAll(".playable");
  circles.forEach((circle) => circle.remove());
};

const createCircle = (
  minPitch: number,
  maxPitch: number,
  samples: { [key: string]: Tone.Sampler },
  delay: number,
  csvArray: ReadonlyArray<Note>,
  note: Note,
): ICircle | ITail => {
  const delayFactor = calculateDelayFactor(delay, csvArray);
  const updatedNote = noteAfterDelay(delayFactor, note);

  const id = getID(updatedNote);
  const sampler = samples[updatedNote.instrumentName];
  const column = getColumn(minPitch, maxPitch, updatedNote.pitch);
  const duration = (updatedNote.end - updatedNote.start) * Constants.S_TO_MS;
  const isStar = RNG.scale(0, 1)(RNG.hash(id)) < Star.CHANCE;

  if (!updatedNote.userPlayed) {
    return new BackgroundCircle(id, updatedNote, sampler);
  }

  if (duration > Constants.MIN_HOLD_DURATION) {
    const holdCircle = new HoldCircle(id, updatedNote, column, sampler);
    const y1 = holdCircle.cy - (duration * Constants.PIXELS_PER_TICK) / Constants.TICK_INTERVAL;
    return new Tail(`${id}t`, holdCircle.cx, y1, holdCircle.cy, holdCircle);
  }

  return isStar ? new StarCircle(id, updatedNote, column, sampler) : new HitCircle(id, updatedNote, column, sampler);
};

/**
 * Composable not: invert boolean result of given function
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const not =
  <T>(f: (x: T) => boolean) =>
  (x: T) =>
    !f(x);

/**
 * set a number of attributes on an Element at once
 * @param e the Element
 * @param o a property bag
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const attr = (e: Element, o: { [p: string]: unknown }) => {
  for (const k in o) e.setAttribute(k, String(o[k]));
};

/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const isNotNullOrUndefined = <T extends object>(input: null | undefined | T): input is T => input != null;
