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
  RNG,
  generateRandomDurationNote,
  generateRandomNote,
  playRandomNote,
  clearCanvas,
};

import * as Tone from "tone";
import { Note, Constants, IHitCircle, ICircle, ITail, RandomNote, GroupedNote } from "./types";
import { BackgroundCircle, Circle, HitCircle, HoldCircle, StarCircle, Tail } from "./circle";
import { generate } from "rxjs";

/** Utility functions */

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 */
abstract class RNG {
  // LCG using GCC's constants
  private static m = 0x80000000; // 2**31
  private static a = 1103515245;
  private static c = 12345;

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @param seed
   * @returns a hash of the seed
   */
  public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

  /**
   * Takes hash value and scales it to the specified range [lower, upper]
   * @param hash
   * @param lower
   * @param upper
   * @returns scaled value within the range [lower, upper]
   */
  public static scale = (lower: number, upper: number) => (hash: number) => {
    return lower + (hash / (RNG.m - 1)) * (upper - lower);
  };
}

const scaleToDuration = (hash: number) => RNG.scale(0.05, 0.5)(hash);
const scaleToVelocity = (hash: number) => RNG.scale(0.1, 0.6)(hash);
const scaleToPitch = (hash: number) => Math.round(RNG.scale(30, 70)(hash)); // 30 to 70 so my ears don't die
const scaleToInstrument = (hash: number) => Math.round(RNG.scale(0, Constants.INSTRUMENTS.length - 1)(hash));

const generateRandomDurationNote = (note: Note): Note => ({
  ...note,
  end: note.start + scaleToDuration(RNG.hash(getID(note))),
});

const generateRandomNote = (seed: number, samples: { [key: string]: Tone.Sampler }): RandomNote => {
  const seed1 = RNG.hash(seed);
  const seed2 = RNG.hash(seed1);
  const seed3 = RNG.hash(seed2);
  const randomInstrument = Constants.INSTRUMENTS[scaleToInstrument(seed1)];
  return {
    note: {
      userPlayed: false,
      instrumentName: randomInstrument,
      velocity: scaleToVelocity(seed1),
      pitch: scaleToPitch(seed2),
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

const getGroupedNotes = (csv: ReadonlyArray<Note>): ReadonlyArray<GroupedNote> => {
  const groupedNotes = getGroupedNotesHelper(csv);

  return Object.entries(groupedNotes).reduce(
    (acc, [start, notes]) => {
      const relativeStartTime = parseFloat(start) - acc.previousStartTime;
      return {
        notes: [...acc.notes, [relativeStartTime, ...notes] as GroupedNote],
        previousStartTime: parseFloat(start),
      };
    },
    {
      notes: [] as ReadonlyArray<GroupedNote>,
      previousStartTime: 0,
    },
  ).notes;
};

const calculateDelayPercentage = (delay: number, csvArray: ReadonlyArray<Note>): number => {
  const firstNote = csvArray[0];
  const lastNote = csvArray[csvArray.length - 1];

  const originalTotalDuration = (lastNote.end - firstNote.start) * 1000;
  const totalAdjustment = (csvArray.length - 1) * delay;
  const newTotalDuration = originalTotalDuration + totalAdjustment;
  const delayPercentage = newTotalDuration / originalTotalDuration;

  return delayPercentage;
};

const noteAfterDelay = (delayPercentage: number, note: Note): Note => ({
  ...note,
  end: note.start + (note.end - note.start) * delayPercentage,
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
  const delayPercentage = calculateDelayPercentage(delay, csvArray);
  const newNote = noteAfterDelay(delayPercentage, note);

  const ID = getID(newNote);
  const sampler = samples[newNote.instrumentName];

  if (newNote.userPlayed) {
    const column = getColumn(minPitch, maxPitch, newNote.pitch);
    const duration = (newNote.end - newNote.start) * Constants.S_TO_MS;
    const starChance = RNG.scale(0, 1)(RNG.hash(ID));

    if (duration > Constants.MIN_HOLD_DURATION) {
      const newHoldCircle = new HoldCircle(ID, newNote, column, sampler);
      const y1 = newHoldCircle.cy - (duration * Constants.TRAVEL_Y_PER_TICK) / Constants.TICK_RATE_MS;

      return new Tail(`${ID}t`, newHoldCircle.cx, y1, newHoldCircle.cy, newHoldCircle);
    } else {
      if (starChance < Constants.STAR_CHANCE) {
        return new StarCircle(ID, newNote, column, sampler);
      }

      return new HitCircle(ID, newNote, column, sampler);
    }
  } else {
    return new BackgroundCircle(ID, newNote, sampler);
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
