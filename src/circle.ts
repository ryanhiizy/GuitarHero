export { Circle, HitCircle, HoldCircle, BackgroundCircle };

import * as Tone from "tone";
import {
  Constants,
  Note,
  State,
  ICircle,
  IHitCircle,
  IBackgroundCircle,
  Action,
  IHoldCircle,
  NoteConstants,
  PlayableCircleType,
  IPlayableCircle,
  ITail,
} from "./types";
import { attr } from "./util";

abstract class Circle implements ICircle, Action {
  constructor(
    public readonly id: number,
    public readonly note: Note,
  ) {}

  apply(s: State): State {
    return {
      ...s,
      circles: [...s.circles, this],
    };
  }

  playNote(samples: { [key: string]: Tone.Sampler }) {
    const note = this.note;
    const normalizedVelocity = Math.min(Math.max(note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

    samples[note.instrumentName].triggerAttackRelease(
      Tone.Frequency(note.pitch, "midi").toNote(),
      note.end - note.start,
      undefined,
      normalizedVelocity,
    );
  }

  abstract tick(s: State): State;
}

abstract class PlayableCircle<T extends IPlayableCircle<T>> extends Circle {
  public readonly cx: number;

  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note);
    this.cx = (column + 1) * Constants.COLUMN_WIDTH;
  }

  tick(s: State): State {
    const expiredCircle = !this.isActive() ? this : null;
    const moveActiveCircle = this.isActive() ? this.moveCircle() : null;

    const newHitCircles = moveActiveCircle ? [...s.playableCircles, moveActiveCircle] : s.playableCircles;
    const newExit = expiredCircle ? [...s.exit, expiredCircle] : s.exit;

    return {
      ...s,
      playableCircles: newHitCircles,
      exit: newExit,
    };
  }

  abstract moveCircle(): T;
  abstract incrementComboOnClick(): boolean;
  abstract setClicked(isClicked: boolean): T;

  updateBodyView(rootSVG: HTMLElement) {
    const color = Constants.NOTE_COLORS[this.column];
    const createCircleSVG = () => {
      const circle = document.createElementNS(rootSVG.namespaceURI, "circle");
      attr(circle, {
        id: this.id,
        r: NoteConstants.RADIUS,
        cx: `${this.cx}%`,
        class: NoteConstants.CLASS_NAME,
        fill: color,
      });
      rootSVG.appendChild(circle);
      return circle;
    };
    const circle = document.getElementById(String(this.id)) || createCircleSVG();
    attr(circle, {
      cy: this.cy,
    });
  }

  isActive(): boolean {
    return this.cy <= Constants.EXPIRED_Y;
  }
}

class HitCircle extends PlayableCircle<IHitCircle> implements IHitCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, column);
  }

  incrementComboOnClick(): boolean {
    return true;
  }

  moveCircle(): IHitCircle {
    return new HitCircle(this.id, this.note, this.column, this.cy + Constants.TRAVEL_Y_PER_TICK);
  }

  setClicked(isClicked: boolean): IHitCircle {
    return new HitCircle(this.id, this.note, this.column, this.cy, isClicked);
  }
}

class HoldCircle extends PlayableCircle<IHoldCircle> implements IHoldCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly duration: number,
    public readonly sampler: Tone.Sampler,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, column, cy, isClicked);
  }

  incrementComboOnClick(): boolean {
    return false;
  }

  playNote = (samples: { [key: string]: Tone.Sampler }) => (circle: ICircle) => {
    const normalizedVelocity = Math.min(Math.max(this.note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

    samples[this.note.instrumentName].triggerAttack(
      Tone.Frequency(this.note.pitch, "midi").toNote(),
      undefined,
      normalizedVelocity,
    );
  };

  stopNote(samples: { [key: string]: Tone.Sampler }) {
    samples[this.note.instrumentName].triggerRelease(Tone.Frequency(this.note.pitch, "midi").toNote());
  }

  moveCircle(): IHoldCircle {
    return new HoldCircle(
      this.id,
      this.note,
      this.column,
      this.duration,
      this.sampler,
      this.cy + Constants.TRAVEL_Y_PER_TICK,
    );
  }

  setClicked(isClicked: boolean): IHoldCircle {
    return new HoldCircle(this.id, this.note, this.column, this.duration, this.sampler, this.cy, isClicked);
  }

  updateBodyView(rootSVG: HTMLElement): void {
    super.updateBodyView(rootSVG);
    this.tail.updateBodyView;
  }
}

class Tail implements ITail {
  constructor(
    public readonly id: string,
    public readonly x1: number,
    public readonly y1: number,
    public readonly x2: number,
    public readonly y2: number,
    public readonly circle: IHoldCircle,
    public readonly isReleasedEarly: boolean,
  ) {}

  updateBodyView = (rootSVG: HTMLElement) => (t: ITail) => {
    const color = Constants.NOTE_COLORS[t.circle.column];
    function createTailSVG() {
      const tail = document.createElementNS(rootSVG.namespaceURI, "line");
      attr(tail, {
        id: t.id,
        x1: `${t.x1}%`,
        y1: `${t.y2}%`,
        x2: `${t.x2}%`,
        y2: `${t.y2}%`,
        class: "playable",
        stroke: color,
        "stroke-opacity": "0.25",
        "stroke-width": "12",
        "stroke-linecap": "round",
      });
      rootSVG.appendChild(tail);
      return tail;
    }

    const tail = document.getElementById(t.id) || createTailSVG();
    attr(tail, {
      y1: t.y1,
      y2: t.y2,
      "stroke-opacity": t.y2 === Constants.POINT_Y ? "1" : "0.25",
    });
  };
}

///////////////////////
// Background Circle //
///////////////////////
///////////////////////
// Background Circle //
///////////////////////
///////////////////////
// Background Circle //
///////////////////////
///////////////////////
// Background Circle //
///////////////////////
///////////////////////
// Background Circle //
///////////////////////

class BackgroundCircle extends Circle implements IBackgroundCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly timePassed: number = 0,
  ) {
    super(id, note);
  }

  tick(s: State): State {
    const updateBackgroundCircle = this.isActive() ? this.tickCircle() : null;

    const newBackgroundCircles = updateBackgroundCircle ? [...s.bgCircles, updateBackgroundCircle] : s.bgCircles;

    return {
      ...s,
      bgCircles: newBackgroundCircles,
    };
  }

  isActive(): boolean {
    return this.timePassed + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS;
  }

  tickCircle(): IBackgroundCircle {
    return new BackgroundCircle(this.id, this.note, this.timePassed + Constants.TICK_RATE_MS);
  }
}
