export { updateView };

import * as Tone from "tone";
import { initialState } from "./state";
import { attr, isNotNullOrUndefined } from "./util";
import { Constants, NoteConstants, State, Viewport } from "./types";

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
    s.clickedCircles.forEach((circle) => {
      const element = document.getElementById(String(circle.id));
      if (element) {
        svg.removeChild(element);
        circle.playNote(samples);
      }
    });

    // Update playable circles
    s.playableCircles.forEach((circle) => circle.updateBodyView(svg));

    // Play notes for background circles
    s.bgCircles
      .filter((circle) => circle.timePassed === Constants.TRAVEL_MS)
      .forEach((circle) => circle.playNote(samples));

    // Remove exited circles
    s.exit
      .map((circle) => document.getElementById(String(circle.id)))
      .filter(isNotNullOrUndefined)
      .forEach((circle) => {
        try {
          svg.removeChild(circle);
        } catch (e) {
          console.log("Already removed: " + circle.id);
        }
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

    s.paused ? show(paused) : hide(paused);

    hide(gameover);

    s.restart && (clearCircles(), onFinish(true, { ...initialState, highscore: s.highscore }));

    s.gameEnd &&
      (show(gameover),
      clearCircles(),
      onFinish(false, {
        ...initialState,
        highscore: Math.max(s.score, s.highscore),
      }));
  };
};
