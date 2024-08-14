export { formatLine, parseCSV, playNote, getColumn, createCircle };

import * as Tone from "tone";
import { csvLine, Constants, Note } from "./types";
import { createSvgElement } from "./view";

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

const playNote = (
  line: csvLine,
  samples: { [key: string]: Tone.Sampler },
  delay: number | undefined = undefined,
) => {
  samples[line.instrument_name].triggerAttackRelease(
    Tone.Frequency(line.pitch, "midi").toNote(),
    line.end - line.start,
    delay,
    line.velocity / Constants.MAX_MIDI_VELOCITY,
  );
};

const getColumn = (
  pitch: number,
  minPitch: number,
  columnSize: number,
): number => Math.floor((pitch - minPitch) / columnSize) + 1;

function createCircle(
  column: number,
  svg: SVGGraphicsElement & HTMLElement,
): SVGElement {
  const color = ["green", "red", "blue", "yellow"][column - 1];
  return createSvgElement(svg.namespaceURI, "circle", {
    r: `${Note.RADIUS}`,
    cx: `${20 * column}%`,
    cy: "0",
    style: `fill: ${color}`,
    class: "shadow",
  });
}
