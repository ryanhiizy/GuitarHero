export { updateView };

import { Constants, Star, State, Viewport } from "./types";
import { attr, isNotNullOrUndefined, playRandomNote } from "./util";

const updateView = (s: State): void => {
  /**
   * Show or hide an element based on a condition
   *
   * @see https://stackblitz.com/edit/asteroids2023
   */
  const show = (id: string, condition: boolean) =>
    ((e: HTMLElement | null) => (condition ? e?.classList.remove("hidden") : e?.classList.add("hidden")))(
      document.getElementById(id),
    );

  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement & HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;
  const starDuration = document.querySelector("#starDurationText") as HTMLElement;
  const multiplier = document.querySelector("#multiplierText") as HTMLElement;
  const score = document.querySelector("#scoreText") as HTMLElement;
  const combo = document.querySelector("#comboText") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

  s.playableCircles.forEach((circle) => circle.updateBodyView(svg));
  s.tails.forEach((tail) => tail.updateBodyView(svg));

  s.clickedCircles.forEach((circle) => circle.playNote());

  s.bgCircles
    .filter((circle) => circle.timePassed === Constants.NOTE_TRAVEL_TIME)
    .forEach((circle) => circle.playNote());

  s.random.forEach(playRandomNote);

  // Stop playing hold notes that are were released early
  s.tails.filter((tail) => !tail.isClicked()).forEach((tail) => tail.stopNote());

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

  const starDurationTime = Math.ceil((Star.MAX_DURATION - s.starDuration) / 1000);
  starDuration.textContent = `${s.starDuration === 0 ? 0 : starDurationTime}s`;
  score.textContent = String(Math.round(s.score));
  combo.textContent = String(s.combo);
  multiplier.textContent = `${s.multiplier}x`;

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
