export { updateView };

import * as Tone from "tone";
import { Circle, Constants, NoteConstants, State, Viewport } from "./types";
import { attr, isNotNullOrUndefined, playNote } from "./util";
import { initialState } from "./state";

/** Rendering (side effects) */

const updateView = (samples: { [key: string]: Tone.Sampler }, onFinish: (restart: boolean, state: State) => void) => {
  return (state: State): void => {
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

    // Show or hide paused state
    if (state.paused) {
      show(paused);
    } else {
      hide(paused);
    }

    // Update body view
    const updateBodyView = (rootSVG: HTMLElement) => (circle: Circle) => {
      function createBodyView() {
        const element = document.createElementNS(rootSVG.namespaceURI, "circle");
        const color = Constants.NOTE_COLORS[circle.column];
        attr(element, {
          id: circle.id,
          r: NoteConstants.RADIUS,
          cx: `${circle.x}%`,
          // style: `fill: ${color}`,
          // class: "playable outline",
          class: "playable",
          fill: `url(#${color}Gradient)`,
          stroke: "transparent",
          "stroke-width": "2",
        });
        rootSVG.appendChild(element);
        return element;
      }

      const element = document.getElementById(String(circle.id)) || createBodyView();
      attr(element, { cy: circle.y });
    };

    // Handle hit circles
    state.hitCircles.forEach((circle) => {
      const element = document.getElementById(String(circle.id));
      if (element) {
        svg.removeChild(element);
        // console.log("remove", performance.now());
        playNote(samples, circle.note);
      }
    });

    // Update playable circles
    state.playableCircles.forEach(updateBodyView(svg));

    // Play notes for background circles
    state.backgroundCircles
      .filter((circle) => circle.duration === Constants.TRAVEL_MS)
      .forEach((circle) => playNote(samples, circle.note));

    // Remove exited circles
    state.exit
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
    highScoreText.textContent = String(state.highscore);
    scoreText.textContent = String(Math.round(state.score));
    comboText.textContent = String(state.combo);
    multiplier.textContent = `${state.multiplier}x`;

    // Clear circles
    const clearCircles = () => {
      const circles = document.querySelectorAll(".playable");
      circles.forEach((circle) => {
        circle.remove();
      });
    };

    // Handle game over and restart
    hide(gameover);

    if (state.restart) {
      clearCircles();
      onFinish(true, { ...initialState, highscore: state.highscore });
    }

    if (state.gameEnd) {
      show(gameover);
      clearCircles();
      onFinish(false, {
        ...initialState,
        highscore: Math.max(state.score, state.highscore),
      });
    }
  };
};
