export { updateView };

import { GameEnd, initialState } from "./state";
import { attr, isNotNullOrUndefined, playRandomNote } from "./util";
import { Constants, ITail, NoteConstants, State, Viewport } from "./types";

/** Rendering (side effects) */

const updateView = (s: State): void => {
  /**
   * Displays a SVG element on the canvas. Brings to foreground.
   * @param elem SVG element to display
   */
  const show = (id: string, condition: boolean) =>
    ((e: HTMLElement | null) => (condition ? e?.classList.remove("hidden") : e?.classList.add("hidden")))(
      document.getElementById(id),
    );

  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement & HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement & HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement & HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;
  const paused = document.querySelector("#paused") as SVGGraphicsElement & HTMLElement;

  // Text fields
  const starDuration = document.querySelector("#starDurationText") as HTMLElement;
  const multiplier = document.querySelector("#multiplierText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;
  const comboText = document.querySelector("#comboText") as HTMLElement;

  // Update canvas size
  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

  // Handle clicked circles
  s.clickedCircles.forEach((circle) => circle.playNote());

  // Update playable circles
  s.playableCircles.forEach((circle) => circle.updateBodyView(svg));

  // Play notes for background circles
  s.bgCircles.filter((circle) => circle.timePassed === Constants.TRAVEL_MS).forEach((circle) => circle.playNote());

  s.tails.forEach((tail) => tail.updateBodyView(svg));
  s.tails.filter((tail) => !tail.isClicked()).forEach((tail) => tail.stopNote());

  s.random.forEach(playRandomNote);

  // Remove exited circles
  s.exit
    .map((circle) => document.getElementById(String(circle.id)))
    .filter(isNotNullOrUndefined)
    .forEach((element) => svg.removeChild(element));

  s.exitTails
    .map((tail) => {
      tail.stopNote();
      return document.getElementById(String(tail.id));
    })
    .filter(isNotNullOrUndefined)
    .forEach((element) => svg.removeChild(element));

  const starDurationTime = Math.ceil((Constants.STAR_DURATION - s.starDuration) / 1000);

  // Update text fields
  starDuration.textContent = `${s.starDuration === 0 ? 0 : starDurationTime}s`;
  scoreText.textContent = String(Math.round(s.score));
  comboText.textContent = String(s.combo);
  multiplier.textContent = `${s.multiplier}x`;

  if (s.starPhase) {
    container.style.boxShadow = "0em 0em 0.5em rgb(0, 255, 255)";
  } else {
    container.style.boxShadow = "0em 0em 0.5em rgb(20, 20, 20)";
  }

  s.paused && s.tails.forEach((tail) => tail.stopNote());
  show("paused", s.paused);
  show("gameOver", s.gameEnd);

  show("slowButton", false);
  show("defaultButton", false);
  show("fastButton", false);
};
