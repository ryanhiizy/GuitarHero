export { createSvgElement, hide, show, updateView };

import * as Tone from "tone";
import { Circle, Constants, Note, State, Viewport } from "./types";
import {
  attr,
  getColumn,
  getNonOverlappingColumn,
  isNotNullOrUndefined,
  not,
  parseCSV,
  playNote,
} from "./util";

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
  (onFinish: (restart: boolean) => void) => {
    return (state: State): void => {
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
          const previousCircles = Array.from({ length: 4 });
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

        // if (circle.y >= 350) {
        //   hide(element as SVGGraphicsElement); // type assertion????
        // }
      };

      if (state.hitCircle) {
        const element = document.getElementById(String(state.hitCircle.id));
        if (element) {
          console.log("HIT");
          document.getElementById(String(state.hitCircle.id))?.remove();
          playNote(samples)(state.hitCircle.note);
        }
      }

      // console.log(state.playableCircles);
      // const columns = Array.from({ length: 4 }) as ReadonlyArray<
      //   Circle | undefined // type assertion again???
      // >;
      // const nonOverlappingColumn = getNonOverlappingColumn(columns);
      // const overlap = (circle: Circle) => circle.y === 0;

      // state.playableCircles
      //   .filter(overlap)
      //   .map(nonOverlappingColumn)
      //   .forEach(({ circle, column }) =>
      //     updateBodyView(svg)({ ...circle, column }),
      //   );

      // state.playableCircles.filter(not(overlap)).forEach(updateBodyView(svg));

      state.playableCircles.forEach(updateBodyView(svg));

      state.backgroundCircles
        .filter((circle) => circle.duration === 500)
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

      if (state.restart) {
        const circles = document.querySelectorAll("[class=shadow]");
        circles.forEach((circle) => circle.remove());
        // main(csvContents, samples); // even though this doesn't run in the beginning, this line causes there to be two instances of the game running at the same time
        onFinish(true);
      }

      if (state.gameEnd) {
        show(gameover);
        onFinish(false);
      }
    };
  };
