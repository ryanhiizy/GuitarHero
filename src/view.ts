export { updateView };

import { Constants, Star, State, Viewport } from "./types";
import { attr, isNotNullOrUndefined, playRandomNote } from "./util";

/**
 * Update the SVG game view.
 *
 * @param s the current game model State
 */
const updateView = (s: State): void => {
  /**
   * Show or hide an element based on a condition.
   *
   * @param id the id of the element to show or hide
   * @param condition the condition to determine if the element should be shown or hidden
   *
   * @see https://stackblitz.com/edit/asteroids2023
   */
  const show = (id: string, condition: boolean) =>
    ((e: HTMLElement | null) =>
      condition ? e?.classList.remove("hidden") : e?.classList.add("hidden"))(
      document.getElementById(id),
    );

  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;
  const starDuration = document.querySelector(
    "#starDurationText",
  ) as HTMLElement;
  const multiplier = document.querySelector("#multiplierText") as HTMLElement;
  const score = document.querySelector("#scoreText") as HTMLElement;
  const combo = document.querySelector("#comboText") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

  const remainingStarTime = Math.ceil(
    (Star.MAX_DURATION - s.starDuration) / 1000,
  );

  // Remaining star time is not 0s when the star phase is inactive so we need to check for that
  starDuration.textContent = `${s.starDuration === 0 ? 0 : remainingStarTime}s`;
  score.textContent = String(Math.round(s.score));
  combo.textContent = String(s.combo);
  multiplier.textContent = `${s.multiplier}x`;

  s.playableCircles.forEach((circle) => circle.updateBodyView(svg));
  s.tails.forEach((tail) => tail.updateBodyView(svg));

  s.clickedCircles.forEach((circle) => circle.playNote());

  // Play background circles that have reached the end of their travel time
  s.bgCircles
    .filter((circle) => circle.timePassed === Constants.TRAVEL_TIME)
    .forEach((circle) => circle.playNote());

  s.random.forEach(playRandomNote);

  // Stop playing hold circles that were released early
  s.tails
    .filter((tail) => !tail.isClicked())
    .forEach((tail) => tail.stopNote());

  s.exit
    .map((circle) => document.getElementById(String(circle.id)))
    .filter(isNotNullOrUndefined)
    .forEach((element) => svg.removeChild(element));

  s.exitTails
    .map((tail) => {
      tail.stopNote();
      return document.getElementById(tail.id);
    })
    .filter(isNotNullOrUndefined)
    .forEach((element) => svg.removeChild(element));

  s.starPhase
    ? attr(container, {
        class: "flex row starPhase",
      })
    : attr(container, {
        class: "flex row",
      });

  s.paused && s.tails.forEach((tail) => tail.stopNote());

  show("paused", s.paused);
  show("gameOver", s.gameEnd);
  show("slowButton", false);
  show("defaultButton", false);
  show("fastButton", false);
};
