import "./style.css";
import * as Tone from "tone";
import { updateView } from "./view";
import { SampleLibrary } from "./tonejs-instruments";
import {
  Event,
  State,
  Action,
  ClickKey,
  ExtraKey,
  Constants,
  GameSpeedType,
} from "./types";
import {
  Tick,
  Pause,
  GameEnd,
  GameSpeed,
  reduceState,
  ClickCircle,
  initialState,
  ReleaseCircle,
} from "./state";
import {
  RNG,
  parseCSV,
  getMinPitch,
  getMaxPitch,
  clearCanvas,
  createCircle,
  calculateDelay,
  getGroupedNotes,
} from "./util";
import {
  of,
  from,
  merge,
  timer,
  interval,
  fromEvent,
  Observable,
  Subscription,
} from "rxjs";
import {
  map,
  scan,
  take,
  delay,
  filter,
  mergeMap,
  concatMap,
  delayWhen,
  startWith,
  switchMap,
  concatWith,
  shareReplay,
  withLatestFrom,
  distinctUntilChanged,
} from "rxjs/operators";

/**
 * Main game function. Initialises all observable streams.
 *
 * @param csvContents Song data in CSV format
 * @param samples Tone.js sampler instruments
 * @param gameSpeed The speed of the game
 */
export function main(
  csvContents: string,
  samples: { [key: string]: Tone.Sampler },
  gameSpeed: GameSpeedType,
): void {
  const csvArray = parseCSV(csvContents);
  const minPitch = getMinPitch(csvArray);
  const maxPitch = getMaxPitch(csvArray);

  const finalNote = csvArray[csvArray.length - 1];
  // 1000ms is just an arbitrary number to try to make sure the game ends after the last note has completed
  const finalDelay = finalNote.end - finalNote.start + 1000;

  // See function documentation for more information
  const groupedNotes = getGroupedNotes(csvArray);
  const gameDelay = calculateDelay(csvArray, gameSpeed);

  /**
   * Create observables for keydown and keyup events, filtering out repeat events.
   *
   * @see https://stackblitz.com/edit/asteroids2023
   */
  const key$ = (e: Event, k: ClickKey | ExtraKey) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

  // shareReplay(1) is crucial here because applying operators like filter and
  // map on pause$ creates internal subscriptions. Without shareReplay, each of
  // these would only receive the initial value (false) due to startWith(false),
  // leading to incorrect behavior. shareReplay(1) ensures the latest value is
  // replayed to all subscribers, maintaining the correct pause state.
  const pause$ = merge(
    key$("keydown", "KeyP").pipe(map(() => true)),
    key$("keydown", "KeyO").pipe(map(() => false)),
  ).pipe(startWith(false), distinctUntilChanged(), shareReplay(1));

  const pauseAction$ = pause$.pipe(map((isPaused) => new Pause(isPaused)));
  const pass$ = pause$.pipe(filter((isPaused) => !isPaused));

  // keyAction$ creates observables for keydown and keyup events, returning
  // an action based on the key pressed. It also passes a seed to the action
  // and can be paused.
  const keyAction$ =
    (e: Event) =>
    (f: (code: ClickKey, seed: number) => Action) =>
    (key: ClickKey) =>
      key$(e, key).pipe(
        withLatestFrom(pause$),
        filter(([_, isPaused]) => !isPaused),
        // Generate a random seed for each key press
        scan((acc, _) => RNG.hash(acc), RNG.hash(Constants.SEEDS[key])),
        map((seed) => f(key, seed)),
      );

  const keydown$ = keyAction$("keydown")(
    (code, seed) => new ClickCircle(code, seed, samples),
  );
  const keyup$ = keyAction$("keyup")((code) => new ReleaseCircle(code));

  const gameSpeed$ = of(gameDelay).pipe(map((delay) => new GameSpeed(delay)));

  // delayWhen delays the emission of each value until pass$ emits a value,
  // effectively pausing the stream when the game is paused.
  // concatMap ensures that each value is processed one at a time in order,
  // and delay adds a consistent interval between the values, preventing them
  // from being emitted at the same time after resuming.
  const tick$ = interval(Constants.TICK_RATE_MS).pipe(
    concatMap(() =>
      of(null).pipe(
        delayWhen(() => pass$),
        delay(Constants.TICK_RATE_MS),
        map(() => new Tick()),
      ),
    ),
  );

  const note$ = from(groupedNotes).pipe(
    concatMap(([relativeStartTime, ...notes]) =>
      of(relativeStartTime).pipe(
        // Same pause logic as above except delayWhen is used in place of delay
        delayWhen(() => pass$),
        withLatestFrom(state$),
        // This delayWhen is used to provide a dynamic delay between each note
        delayWhen(([relativeStartTime, state]) =>
          timer(relativeStartTime + state.delay),
        ),
        // mergeMap to create circles for the group of notes in parallel
        mergeMap(() =>
          from(notes).pipe(
            withLatestFrom(state$),
            map(([note, state]) =>
              createCircle(
                minPitch,
                maxPitch,
                samples,
                state.delay,
                csvArray,
                note,
              ),
            ),
          ),
        ),
      ),
    ),
    // After all notes have been processed, emit a GameEnd action
    concatWith(
      timer(finalDelay).pipe(
        delayWhen(() => pass$),
        delay(2000),
        map(() => new GameEnd()),
      ),
    ),
  );

  const action$: Observable<Action> = merge(
    gameSpeed$,
    tick$,
    note$,
    pauseAction$,
    keydown$("KeyA"),
    keydown$("KeyS"),
    keydown$("KeyK"),
    keydown$("KeyL"),
    keyup$("KeyA"),
    keyup$("KeyS"),
    keyup$("KeyK"),
    keyup$("KeyL"),
  );

  const state$: Observable<State> = key$("keydown", "KeyR").pipe(
    startWith(null), // To trigger switchMap immediately
    switchMap(() =>
      // startWith provides an initial state for subscription to determine the start of the game
      action$.pipe(scan(reduceState, initialState), startWith(initialState)),
    ),
    shareReplay(1), // Same reasoning as above
  );

  const subscription: Subscription = state$.subscribe((s) => {
    s === initialState && clearCanvas();
    updateView(s);
  });
}

