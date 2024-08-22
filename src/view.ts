export { updateView };

import * as Tone from "tone";
import { Circle, Constants, NoteConstants, State, Tail, Viewport } from "./types";
import { attr, clearCircles, isNotNullOrUndefined, playNote, startNote, stopNote } from "./util";
import { initialState } from "./state";

/** Rendering (side effects) */

const updateView = (samples: { [key: string]: Tone.Sampler }, onFinish: (restart: boolean, state: State) => void) => {
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

    // Update body view
    const updateCircleBodyView = (rootSVG: HTMLElement) => (c: Circle) => {
      const color = Constants.NOTE_COLORS[c.column];
      function createCircleSVG() {
        const circle = document.createElementNS(rootSVG.namespaceURI, "circle");
        attr(circle, {
          id: c.id,
          r: NoteConstants.RADIUS,
          cx: `${c.x}%`,
          class: "playable outline",
          fill: color,
          // fill: `url(#${color}Gradient)`,
          // "stroke-width": "2",
        });
        rootSVG.appendChild(circle);
        return circle;
      }

      const circle = document.getElementById(String(c.id)) || createCircleSVG();
      attr(circle, {
        cy: c.y,
      });
    };

    const updateTailBodyView = (rootSVG: HTMLElement) => (t: Tail) => {
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

    s.hitCircles.forEach(updateCircleBodyView(svg));
    s.holdCircles.forEach(updateCircleBodyView(svg));
    s.bgCircles.filter((circle) => circle.time === Constants.TRAVEL_MS).forEach(playNote(samples));
    s.tails.forEach(updateTailBodyView(svg));

    s.clickedHitCircles.forEach((circle) => {
      const element = document.getElementById(String(circle.id));
      if (element) {
        svg.removeChild(element);
        playNote(samples)(circle);
      }
    });

    s.clickedHoldCircles.forEach((circle) => {
      const element = document.getElementById(String(circle.id));
      if (element) {
        svg.removeChild(element);
        startNote(circle);
      }
    });

    s.tails.filter((tail) => tail.isReleasedEarly).forEach((tail) => stopNote(tail.circle));

    // can use the null thing
    s.exitTails.forEach((tail) => {
      const tailSVG = document.getElementById(tail.id);
      if (tailSVG) {
        svg.removeChild(tailSVG);
        stopNote(tail.circle);
      }
    });

    s.exit.forEach((circle) => {
      const circleSVG = document.getElementById(String(circle.id));
      if (circleSVG) {
        svg.removeChild(circleSVG);
        if (circle.userPlayed) {
          stopNote(circle);
        }
      }
    });

    // Update text fields
    highScoreText.textContent = String(s.highscore);
    scoreText.textContent = String(Math.round(s.score));
    comboText.textContent = String(s.combo);
    multiplier.textContent = `${s.multiplier}x`;

    if (s.paused) {
      show(paused);
      s.tails.filter((tail) => tail.isReleasedEarly).forEach((tail) => stopNote(tail.circle));
    } else {
      hide(paused);
    }

    // Handle game over and restart
    hide(gameover);

    if (s.restart) {
      clearCircles();
      s.tails.filter((tail) => tail.isReleasedEarly).forEach((tail) => stopNote(tail.circle));
      onFinish(true, { ...initialState, highscore: s.highscore });
    }

    if (s.gameEnd) {
      show(gameover);
      clearCircles();
      onFinish(false, {
        ...initialState,
        highscore: Math.max(s.score, s.highscore),
      });
    }
  };
};
