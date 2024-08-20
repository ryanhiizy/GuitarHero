export { createCircle, Circle, HitCircle, HoldCircle, BackgroundCircle };

import * as Tone from "tone";
import { getColumn, getID } from "./util";
import {
  Constants,
  Note,
  State,
  ICircle,
  IHitCircle,
  IBackgroundCircle,
  Action,
  IHoldCircle,
} from "./types";

function createCircle(note: Note, minPitch: number, maxPitch: number): Circle {
  const ID = getID(note);

  if (note.userPlayed) {
    const column = getColumn(minPitch, maxPitch, note.pitch);
    const duration = note.end - note.start;

    if (duration > 1000) {
      return new HoldCircle(ID, note, column, duration);
    }
    return new HitCircle(ID, note, column, duration);
  } else {
    return new BackgroundCircle(ID, note);
  }
}

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

  abstract tick(s: State): State;
}

class HitCircle extends Circle implements IHitCircle {
  public readonly cx: number;

  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly duration: number,
    public readonly cy: number = 0,
    public readonly isHit: boolean = false,
  ) {
    super(id, note);
    this.cx = (column + 1) * Constants.COLUMN_WIDTH;
  }

  tick(s: State): State {
    const expiredCircle = !this.isActive() ? this : null;
    const moveActiveCircle = this.isActive() ? this.moveCircle() : null;

    const newHitCircles = moveActiveCircle
      ? [...s.hitCircles, moveActiveCircle]
      : s.hitCircles;
    const newExit = expiredCircle ? [...s.exit, expiredCircle] : s.exit;

    return {
      ...s,
      hitCircles: newHitCircles,
      exit: newExit,
    };
  }

  isActive(): boolean {
    return this.cy <= Constants.EXPIRED_Y;
  }

  moveCircle(): IHitCircle {
    return new HitCircle(
      this.id,
      this.note,
      this.column,
      this.cy + Constants.TRAVEL_Y_PER_TICK,
    );
  }

  playNote(samples: { [key: string]: Tone.Sampler }) {
    const normalizedVelocity =
      Math.min(Math.max(this.note.velocity, 0), 1) /
      Constants.MAX_MIDI_VELOCITY;

    samples[this.note.instrumentName].triggerAttackRelease(
      Tone.Frequency(this.note.pitch, "midi").toNote(),
      this.duration,
      undefined,
      normalizedVelocity,
    );
  }
}

class HoldCircle extends HitCircle implements IHoldCircle {
  public readonly synth: Tone.Synth<Tone.SynthOptions>;

  constructor(
    public readonly id: number,
    public readonly note: Note,
    public readonly column: number,
    public readonly duration: number,
    public readonly cy: number = 0,
    public readonly isHit: boolean = false,
  ) {
    super(id, note, column, duration);
    this.synth = new Tone.Synth().toDestination();
  }

  playNote(samples: { [key: string]: Tone.Sampler }) {
    const normalizedVelocity =
      Math.min(Math.max(this.note.velocity, 0), 1) /
      Constants.MAX_MIDI_VELOCITY;

    samples[this.note.instrumentName].triggerAttack(
      Tone.Frequency(this.note.pitch, "midi").toNote(),
      undefined,
      normalizedVelocity,
    );
  }

  stopNote(samples: { [key: string]: Tone.Sampler }) {
    samples[this.note.instrumentName].triggerRelease(
      Tone.Frequency(this.note.pitch, "midi").toNote(),
    );
  }
}

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

    const newBackgroundCircles = updateBackgroundCircle
      ? [...s.backgroundCircles, updateBackgroundCircle]
      : s.backgroundCircles;

    return {
      ...s,
      backgroundCircles: newBackgroundCircles,
    };
  }

  isActive(): boolean {
    return this.timePassed + Constants.TICK_RATE_MS <= Constants.TRAVEL_MS;
  }

  tickCircle(): IBackgroundCircle {
    return new BackgroundCircle(
      this.id,
      this.note,
      this.timePassed + Constants.TICK_RATE_MS,
    );
  }
}
