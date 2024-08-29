export { Circle, HitCircle, Tail, BackgroundCircle, PlayableCircle, HoldCircle, StarCircle };

import * as Tone from "tone";
import {
  Constants,
  Note,
  State,
  ICircle,
  IBackgroundCircle,
  Action,
  NoteConstants,
  IHitCircle,
  ITail,
  IPlayableCircle,
  IHoldCircle,
  IStarCircle,
} from "./types";
import { attr, calculateMultiplier, generateRandomDurationNote } from "./util";

abstract class Circle implements ICircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly sampler: Tone.Sampler,
  ) {}

  apply(s: State): State {
    // console.log(this.note.start);
    return {
      ...s,
      circles: [...s.circles, this],
    };
  }

  playNote() {
    const note = this.note;
    const normalizedVelocity = note.velocity / Constants.MAX_MIDI_VELOCITY / 2;

    this.sampler.triggerAttackRelease(
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
    public readonly sampler: Tone.Sampler,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, sampler);
    this.cx = (column + 1) * Constants.COLUMN_WIDTH;
  }

  tick(s: State): State {
    const expiredCircle = !this.isActive() ? this : null;
    const moveActiveCircle = this.isActive() ? this.moveCircle() : null;

    const newPlayableCircles = moveActiveCircle ? [...s.playableCircles, moveActiveCircle] : s.playableCircles;
    const newExit = expiredCircle ? [...s.exit, expiredCircle] : s.exit;

    this.id === 80670 && console.log(expiredCircle, moveActiveCircle);

    return {
      ...s,
      playableCircles: newPlayableCircles,
      exit: newExit,
    };
  }

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
    return this.cy <= Constants.EXPIRED_Y && !this.isClicked;
  }

  abstract onClick(s: State): State;
  abstract moveCircle(): T;
  abstract setRandomDuration(): T;
  abstract setClicked(isClicked: boolean): T;
}

class HitCircle extends PlayableCircle<IHitCircle> implements IHitCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly sampler: Tone.Sampler,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, column, sampler);
  }

  onClick(s: State): State {
    const newCombo = s.combo + 1;
    const newMultiplier = calculateMultiplier(newCombo, s.multiplier);
    const newScore = s.score + Constants.SCORE_PER_HIT * newMultiplier;
    return {
      ...s,
      score: newScore,
      multiplier: newMultiplier,
      combo: newCombo,
    };
  }

  moveCircle(): IHitCircle {
    return new HitCircle(
      this.id,
      this.note,
      this.column,
      this.sampler,
      this.cy + Constants.TRAVEL_Y_PER_TICK,
      this.isClicked,
    );
  }

  setRandomDuration(): IHitCircle {
    const randomNote = generateRandomDurationNote(this.note);

    return new HitCircle(this.id, randomNote, this.column, this.sampler, this.cy, this.isClicked);
  }

  setClicked(isClicked: boolean): IHitCircle {
    console.log("setClicked", this, isClicked);
    return new HitCircle(this.id, this.note, this.column, this.sampler, this.cy, isClicked);
  }
}

class HoldCircle extends PlayableCircle<IHoldCircle> implements IHoldCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly sampler: Tone.Sampler,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, column, sampler);
  }

  playNote() {
    const note = this.note;
    const normalizedVelocity = note.velocity / Constants.MAX_MIDI_VELOCITY / 2;

    this.sampler.triggerAttack(Tone.Frequency(note.pitch, "midi").toNote(), undefined, normalizedVelocity);
  }

  onClick(s: State): State {
    return s;
  }

  moveCircle(): IHoldCircle {
    return new HoldCircle(
      this.id,
      this.note,
      this.column,
      this.sampler,
      this.cy + Constants.TRAVEL_Y_PER_TICK,
      this.isClicked,
    );
  }

  setRandomDuration(): IHoldCircle {
    const randomNote = generateRandomDurationNote(this.note);

    return new HoldCircle(this.id, randomNote, this.column, this.sampler, this.cy, this.isClicked);
  }

  setClicked(isClicked: boolean): IHoldCircle {
    return new HoldCircle(this.id, this.note, this.column, this.sampler, this.cy, isClicked);
  }
}

