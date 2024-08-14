/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { from, fromEvent, interval, merge, of } from "rxjs";
import { map, filter, scan, mergeMap, delay } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { Constants, Note, Viewport, csvLine, Key, Event } from "./types";
import { createSvgElement, hide, show } from "./view";
import {
  formatLine,
  parseCSV,
  playNote,
  getColumn,
  createCircle,
} from "./util";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
  csvContents: string,
  samples: { [key: string]: Tone.Sampler },
) {
  // Parse the CSV file
  const csv = parseCSV(csvContents);
  const csv$ = from(csv);

  // Determine the pitch range and column size
  const pitches = csv.map((line) => line.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const columnSize = Math.ceil(
    (maxPitch - minPitch) / Constants.NUMBER_OF_COLUMNS,
  );

  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

  // Text fields
  const multiplier = document.querySelector("#multiplierText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */

  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

  /** Determines the rate of time steps */
  const tick$ = interval(Constants.TICK_RATE_MS);

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    // Add blocks to the main grid canvas
    const greenCircle = createSvgElement(svg.namespaceURI, "circle", {
      r: `${Note.RADIUS}`,
      cx: "20%",
      cy: "0",
      style: "fill: green",
      class: "shadow",
    });

    const redCircle = createSvgElement(svg.namespaceURI, "circle", {
      r: `${Note.RADIUS}`,
      cx: "40%",
      cy: "0",
      style: "fill: red",
      class: "shadow",
    });

    const blueCircle = createSvgElement(svg.namespaceURI, "circle", {
      r: `${Note.RADIUS}`,
      cx: "60%",
      cy: "0",
      style: "fill: blue",
      class: "shadow",
    });

    const yellowCircle = createSvgElement(svg.namespaceURI, "circle", {
      r: `${Note.RADIUS}`,
      cx: "80%",
      cy: "0",
      style: "fill: yellow",
      class: "shadow",
    });

    csv$
      .pipe(
        mergeMap((line) =>
          of(line).pipe(
            delay((line.start - 1) * 1000),
            map(() => {
              const column = getColumn(line.pitch, minPitch, columnSize);

              const circle = createCircle(column, svg);

              svg.appendChild(circle);
            }),
            map(() => playNote(line, samples)),
          ),
        ),
      )
      .subscribe();
  };

  const source$ = tick$
    .pipe(scan((s: State) => ({ gameEnd: false }), initialState))
    .subscribe((s: State) => {
      render(s);

      if (s.gameEnd) {
        show(gameover);
      } else {
        hide(gameover);
      }
    });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
  // Load in the instruments and then start your game!
  const samples = SampleLibrary.load({
    instruments: [
      "bass-electric",
      "violin",
      "piano",
      "trumpet",
      "saxophone",
      "trombone",
      "flute",
    ], // SampleLibrary.list,
    baseUrl: "samples/",
  });

  const startGame = (contents: string) => {
    document.body.addEventListener(
      "mousedown",
      function () {
        main(contents, samples);
      },
      { once: true },
    );
  };

  const { protocol, hostname, port } = new URL(import.meta.url);
  const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

  Tone.ToneAudioBuffer.loaded().then(() => {
    for (const instrument in samples) {
      samples[instrument].toDestination();
      samples[instrument].release = 0.5;
    }

    fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
      .then((response) => response.text())
      .then((text) => startGame(text))
      .catch((error) => console.error("Error fetching the CSV file:", error));
  });
}
