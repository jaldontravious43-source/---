export class UIController {
  constructor(elements) {
    this.scoreEl = elements.scoreEl;
    this.targetEl = elements.targetEl;
    this.timeEl = elements.timeEl;
    this.overlayEl = elements.overlayEl;
    this.overlayTitleEl = elements.overlayTitleEl;
    this.overlayTextEl = elements.overlayTextEl;
    this.startBtn = elements.startBtn;
    this.restartBtn = elements.restartBtn;
  }

  updateHUD({ score, targetScore, timeLeft }) {
    this.scoreEl.textContent = `${Math.max(0, Math.floor(score))}`;
    this.targetEl.textContent = `${targetScore}`;
    this.timeEl.textContent = `${Math.max(0, Math.ceil(timeLeft))}`;
  }

  showStart() {
    this.overlayEl.classList.remove("hidden");
    this.startBtn.classList.remove("hidden");
    this.restartBtn.classList.add("hidden");
    this.overlayTitleEl.textContent = "邪恶小女孩出击";
    this.overlayTextEl.textContent = "按空格发钩，抓住你的目标！";
  }

  showResult({ score, targetScore }) {
    this.overlayEl.classList.remove("hidden");
    this.startBtn.classList.add("hidden");
    this.restartBtn.classList.remove("hidden");
    const isWin = score >= targetScore;
    this.overlayTitleEl.textContent = isWin ? "你赢了！" : "差一点点";
    this.overlayTextEl.textContent = `本局得分 ${score}，目标分 ${targetScore}`;
  }

  hideOverlay() {
    this.overlayEl.classList.add("hidden");
  }
}
