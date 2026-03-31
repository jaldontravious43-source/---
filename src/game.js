import { GAME_CONFIG, HERO_IMAGE, ITEM_CONFIGS } from "./config.js";
import { Hook } from "./hook.js";
import { applyInkCorrosion, createItems, drawItems, hitTestCircle, updateItems } from "./items.js";

export class GoldMinerGame {
  constructor(canvas, uiController) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = uiController;
    this.state = "idle";
    this.score = 0;
    this.timeLeft = GAME_CONFIG.roundSeconds;
    this.targetScore = GAME_CONFIG.targetScore;
    this.lastFrameTime = 0;
    this.animationFrameId = null;
    this.items = [];
    this.imageCache = {};
    this.wavePhase = 0;
    this.rescuedHusbandCount = 0;
    this.scorePopups = [];
    this.inkClouds = [];

    const fullReachLength = Math.hypot(GAME_CONFIG.width / 2, GAME_CONFIG.height - 110) + 100;
    this.hook = new Hook(
      { x: GAME_CONFIG.width / 2, y: 110 },
      { minAngle: -0.95, maxAngle: 0.95, maxLength: fullReachLength, swingSpeed: 1.85 }
    );
  }

  async init() {
    await this.loadImages();
    this.resetRound();
    this.ui.showStart();
    this.render();
  }

  async loadImages() {
    const uniquePaths = new Set([HERO_IMAGE]);
    Object.values(ITEM_CONFIGS).forEach((item) => uniquePaths.add(item.image));

    const tasks = [...uniquePaths].map(
      (path) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            this.imageCache[path] = image;
            resolve();
          };
          image.onerror = () => {
            console.warn(`[assets] image not found: ${path}, fallback drawing will be used.`);
            resolve();
          };
          image.src = path;
        })
    );

    await Promise.all(tasks);
  }

  resetRound() {
    this.state = "idle";
    this.score = 0;
    this.timeLeft = GAME_CONFIG.roundSeconds;
    this.items = createItems({
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height,
      groundY: GAME_CONFIG.groundY
    });
    this.rescuedHusbandCount = 0;
    this.scorePopups = [];
    this.inkClouds = [];
    this.hook.length = 0;
    this.hook.state = "idle";
    this.hook.caughtItem = null;
    this.ui.updateHUD({
      score: this.score,
      targetScore: this.targetScore,
      timeLeft: this.timeLeft
    });
  }

  start() {
    this.resetRound();
    this.state = "running";
    this.ui.hideOverlay();
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  restart() {
    this.start();
  }

  fireHook() {
    if (this.state !== "running") {
      return;
    }
    this.hook.fire();
  }

  loop = (timestamp) => {
    const deltaTime = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000);
    this.lastFrameTime = timestamp;

    if (this.state === "running") {
      this.update(deltaTime);
    }
    this.render();

    if (this.state === "running") {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };

  update(deltaTime) {
    this.wavePhase += deltaTime * 1.7;
    this.timeLeft = Math.max(0, this.timeLeft - deltaTime);
    this.updateScorePopups(deltaTime);
    this.updateInkClouds(deltaTime);
    updateItems(this.items, deltaTime, { width: GAME_CONFIG.width }, this.hook);

    const hookEvent = this.hook.update(deltaTime, {
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height
    });

    if (this.hook.state === "extending" && !this.hook.caughtItem) {
      const tip = this.hook.getTipPosition();
      const hitItem = this.items.find((item) =>
        hitTestCircle(
          { x: tip.x, y: tip.y, r: this.hook.tipRadius },
          { x: item.x, y: item.y, r: item.radius }
        )
      );
      if (hitItem) {
        if (hitItem.typeKey === "angryOctopus") {
          this.triggerInkCloud(hitItem);
        }
        this.hook.attachItem(hitItem);
      }
    }

    if (hookEvent.deliveredItem) {
      const deltaScore = hookEvent.deliveredItem.score;
      this.score += deltaScore;
      if (hookEvent.deliveredItem.typeKey === "husband") {
        this.rescuedHusbandCount += 1;
      }
      this.scorePopups.push({
        x: this.hook.anchor.x + 10,
        y: this.hook.anchor.y - 20,
        text: `${deltaScore >= 0 ? "+" : ""}${deltaScore}`,
        life: 1.05,
        isPenalty: deltaScore < 0
      });
      this.items = this.items.filter((item) => item.id !== hookEvent.deliveredItem.id);
    }

    this.ui.updateHUD({
      score: this.score,
      targetScore: this.targetScore,
      timeLeft: this.timeLeft
    });

    if (this.timeLeft <= 0) {
      this.finishRound();
    }
  }

  finishRound() {
    this.state = "finished";
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.ui.showResult({ score: this.score, targetScore: this.targetScore });
  }

  updateScorePopups(deltaTime) {
    this.scorePopups = this.scorePopups
      .map((popup) => ({
        ...popup,
        y: popup.y - 38 * deltaTime,
        life: popup.life - deltaTime
      }))
      .filter((popup) => popup.life > 0);
  }

  updateInkClouds(deltaTime) {
    this.inkClouds = this.inkClouds
      .map((cloud) => {
        const age = cloud.age + deltaTime;
        const lifeLeft = cloud.life - deltaTime;
        const driftX = Math.sin(age * 1.35 + cloud.seed) * 11 * deltaTime;
        const driftY = (Math.cos(age * 0.95 + cloud.seed * 1.7) * 6 + 4) * deltaTime;
        return {
          ...cloud,
          age,
          life: lifeLeft,
          x: cloud.x + driftX,
          y: cloud.y + driftY
        };
      })
      .filter((cloud) => cloud.life > 0);
  }

  triggerInkCloud(octopusItem) {
    const center = { x: octopusItem.x, y: octopusItem.y };
    const life = 1.55;
    const blobCount = 8;
    const blobs = Array.from({ length: blobCount }, (_, index) => ({
      angle: (Math.PI * 2 * index) / blobCount + Math.random() * 0.5,
      drift: 18 + Math.random() * 28,
      offset: Math.random() * 14,
      radiusStart: octopusItem.radius * (0.34 + Math.random() * 0.18),
      radiusEnd: octopusItem.radius * (1.45 + Math.random() * 1.25)
    }));

    this.inkClouds.push({
      x: center.x,
      y: center.y,
      life,
      maxLife: life,
      age: 0,
      seed: Math.random() * Math.PI * 2,
      blobs
    });

    const { remainingItems } = applyInkCorrosion(
      this.items,
      center,
      GAME_CONFIG.octopusInkRadius,
      [octopusItem.id]
    );
    this.items = remainingItems;
  }

  renderBackground() {
    this.ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    const waterGradient = this.ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.height);
    waterGradient.addColorStop(0, "#84d6ff");
    waterGradient.addColorStop(0.18, "#4cb6e8");
    waterGradient.addColorStop(0.62, "#15709b");
    waterGradient.addColorStop(1, "#0b3f5d");
    this.ctx.fillStyle = waterGradient;
    this.ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    const shoreGradient = this.ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.groundY);
    shoreGradient.addColorStop(0, "#9fd2ff");
    shoreGradient.addColorStop(0.55, "#84c5ef");
    shoreGradient.addColorStop(1, "#ccb08d");
    this.ctx.fillStyle = shoreGradient;
    this.ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.groundY);

    this.ctx.fillStyle = "#d9c09a";
    this.ctx.fillRect(0, GAME_CONFIG.groundY - 14, GAME_CONFIG.width, 18);

    this.ctx.fillStyle = "#6f5a49";
    this.ctx.fillRect(0, GAME_CONFIG.height - 105, GAME_CONFIG.width, 105);

    for (let line = 0; line < 3; line += 1) {
      const y = GAME_CONFIG.groundY + 34 + line * 24;
      const amplitude = 5 + line;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 - line * 0.04})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      for (let x = 0; x <= GAME_CONFIG.width; x += 16) {
        const waveY = y + Math.sin(x * 0.018 + this.wavePhase * (1.2 + line * 0.25)) * amplitude;
        if (x === 0) this.ctx.moveTo(x, waveY);
        else this.ctx.lineTo(x, waveY);
      }
      this.ctx.stroke();
    }
  }

  renderHero() {
    const hero = this.imageCache[HERO_IMAGE];
    if (hero) {
      this.ctx.drawImage(hero, GAME_CONFIG.width / 2 - 70, 20, 140, 140);
      this.renderRescuedHusband();
      return;
    }

    this.ctx.fillStyle = "#5b3ed5";
    this.ctx.beginPath();
    this.ctx.arc(GAME_CONFIG.width / 2, 88, 52, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "18px Microsoft YaHei";
    this.ctx.textAlign = "center";
    this.ctx.fillText("邪恶小女孩", GAME_CONFIG.width / 2, 93);
    this.renderRescuedHusband();
  }

  renderRescuedHusband() {
    if (this.rescuedHusbandCount <= 0) return;
    const husbandImage = this.imageCache["assets/images/husband.jpg"] || this.imageCache["assets/images/husband.png"];
    const maxShow = Math.min(this.rescuedHusbandCount, 3);
    for (let index = 0; index < maxShow; index += 1) {
      const x = GAME_CONFIG.width / 2 + 85 + index * 36;
      const y = 76;
      const radius = 16;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.clip();

      if (husbandImage) {
        const side = Math.min(husbandImage.naturalWidth || husbandImage.width, husbandImage.naturalHeight || husbandImage.height);
        const sourceX = ((husbandImage.naturalWidth || husbandImage.width) - side) / 2;
        const sourceY = ((husbandImage.naturalHeight || husbandImage.height) - side) / 2;
        this.ctx.drawImage(husbandImage, sourceX, sourceY, side, side, x - radius, y - radius, radius * 2, radius * 2);
      } else {
        this.ctx.fillStyle = "#ff6aa0";
        this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      this.ctx.restore();

      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  renderHook() {
    const realTip = this.hook.getTipPosition();
    const idleLength = 85;
    const displayTip =
      this.hook.state === "idle"
        ? {
            x: this.hook.anchor.x + Math.sin(this.hook.angle) * idleLength,
            y: this.hook.anchor.y + Math.cos(this.hook.angle) * idleLength
          }
        : realTip;

    this.ctx.strokeStyle = "#f1f2ff";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(this.hook.anchor.x, this.hook.anchor.y);
    this.ctx.lineTo(displayTip.x, displayTip.y);
    this.ctx.stroke();

    this.ctx.fillStyle = "#ffd45b";
    this.ctx.beginPath();
    this.ctx.arc(displayTip.x, displayTip.y, 7, 0, Math.PI * 2);
    this.ctx.fill();

    const clawOpen = this.hook.state === "idle" ? 0.62 : 0.36;
    const clawLength = 18;
    this.ctx.strokeStyle = "#f7cf54";
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = "round";
    const ropeTheta = Math.atan2(displayTip.y - this.hook.anchor.y, displayTip.x - this.hook.anchor.x);
    const leftAngle = ropeTheta + Math.PI - clawOpen;
    const rightAngle = ropeTheta + Math.PI + clawOpen;

    this.ctx.beginPath();
    this.ctx.moveTo(displayTip.x, displayTip.y);
    this.ctx.lineTo(
      displayTip.x + Math.cos(leftAngle) * clawLength,
      displayTip.y + Math.sin(leftAngle) * clawLength
    );
    this.ctx.moveTo(displayTip.x, displayTip.y);
    this.ctx.lineTo(
      displayTip.x + Math.cos(rightAngle) * clawLength,
      displayTip.y + Math.sin(rightAngle) * clawLength
    );
    this.ctx.stroke();
  }

  renderScorePopups() {
    this.ctx.save();
    this.ctx.font = "bold 28px Microsoft YaHei";
    this.ctx.textAlign = "left";
    this.scorePopups.forEach((popup) => {
      const alpha = Math.max(0, Math.min(1, popup.life));
      this.ctx.fillStyle = popup.isPenalty ? `rgba(255, 132, 132, ${alpha})` : `rgba(255, 231, 122, ${alpha})`;
      this.ctx.strokeStyle = popup.isPenalty ? `rgba(76, 9, 16, ${alpha})` : `rgba(18, 21, 43, ${alpha})`;
      this.ctx.lineWidth = 5;
      this.ctx.strokeText(popup.text, popup.x, popup.y);
      this.ctx.fillText(popup.text, popup.x, popup.y);
    });
    this.ctx.restore();
  }

  renderInkClouds() {
    if (!this.inkClouds.length) return;
    this.ctx.save();

    this.inkClouds.forEach((cloud) => {
      const t = 1 - cloud.life / cloud.maxLife;
      const alpha = (1 - t) * 0.42;
      cloud.blobs.forEach((blob, blobIndex) => {
        const grow = blob.radiusStart + (blob.radiusEnd - blob.radiusStart) * t;
        const distance = blob.offset + blob.drift * t;
        const jitter = Math.sin(cloud.age * 3 + blobIndex * 1.3 + cloud.seed) * 4;
        const bx = cloud.x + Math.cos(blob.angle) * (distance + jitter);
        const by = cloud.y + Math.sin(blob.angle) * (distance * 0.82 + jitter * 0.6);
        const gradient = this.ctx.createRadialGradient(bx, by, 0, bx, by, grow);
        gradient.addColorStop(0, `rgba(31, 20, 44, ${alpha})`);
        gradient.addColorStop(0.45, `rgba(37, 24, 54, ${alpha * 0.64})`);
        gradient.addColorStop(1, "rgba(37, 24, 54, 0)");
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(bx, by, grow, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });
    this.ctx.restore();
  }

  render() {
    this.renderBackground();
    drawItems(this.ctx, this.items, this.imageCache);
    this.renderInkClouds();
    this.renderHero();
    this.renderHook();
    this.renderScorePopups();
  }
}
