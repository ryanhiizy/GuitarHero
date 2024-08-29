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
import * as Tone from "tone";
import { updateView } from "./view";
import { SampleLibrary } from "./tonejs-instruments";
import { Constants, ClickKey, ExtraKey, Event, State, Action, Note } from "./types";
import { parseCSV, getGroupedNotes, getMinPitch, getMaxPitch, createCircle, RNG, clearCanvas } from "./util";
import { initialState, Tick, reduceState, ClickCircle, GameEnd, Pause, ReleaseCircle } from "./state";
import { from, fromEvent, interval, merge, Observable, of, Subscription, timer } from "rxjs";
import {
  map,
  filter,
  scan,
  mergeMap,
  delay,
  concatMap,
  delayWhen,
  concatWith,
  withLatestFrom,
  tap,
  startWith,
  shareReplay,
  switchMap,
} from "rxjs/operators";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(csvContents: string, samples: { [key: string]: Tone.Sampler }): void {
  const csvArray = parseCSV(csvContents);
  const minPitch = getMinPitch(csvArray);
  const maxPitch = getMaxPitch(csvArray);
  const groupedNotes = getGroupedNotes(csvArray);

  const key$ = (e: "keydown" | "keyup", k: ClickKey | ExtraKey) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

  const pause$ = merge(
    key$("keydown", "KeyP").pipe(map(() => true)),
    key$("keydown", "KeyO").pipe(map(() => false)),
  ).pipe(startWith(false), shareReplay(1));

  const pass$ = pause$.pipe(filter((isPaused) => !isPaused));

  const pauseAction$ = pause$.pipe(map((isPaused) => new Pause(isPaused)));

  const keyAction$ = (e: "keydown" | "keyup") => (f: (code: ClickKey, seed: number) => Action) => (key: ClickKey) =>
    key$(e, key).pipe(
      withLatestFrom(pause$),
      filter(([_, isPaused]) => !isPaused),
      scan((acc, _) => RNG.hash(acc), RNG.hash(Constants.SEED[key])),
      map((seed) => f(key, seed)),
    );

  const keydown$ = keyAction$("keydown")((code, seed) => new ClickCircle(code, seed, samples));
  const keyup$ = keyAction$("keyup")((code) => new ReleaseCircle(code));

  const finalNote = csvArray[csvArray.length - 1];
  const finalDelay = finalNote.end - finalNote.start + 2000;

  const note$ = from(groupedNotes).pipe(
    concatMap(([relativeStartTime, ...notes]) =>
      of(relativeStartTime).pipe(
        delayWhen(() => pass$),
        withLatestFrom(state$),
        delayWhen(([relativeStartTime, state]) => timer(relativeStartTime + state.delay)),
        mergeMap(() =>
          from(notes).pipe(
            withLatestFrom(state$),
            map(([note, state]) => createCircle(minPitch, maxPitch, samples, state.delay, csvArray, note)),
          ),
        ),
      ),
    ),
    concatWith(
      timer(finalDelay).pipe(
        delayWhen(() => pass$),
        delay(2000),
        map(() => new GameEnd()),
      ),
    ),
  );

  const tick$ = interval(Constants.TICK_RATE_MS).pipe(
    concatMap((tick) =>
      of(tick).pipe(
        delayWhen(() => pass$),
        delay(Constants.TICK_RATE_MS),
        map(() => new Tick()),
      ),
    ),
  );

  const action$: Observable<Action> = merge(
    tick$,
    note$,
    keydown$("KeyA"),
    keydown$("KeyS"),
    keydown$("KeyK"),
    keydown$("KeyL"),
    keyup$("KeyA"),
    keyup$("KeyS"),
    keyup$("KeyK"),
    keyup$("KeyL"),
    pauseAction$,
  );

  const state$: Observable<State> = key$("keydown", "KeyR").pipe(
    startWith(null),
    switchMap(() => action$.pipe(scan(reduceState, initialState), startWith(initialState))),
  );

  const subscription: Subscription = state$.subscribe((s) => {
    s === initialState && clearCanvas();
    updateView(s);
  });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.

function showKeys() {
  function showKey(k: ClickKey | ExtraKey) {
    const arrowKey = document.getElementById(k);
    // getElement might be null, in this case return without doing anything
    if (!arrowKey) return;
    const o = (e: Event) => fromEvent<KeyboardEvent>(document, e).pipe(filter(({ code }) => code === k));
    o("keydown").subscribe((e) => arrowKey.classList.add("highlight"));
    o("keyup").subscribe((_) => arrowKey.classList.remove("highlight"));
  }

  showKey("KeyA");
  showKey("KeyS");
  showKey("KeyK");
  showKey("KeyL");
  showKey("KeyP");
  showKey("KeyO");
  showKey("KeyR");
}

if (typeof window !== "undefined") {
  // Load in the instruments and then start your game!
  const samples = SampleLibrary.load({
    instruments: ["bass-electric", "flute", "piano", "saxophone", "trombone", "trumpet", "violin"], // SampleLibrary.list,
    baseUrl: "samples/",
  });

  const startGame = (contents: string) => {
    document.body.addEventListener(
      "mousedown",
      function () {
        main(contents, samples);
        showKeys();
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
