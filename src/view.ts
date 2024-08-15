export { createSvgElement, hide, show, updateView };

import * as Tone from "tone";
import { Circle, Constants, Note, State, Viewport } from "./types";
import { attr, isNotNullOrUndefined, parseCSV, playNote } from "./util";

/** Rendering (side effects) */

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
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {},
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

const updateView =
  (csvContents: string) =>
  (samples: { [key: string]: Tone.Sampler }) =>
  (onFinish: () => void) => {
    return (state: State): void => {
      const csv = parseCSV(csvContents);
      const pitches = csv.map((line) => line.pitch);
      const minPitch = Math.min(...pitches);
      const maxPitch = Math.max(...pitches);
      const columnSize = Math.ceil(
        (maxPitch - minPitch) / Constants.NUMBER_OF_COLUMNS,
      );

      // Canvas elements
      const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;
      const preview = document.querySelector(
        "#svgPreview",
      ) as SVGGraphicsElement & HTMLElement;
      const gameover = document.querySelector(
        "#gameOver",
      ) as SVGGraphicsElement & HTMLElement;
      const container = document.querySelector("#main") as HTMLElement;

      svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
      svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

      // Text fields
      const multiplier = document.querySelector(
        "#multiplierText",
      ) as HTMLElement;
      const scoreText = document.querySelector("#scoreText") as HTMLElement;
      const highScoreText = document.querySelector(
        "#highScoreText",
      ) as HTMLElement;

      const updateBodyView = (rootSVG: HTMLElement) => (circle: Circle) => {
        function createBodyView() {
          const element = document.createElementNS(
            rootSVG.namespaceURI,
            "circle",
          );
          const color = Constants.NOTE_COLORS[circle.column];
          attr(element, {
            id: circle.id,
            r: Note.RADIUS,
            cx: `${circle.x}%`,
            style: `fill: ${color}`,
            class: "shadow",
          });
          rootSVG.appendChild(element);
          return element;
        }

        const element =
          document.getElementById(String(circle.id)) || createBodyView();
        attr(element, { cy: circle.y });

        if (circle.y >= 350) {
          hide(element as SVGGraphicsElement); // type assertion????
        }
      };

      if (state.hitCircle) {
        const element = document.getElementById(String(state.hitCircle.id));
        if (element) {
          playNote(samples)(state.hitCircle.note);
          document.getElementById(String(state.hitCircle.id))?.remove();
        }
      }

      state.playableCircles.forEach(updateBodyView(svg));
      state.backgroundCircles
        .filter((circle) => circle.duration === 1000)
        .forEach((circle) => playNote(samples)(circle.note));

      state.exit
        .map((circle) => {
          return document.getElementById(String(circle.id));
        })
        .filter(isNotNullOrUndefined)
        .forEach((circle) => {
          try {
            svg.removeChild(circle);
          } catch (e) {
            console.log("Already removed: " + circle.id);
          }
        });

      scoreText.textContent = String(state.score);

      if (state.gameEnd) {
        show(gameover);
        onFinish();
      }
    };
  };
