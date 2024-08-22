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
import { parseCSV, getGroupedNotes, getMinPitch, getMaxPitch, createCircle } from "./util";
import { map, filter, scan, mergeMap, delay, concatMap, delayWhen, concatWith, tap } from "rxjs/operators";
import { BehaviorSubject, from, fromEvent, interval, merge, Observable, of, Subscription } from "rxjs";
import { initialState, Tick, reduceState, ClickCircle, Restart, GameEnd, Pause, CreateCircle, KeyUp } from "./state";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(csvContents: string, samples: { [key: string]: Tone.Sampler }, state: State = initialState) {
  const csvArray = parseCSV(csvContents);
  const minPitch = getMinPitch(csvArray);
  const maxPitch = getMaxPitch(csvArray);
  const groupedNotes = getGroupedNotes(csvArray);

  const pauseBehaviour$ = new BehaviorSubject<boolean>(false);
  const pass$ = pauseBehaviour$.pipe(filter((isPaused) => !isPaused));
  const pauseStatus$ = pauseBehaviour$.pipe(map((isPaused) => (isPaused ? new Pause(true) : new Pause(false))));

  const key$ = (e: Event, k: ClickKey | ExtraKey) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

  const actionKey$ = (e: Event) => (f: (code: ClickKey) => Action) => (key: ClickKey) => {
    return key$(e, key).pipe(
      delayWhen(() => pass$),
      map(({ code }) => f(code as ClickKey)),
    );
  };

  const keydown$ = actionKey$("keydown")((code) => new ClickCircle(code));
  const keyDownOne$ = keydown$("KeyA");
  const keyDownTwo$ = keydown$("KeyS");
  const keyDownThree$ = keydown$("KeyK");
  const keyDownFour$ = keydown$("KeyL");

  const keyup$ = actionKey$("keyup")((code) => new KeyUp(code));
  const keyUpOne$ = keyup$("KeyA");
  const keyUpTwo$ = keyup$("KeyS");
  const keyUpThree$ = keyup$("KeyK");
  const keyUpFour$ = keyup$("KeyL");

  const restart$ = key$("keydown", "KeyR").pipe(map(() => new Restart()));
  const resumeKey$ = key$("keydown", "KeyO").pipe(map(() => false));
  const pauseKey$ = key$("keydown", "KeyP").pipe(map(() => true));

  merge(pauseKey$, resumeKey$).subscribe((isPaused) => pauseBehaviour$.next(isPaused));

  const notes$ = from(groupedNotes).pipe(
    concatMap((group) =>
      of(group[0]).pipe(
        delayWhen(() => pass$),
        delay(group[0] as number),
        mergeMap(() =>
          from(group.slice(1) as ReadonlyArray<Note>).pipe(
            map((note) => {
              const circle = createCircle(note, minPitch, maxPitch, samples);
              return new CreateCircle(circle);
            }),
          ),
        ),
      ),
    ),
    concatWith(of(new GameEnd()).pipe(delay(2000))),
  );

  const ticks$ = interval(Constants.TICK_RATE_MS).pipe(
    concatMap((tick) =>
      of(tick).pipe(
        delayWhen(() => pass$),
        delay(Constants.TICK_RATE_MS),
        map(() => new Tick()),
      ),
    ),
  );

  const action$: Observable<Action> = merge(
    ticks$,
    notes$,
    keyDownOne$,
    keyDownTwo$,
    keyDownThree$,
    keyDownFour$,
    keyUpOne$,
    keyUpTwo$,
    keyUpThree$,
    keyUpFour$,
    pauseStatus$,
    restart$,
  );

  const state$: Observable<State> = action$.pipe(scan(reduceState, state));

  const subscription: Subscription = state$.subscribe(
    updateView(samples, (restart: boolean, state: State) => {
      subscription.unsubscribe();

      if (restart) {
        main(csvContents, samples, state);
      } else {
        const keyRSubscription: Subscription = key$("keydown", "KeyR")
          .pipe(
            map(() => {
              main(csvContents, samples, state);
              keyRSubscription.unsubscribe();
            }),
          )
          .subscribe();
      }
    }),
  );
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
