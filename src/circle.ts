export { Circle, HitCircle, Tail, BackgroundCircle, PlayableCircle, HoldCircle };

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
} from "./types";
import { attr } from "./util";

abstract class Circle implements ICircle {
	constructor(
		public readonly id: number,
		public readonly note: Note,
		public readonly sampler: Tone.Sampler,
	) {}

	apply(s: State): State {
		return {
			...s,
			circles: [...s.circles, this],
		};
	}

	playNote() {
		const note = this.note;
		const normalizedVelocity = Math.min(Math.max(note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

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

		const newHitCircles = moveActiveCircle ? [...s.playableCircles, moveActiveCircle] : s.playableCircles;
		const newExit = expiredCircle ? [...s.exit, expiredCircle] : s.exit;

		return {
			...s,
			playableCircles: newHitCircles,
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
		return this.cy <= Constants.EXPIRED_Y;
	}

	abstract moveCircle(): T;
	abstract incrementComboOnClick(): boolean;
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

	moveCircle(): IHitCircle {
		return new HitCircle(this.id, this.note, this.column, this.sampler, this.cy + Constants.TRAVEL_Y_PER_TICK);
	}

	incrementComboOnClick(): boolean {
		return true;
	}

	setClicked(isClicked: boolean): IHitCircle {
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
		const normalizedVelocity = Math.min(Math.max(note.velocity, 0), 1) / Constants.MAX_MIDI_VELOCITY;

		this.sampler.triggerAttack(Tone.Frequency(note.pitch, "midi").toNote(), undefined, normalizedVelocity);
	}

	moveCircle(): IHoldCircle {
		return new HoldCircle(this.id, this.note, this.column, this.sampler, this.cy + Constants.TRAVEL_Y_PER_TICK);
	}

	incrementComboOnClick(): boolean {
		return false;
	}

	setClicked(isClicked: boolean): IHoldCircle {
		return new HoldCircle(this.id, this.note, this.column, this.sampler, this.cy, isClicked);
	}
}

class Tail implements ITail {
	constructor(
		public readonly id: string,
		public readonly x: number,
		public readonly y1: number,
		public readonly y2: number,
		public readonly circle: IHoldCircle,
		public readonly isReleasedEarly: boolean = false,
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
		const circle = this.circle;
		const movedY1 = this.y1 + Constants.TRAVEL_Y_PER_TICK;
		const newY1 = circle.isClicked && !this.isReleasedEarly ? Math.min(movedY1, Constants.POINT_Y) : movedY1;
		const movedY2 = this.y2 + Constants.TRAVEL_Y_PER_TICK;
		const newY2 = circle.isClicked && !this.isReleasedEarly ? Math.min(movedY2, Constants.POINT_Y) : movedY2;

		return new Tail(this.id, this.x, newY1, newY2, circle, this.isReleasedEarly);
	}

	setReleasedEarly(): ITail {
		return new Tail(this.id, this.x, this.y1, this.y2, this.circle, true);
	}

	setUnclicked(): ITail {
		return new Tail(this.id, this.x, this.y1, this.y2, this.circle.setClicked(false), this.isReleasedEarly);
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
				"stroke-width": "18",
				"stroke-linecap": "round",
			});
			rootSVG.appendChild(tail);
			return tail;
		};

		const tail = document.getElementById(this.id) || createTailSVG();
		attr(tail, {
			y1: this.y1,
			y2: this.y2,
			"stroke-opacity": this.y2 === Constants.POINT_Y && this.circle.isClicked ? "1" : "0.25",
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