/**
 * Highlight the keys when they are pressed.
 *
 * @see https://stackblitz.com/edit/asteroids2023
 */
const showKeys = () => {
  function showKey(k: ClickKey | ExtraKey) {
    const arrowKey = document.getElementById(k);
    // getElement might be null, in this case return without doing anything
    if (!arrowKey) return;
    const o = (e: Event) =>
      fromEvent<KeyboardEvent>(document, e).pipe(
        filter(({ code }) => code === k),
      );
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
};

// Create an observable that emits the game speed when the corresponding button is clicked
const button$ = (
  buttonId: string,
  speed: GameSpeedType,
): Observable<GameSpeedType> => {
  const button = document.getElementById(buttonId);
  // Return an empty observable if the button is not found
  return button ? fromEvent(button, "click").pipe(map(() => speed)) : of();
};

const slowButton$ = button$("slowButton", "slow");
const defaultButton$ = button$("defaultButton", "default");
const fastButton$ = button$("fastButton", "fast");

const gameStart$ = merge(slowButton$, defaultButton$, fastButton$).pipe(
  take(1),
);

if (typeof window !== "undefined") {
  // Load in the instruments and then start your game!
  const samples = SampleLibrary.load({
    instruments: [
      "bass-electric",
      "flute",
      "piano",
      "saxophone",
      "trombone",
      "trumpet",
      "violin",
    ], // SampleLibrary.list,
    baseUrl: "samples/",
  });

  const { protocol, hostname, port } = new URL(import.meta.url);
  const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

  Tone.ToneAudioBuffer.loaded().then(() => {
    for (const instrument in samples) {
      samples[instrument].toDestination();
      samples[instrument].release = 0.5;
    }

    fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
      .then((response) => response.text())
      .then((csvContents) => {
        gameStart$.subscribe((speed) => {
          main(csvContents, samples, speed);
          showKeys();
        });
      })
      .catch((error) => console.error("Error fetching the CSV file:", error));
  });
}
