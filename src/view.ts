export { updateView };

import * as Tone from "tone";
import { initialState } from "./state";
import { attr, isNotNullOrUndefined } from "./util";
import { Constants, ITail, NoteConstants, State, Viewport } from "./types";

/** Rendering (side effects) */

const updateView = (samples: { [key: string]: Tone.Sampler }, onFinish: (restart: boolean, s: State) => void) => {
  return (s: State): void => {
    /**
     * Displays a SVG element on the canvas. Brings to foreground.
     * @param elem SVG element to display
     */
    const show = (elem: SVGGraphicsElement) => {
      elem.setAttribute("visibility", "visible");
      elem.parentNode!.appendChild(elem);
    };

    /**
     * Hides a SVG element on the canvas.
     * @param elem SVG element to hide
     */
    const hide = (elem: SVGGraphicsElement) => elem.setAttribute("visibility", "hidden");

    // Canvas elements
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement & HTMLElement;
    const preview = document.querySelector("#svgPreview") as SVGGraphicsElement & HTMLElement;
    const gameover = document.querySelector("#gameOver") as SVGGraphicsElement & HTMLElement;
    const container = document.querySelector("#main") as HTMLElement;
    const paused = document.querySelector("#paused") as SVGGraphicsElement & HTMLElement;

    // Text fields
    const multiplier = document.querySelector("#multiplierText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;
    const highScoreText = document.querySelector("#highScoreText") as HTMLElement;
    const comboText = document.querySelector("#comboText") as HTMLElement;

    // Update canvas size
    svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
    svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

    // Handle clicked circles
    s.clickedCircles
      .map((circle) => document.getElementById(String(circle.id)))
      .filter(isNotNullOrUndefined)
      .forEach((element, index) => {
        svg.removeChild(element);
        s.clickedCircles[index].playNote();
      });

    // Update playable circles
    s.playableCircles.forEach((circle) => circle.updateBodyView(svg));

    // Play notes for background circles
    s.bgCircles.filter((circle) => circle.timePassed === Constants.TRAVEL_MS).forEach((circle) => circle.playNote());

    s.tails.forEach((tail) => tail.updateBodyView(svg));
    s.tails.filter((tail) => tail.isReleasedEarly).forEach((tail) => tail.stopNote());

    // Remove exited circles
    s.exit
      .map((circle) => document.getElementById(String(circle.id)))
      .filter(isNotNullOrUndefined)
      .forEach((element) => svg.removeChild(element));

    s.exitTails
      .map((circle) => document.getElementById(String(circle.id)))
      .filter(isNotNullOrUndefined)
      .forEach((element, index) => {
        svg.removeChild(element);
        s.exitTails[index].stopNote();
      });

    // Update text fields
    highScoreText.textContent = String(s.highscore);
    scoreText.textContent = String(Math.round(s.score));
    comboText.textContent = String(s.combo);
    multiplier.textContent = `${s.multiplier}x`;

    // Clear circles
    const clearCircles = () => {
      const circles = document.querySelectorAll(".playable");
      circles.forEach((circle) => circle.remove());
    };

    const stopReleasedEarlyNotes = (tails: ReadonlyArray<ITail>) =>
      tails.filter((tail) => tail.isReleasedEarly).forEach((tail) => tail.stopNote());

    s.paused ? (show(paused), stopReleasedEarlyNotes(s.tails)) : hide(paused);

    hide(gameover);

    s.restart &&
      (clearCircles(), stopReleasedEarlyNotes(s.tails), onFinish(true, { ...initialState, highscore: s.highscore }));

    s.gameEnd &&
      (show(gameover),
      clearCircles(),
      onFinish(false, {
        ...initialState,
        highscore: Math.max(s.score, s.highscore),
      }));
  };
};
