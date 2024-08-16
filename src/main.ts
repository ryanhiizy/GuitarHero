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
  timer,
} from "rxjs";
import {
  map,
  filter,
  scan,
  mergeMap,
  delay,
  startWith,
  shareReplay,
  concatMap,
  take,
  tap,
  switchMap,
  withLatestFrom,
  endWith,
  takeWhile,
  finalize,
  delayWhen,
  concatWith,
} from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import {
  Constants,
  ClickKey,
  ExtraKey,
  Event,
  State,
  Action,
  csvLine,
} from "./types";
import { updateView } from "./view";
import { parseCSV, getColumn } from "./util";
import {
  IState,
  Tick,
  reduceState,
  ClickCircle,
  Restart,
  GameEnd,
  Resume,
  Pause,
  createCircle,
  CreateCircle,
} from "./state";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
  csvContents: string,
  samples: { [key: string]: Tone.Sampler },
  state: State = IState,
) {
  const csv = parseCSV(csvContents);
  const pitches = csv
    .filter((line) => line.userPlayed)
    .map((line) => line.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);

  const gameClock$ = interval(Constants.TICK_RATE_MS).pipe(
    map(() => new Tick()),
  );

  const csv$ = from(csv);

  const createCircles$ = csv$.pipe(
    mergeMap((line, index) =>
      of(line).pipe(
        delay(line.start * Constants.S_TO_MS),
        map((line) => {
          const userPlayed = line.userPlayed;
          const column = getColumn(minPitch)(maxPitch)(line.pitch);
          const x = (column + 1) * Constants.COLUMN_WIDTH;
          const circle = createCircle(index)(userPlayed)(column)(line)(x)(0);
          return new CreateCircle(circle);
        }),
      ),
    ),
    concatWith(of(new GameEnd()).pipe(delay(2000))),
  );

  // type acc = {
  //   lines: ReadonlyArray<csvLine>;
  //   currentLine: csvLine | null;
  // };

  // const startTime = performance.now();
  // const gameClock$ = interval(Constants.TICK_RATE_MS).pipe(
  //   scan(
  //     (acc) => {
  //       const currentTime = performance.now();
  //       const elapsedTime = currentTime - startTime;
  //       const [currentLine, ...remainingLines] = acc.lines;

  //       if (
  //         currentLine &&
  //         elapsedTime >= currentLine.start * Constants.S_TO_MS
  //       ) {
  //         return { ...acc, lines: remainingLines, currentLine };
  //       }

  //       return { ...acc, currentLine: null };
  //     },
  //     { lines: [...csv], currentLine: null } as acc,
  //   ),
  //   map((acc) => {
  //     if (acc.currentLine) {
  //       return new Tick(acc.currentLine, minPitch, maxPitch);
  //     } else {
  //       return new Tick(null, minPitch, maxPitch);
  //     }
  //   }),
  //   concatWith(of(new GameEnd()).pipe(delay(2000))),
  // );

  // const gameClock$ = interval(Constants.TICK_RATE_MS).pipe(
  //   scan(
  //     (acc, tickCount) => {
  //       const currentTime = tickCount * Constants.TICK_RATE_MS;
  //       const [currentLine, ...remainingLines] = acc.lines;

  //       if (
  //         currentLine &&
  //         currentTime + 1000 >= currentLine.start * Constants.S_TO_MS
  //       ) {
  //         return { ...acc, lines: remainingLines, currentLine };
  //       }

  //       return { ...acc, currentLine: null };
  //     },
  //     { lines: [...csv], currentLine: null } as acc,
  //   ),
  //   map((acc) => {
  //     if (acc.currentLine) {
  //       return new Tick(acc.currentLine, minPitch, maxPitch);
  //     } else {
  //       return new Tick(null, minPitch, maxPitch);
  //     }
  //   }),
  //   concatWith(of(new GameEnd()).pipe(delay(2000))),
  // );

  // const csv$ = from(csv);
  // delay(300),
  // concatWith(of(new GameEnd()).pipe(delay(2000))),

  // const createCircles$ = csv$.pipe(
  //   mergeMap((line, index) =>
  //     of(line).pipe(
  //       delay(line.start * Constants.S_TO_MS),
  //       map((line) => {
  //         const userPlayed = line.userPlayed;
  //         const column = getColumn(minPitch)(maxPitch)(line.pitch);
  //         const x = (column + 1) * Constants.COLUMN_WIDTH;
  //         const circle = createCircle(index)(userPlayed)(column)(line)(x)(0);
  //         return new CreateCircle(circle);
  //       }),
  //     ),
  //   ),
  //   delay(300),
  //   concatWith(of(new GameEnd()).pipe(delay(2000))),
  // );

  const key$ = (e: Event, k: ClickKey | ExtraKey) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

  // type assertion???
  const keyOne$ = key$("keydown", "KeyA").pipe(
    map(({ code }) => new ClickCircle(code as ClickKey)),
  );
  const keyTwo$ = key$("keydown", "KeyS").pipe(
    map(({ code }) => new ClickCircle(code as ClickKey)),
  );
  const keyThree$ = key$("keydown", "KeyK").pipe(
    map(({ code }) => new ClickCircle(code as ClickKey)),
  );
  const keyFour$ = key$("keydown", "KeyL").pipe(
    map(({ code }) => new ClickCircle(code as ClickKey)),
  );

  const resume$ = key$("keydown", "KeyO").pipe(map(() => true));
  const pause$ = key$("keydown", "KeyP").pipe(map(() => false));
  const pauseResume$ = merge(pause$, resume$).pipe(startWith(true));

  // const resume$ = keyResume$.pipe(map(() => new Resume()));
  // const pause$ = keyPause$.pipe(map(() => new Pause()));

  const keyR$ = key$("keydown", "KeyR");
  const restart$ = key$("keydown", "KeyR").pipe(
    map(() => {
      return new Restart();
    }),
  );

  const nonRestartActions$: Observable<Action> = merge(
    gameClock$,
    createCircles$,
    keyOne$,
    keyTwo$,
    keyThree$,
    keyFour$,
    // resume$,
    // pause$,
  ).pipe(
    withLatestFrom(pauseResume$),
    filter(([_, isResumed]) => isResumed),
    map(([action, _]) => action),
  );

  const action$: Observable<Action> = merge(nonRestartActions$, restart$);

  const state$: Observable<State> = action$.pipe(scan(reduceState, state));

  const updateViewWithArgs = updateView(csvContents)(samples);

  const subscription: Subscription = state$.subscribe(
    updateViewWithArgs((restart: boolean, state: State) => {
      subscription.unsubscribe();
      if (restart) {
        main(csvContents, samples, state);
      } else {
        const keyRSubscription: Subscription = keyR$
          .pipe(
            concatMap((event) =>
              of(event).pipe(tap(() => main(csvContents, samples, state))),
            ),
            tap(() => keyRSubscription.unsubscribe()),
          )
          .subscribe();
      }
    }),
  );
}

function showKeys() {
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