class StarCircle extends PlayableCircle<IStarCircle> implements IStarCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly sampler: Tone.Sampler,
    public readonly cy: number = 0,
    public readonly isClicked: boolean = false,
  ) {
    super(id, note, column, sampler);
  }

  updateBodyView(rootSVG: HTMLElement) {
    const createCircleSVG = () => {
      const circle = document.createElementNS(rootSVG.namespaceURI, "circle");
      attr(circle, {
        id: this.id,
        r: NoteConstants.RADIUS,
        cx: `${this.cx}%`,
        class: NoteConstants.CLASS_NAME + " star",
        fill: Constants.STAR_COLOR,
      });
      rootSVG.appendChild(circle);
      return circle;
    };
    const circle = document.getElementById(String(this.id)) || createCircleSVG();
    attr(circle, {
      cy: this.cy,
    });
  }

  onClick(s: State): State {
    const newCombo = s.combo + 1;
    const newMultiplier = calculateMultiplier(newCombo, s.multiplier);
    const newScore = s.score + Constants.SCORE_PER_HIT * newMultiplier;
    return {
      ...s,
      score: newScore,
      multiplier: s.starPhase ? newMultiplier : newMultiplier + Constants.STAR_MULTIPLIER,
      combo: newCombo,
      starPhase: true,
      starDuration: 0,
      delay: s.starPhase ? s.delay : s.delay + Constants.STAR_DELAY,
    };
  }

  moveCircle(): IStarCircle {
    return new StarCircle(
      this.id,
      this.note,
      this.column,
      this.sampler,
      this.cy + Constants.TRAVEL_Y_PER_TICK,
      this.isClicked,
    );
  }

  setRandomDuration(): IStarCircle {
    const randomNote = generateRandomDurationNote(this.note);

    return new StarCircle(this.id, randomNote, this.column, this.sampler, this.cy, this.isClicked);
  }

  setClicked(isClicked: boolean): IStarCircle {
    return new StarCircle(this.id, this.note, this.column, this.sampler, this.cy, isClicked);
  }
}

class Tail implements ITail {
  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y1: number,
    public readonly y2: number,
    public readonly circle: IHoldCircle,
  ) {}

  apply(s: State): State {
    return {
      ...s,
      circles: [...s.circles, this.circle],
      tails: [...s.tails, this],
    };
  }

  tick(s: State): State {
    const expiredTail = !this.isActive() ? this : null;
    const moveActiveTail = this.isActive() ? this.moveTail() : null;

    const newTails = moveActiveTail ? [moveActiveTail, ...s.tails] : s.tails.filter((tail) => tail !== this);
    const newExitTails = expiredTail ? [...s.exitTails, expiredTail] : s.exitTails;

    return {
      ...s,
      tails: newTails,
      exitTails: newExitTails,
    };
  }

  stopNote(): void {
    this.circle.sampler.triggerRelease(Tone.Frequency(this.circle.note.pitch, "midi").toNote(), undefined);
  }

  isActive(): boolean {
    return this.y1 < Constants.POINT_Y;
  }

  moveTail(): Tail {
    const movedY1 = this.y1 + Constants.TRAVEL_Y_PER_TICK;
    const newY1 = this.isClicked() ? Math.min(movedY1, Constants.POINT_Y) : movedY1;
    const movedY2 = this.y2 + Constants.TRAVEL_Y_PER_TICK;
    const newY2 = this.isClicked() ? Math.min(movedY2, Constants.POINT_Y) : movedY2;

    return new Tail(this.id, this.x, newY1, newY2, this.circle);
  }

  isClicked(): boolean {
    return this.circle.isClicked;
  }

  setUnclicked(): ITail {
    return new Tail(this.id, this.x, this.y1, this.y2, this.circle.setClicked(false));
  }

  updateBodyView(rootSVG: HTMLElement) {
    const color = Constants.NOTE_COLORS[this.circle.column];
    const createTailSVG = () => {
      const tail = document.createElementNS(rootSVG.namespaceURI, "line");
      attr(tail, {
        id: this.id,
        x1: `${this.x}%`,
        y1: `${this.y1}%`,
        x2: `${this.x}%`,
        y2: `${this.y2}%`,
        class: "playable",
        stroke: color,
        "stroke-opacity": "0.25",
        "stroke-width": "12",
        "stroke-linecap": "round",
      });
      rootSVG.appendChild(tail);
      return tail;
    };

    const tail = document.getElementById(this.id) || createTailSVG();
    attr(tail, {
      y1: this.y1,
      y2: this.y2,
      "stroke-opacity": this.y2 === Constants.POINT_Y && this.isClicked() ? "1" : "0.25",
    });
  }
}

class BackgroundCircle extends Circle implements IBackgroundCircle {
  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly sampler: Tone.Sampler,
    public readonly timePassed: number = 0,
  ) {
    super(id, note, sampler);
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
    return new BackgroundCircle(this.id, this.note, this.sampler, this.timePassed + Constants.TICK_RATE_MS);
  }
}
