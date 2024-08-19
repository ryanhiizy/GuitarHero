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
import { SampleLibrary } from "./tonejs-instruments";
import { updateView } from "./view";
import {
  parseCSV,
  getColumn,
  getGroupedNotes,
  getRelativeGroupedNotes,
} from "./util";
import {
  BehaviorSubject,
  from,
  fromEvent,
  interval,
  merge,
  Observable,
  of,
  Subscription,
} from "rxjs";
import {
  map,
  filter,
  scan,
  mergeMap,
  mergeWith,
  delay,
  concatMap,
  delayWhen,
  concatWith,
} from "rxjs/operators";
import {
  Constants,
  ClickKey,
  ExtraKey,
  Event,
  State,
  Action,
  Note,
} from "./types";
import {
  IState,
  Tick,
  reduceState,
  ClickCircle,
  Restart,
  GameEnd,
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

  const groupedNotes = getGroupedNotes(csv);

  const relativeGroupedNotes = getRelativeGroupedNotes(groupedNotes);

  const key$ = (e: Event, k: ClickKey | ExtraKey) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat),
    );

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

  const keyR$ = key$("keydown", "KeyR");
  const restart$ = keyR$.pipe(
    map(() => {
      return new Restart();
    }),
  );

  const resumeKey$ = key$("keydown", "KeyO").pipe(map(() => false));
  const pauseKey$ = key$("keydown", "KeyP").pipe(map(() => true));
  const pauseResume$ = merge(pauseKey$, resumeKey$).subscribe((isPaused) =>
    pause$.next(isPaused),
  );

  const pause$ = new BehaviorSubject<boolean>(false);
  const pass$ = pause$.pipe(filter((isPaused) => !isPaused));
  const pauseObj$ = pause$.pipe(
    map((isPaused) => (isPaused ? new Pause(true) : new Pause(false))),
  );

  const getID = (note: Note) =>
    parseFloat(`${note.velocity}${note.pitch}${note.start}`);

  const notes$ = from(relativeGroupedNotes).pipe(
    concatMap((group) =>
      of(group[0]).pipe(
        delayWhen(() => pass$),
        delay(group[0] as number),
        mergeMap(() =>
          from(group.slice(1) as ReadonlyArray<Note>).pipe(
            map((note) => {
              const ID = getID(note);
              const userPlayed = note.userPlayed;
              const column = getColumn(minPitch, maxPitch, note.pitch);
              const x = (column + 1) * Constants.COLUMN_WIDTH;
              const circle = createCircle(ID, userPlayed, column, note, x);
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
    mergeWith(keyOne$, keyTwo$, keyThree$, keyFour$, pauseObj$),
  );

  const action$: Observable<Action> = merge(
    ticks$,
    notes$,
    keyOne$,
    keyTwo$,
    keyThree$,
    keyFour$,
    pauseObj$,
    restart$,
  );

  const state$: Observable<State> = action$.pipe(scan(reduceState, state));

  const subscription: Subscription = state$.subscribe(
    updateView(samples, (restart: boolean, state: State) => {
      subscription.unsubscribe();
      if (restart) {
        main(csvContents, samples, state);
      } else {
        const keyRSubscription: Subscription = keyR$
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

// function showKeys() {
//   function showKey(k: ClickKey | ExtraKey) {
//     const arrowKey = document.getElementById(k);
//     // getElement might be null, in this case return without doing anything
//     if (!arrowKey) return;
//     const o = (e: Event) =>
//       fromEvent<KeyboardEvent>(document, e).pipe(
//         filter(({ code }) => code === k),
//       );
//     o("keydown").subscribe((e) => arrowKey.classList.add("highlight"));
//     o("keyup").subscribe((_) => arrowKey.classList.remove("highlight"));
//   }

//   showKey("KeyA");
//   showKey("KeyS");
//   showKey("KeyK");
//   showKey("KeyL");
//   showKey("KeyP");
//   showKey("KeyO");
//   showKey("KeyR");
// }

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
  // Load in the instruments and then start your game!
  const samples = SampleLibrary.load({
    instruments: [
      "bass-electric",
      "bassoon",
      "cello",
      "clarinet",
      "contrabass",
      "flute",
      "french-horn",
      "guitar-acoustic",
      "guitar-electric",
      "guitar-nylon",
      "harmonium",
      "harp",
      "organ",
      "piano",
      "saxophone",
      "trombone",
      "trumpet",
      "tuba",
      "violin",
      "xylophone",
    ], // SampleLibrary.list,
    baseUrl: "samples/",
  });

  const startGame = (contents: string) => {
    document.body.addEventListener(
      "mousedown",
      function () {
        main(contents, samples);
        // showKeys();
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
