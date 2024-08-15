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
import {
  from,
  fromEvent,
  interval,
  merge,
  Observable,
  of,
  Subscription,
} from "rxjs";
import { map, filter, scan, mergeMap, delay } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { Constants, Key, Event, State, Action } from "./types";
import { updateView } from "./view";
import { parseCSV, getColumn, playNote } from "./util";
import {
  initialState,
  Tick,
  reduceState,
  Placeholder,
  CreateCircle,
  createCircle,
  ClickCircle,
  UpdateNote,
} from "./state";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
  csvContents: string,
  samples: { [key: string]: Tone.Sampler },
) {
  const gameClock$ = interval(Constants.TICK_RATE_MS).pipe(
    map((elapsed) => {
      const elapsedMilliseconds = (elapsed + 1) * 10;
      return new Tick(elapsedMilliseconds);
    }),
  );

  const csv$ = from(parseCSV(csvContents));

  const createCircles$ = csv$.pipe(
    mergeMap((line, index) =>
      of(line).pipe(
        delay(Math.round(line.start * 100) * 10),
        filter((line) => line.user_played),
        map((line) => {
          const roundStart = Math.round(line.start * 100) * 10;
          const column = getColumn(line.pitch);
          const x = (column + 1) * Constants.COLUMN_WIDTH;
          const circle = createCircle(index)(column)(roundStart)(line)(x)(0);
          return new CreateCircle(circle);
        }),
      ),
    ),
  );

  const notes$ = csv$
    .pipe(
      mergeMap((line) =>
        of(line).pipe(
          delay(Math.round(line.start * 100) * 10 + 1000),
          filter((line) => !line.user_played),
          map((line) => new UpdateNote(line)),
        ),
      ),
    )
    .subscribe();

  const key$ = (e: Event, k: Key) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

  // type assertion???
  const keyOne$ = key$("keydown", "KeyH").pipe(
    map(({ code }) => new ClickCircle(code as Key)),
  );
  const keyTwo$ = key$("keydown", "KeyJ").pipe(
    map(({ code }) => new ClickCircle(code as Key)),
  );
  const keyThree$ = key$("keydown", "KeyK").pipe(
    map(({ code }) => new ClickCircle(code as Key)),
  );
  const keyFour$ = key$("keydown", "KeyL").pipe(
    map(({ code }) => new ClickCircle(code as Key)),
  );

  const action$: Observable<Action> = merge(
    gameClock$,
    createCircles$,
    keyOne$,
    keyTwo$,
    keyThree$,
    keyFour$,
  );

  const state$: Observable<State> = action$.pipe(
    scan(reduceState, initialState),
  );

  const updateViewWithArgs = updateView(csvContents)(samples);
  const subscription: Subscription = state$.subscribe(
    updateViewWithArgs(() => subscription.unsubscribe()),
  );
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
