import { GoldMinerGame } from "./game.js";
import { UIController } from "./ui.js";

const canvas = document.querySelector("#game-canvas");
const scoreEl = document.querySelector("#score");
const targetEl = document.querySelector("#target-score");
const timeEl = document.querySelector("#time-left");
const overlayEl = document.querySelector("#overlay");
const overlayTitleEl = document.querySelector("#overlay-title");
const overlayTextEl = document.querySelector("#overlay-text");
const startBtn = document.querySelector("#start-btn");
const restartBtn = document.querySelector("#restart-btn");

const ui = new UIController({
  scoreEl,
  targetEl,
  timeEl,
  overlayEl,
  overlayTitleEl,
  overlayTextEl,
  startBtn,
  restartBtn
});

const game = new GoldMinerGame(canvas, ui);

function bindEvents() {
  startBtn.addEventListener("click", () => game.start());
  restartBtn.addEventListener("click", () => game.restart());

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") {
      return;
    }
    event.preventDefault();
    game.fireHook();
  });
}

async function init() {
  bindEvents();
  await game.init();
}

init();
