import { canStartRound, canSubmitScore, getInitAuthPolicy, shouldPromptLoginForRecords, shouldRequireNickname } from "./game-access.js";

const INTERACTIVE_TAGS = new Set(["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A", "LABEL"]);
const INTERACTIVE_SELECTOR = "button, input, textarea, select, a, label, [data-no-fire]";

export function isInteractiveTarget(target) {
  if (!target) return false;
  if (typeof target.closest === "function") {
    return Boolean(target.closest(INTERACTIVE_SELECTOR));
  }
  const tagName = String(target.tagName || "").toUpperCase();
  return INTERACTIVE_TAGS.has(tagName);
}

export function createOneTimeUnlocker(play) {
  let unlocked = false;
  return () => {
    if (unlocked) return;
    unlocked = true;
    if (typeof play === "function") {
      play();
    }
  };
}

export function createTapToFireHandler({
  fireHook,
  unlockAudio,
  shouldIgnoreTarget = isInteractiveTarget,
  isCanvasTarget = null
}) {
  return (event) => {
    const target = event?.target ?? null;
    if (shouldIgnoreTarget && shouldIgnoreTarget(target)) {
      return;
    }
    if (typeof isCanvasTarget === "function" && !isCanvasTarget(target)) {
      return;
    }
    if (event?.cancelable) {
      event.preventDefault();
    }
    if (typeof unlockAudio === "function") {
      unlockAudio();
    }
    if (typeof fireHook === "function") {
      fireHook();
    }
  };
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("load", () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
(function (global) {
  "use strict";

  const SUPABASE_CONFIG = {
    url: "https://bkhccodrqyiesweghhsc.supabase.co",
    anonKey: "sb_publishable_vqG9GOJ8TLuhXAhCb2rZ5w_fRTbmSnN",
    tableName: "game_scores"
  };

  const STORAGE_KEYS = {
    lastPhone: "evilgirl:last-phone",
    lastNickname: "evilgirl:last-nickname"
  };

  const GAME_CONFIG = {
    width: 1280,
    height: 720,
    roundSeconds: 60,
    targetScore: 1500,
    groundY: 170,
    angryOctopusPenalty: 200,
    octopusInkRadius: 140
  };

  const HERO_IMAGE = "assets/images/evil-girl.jpg";

  const ITEM_CONFIGS = {
    starHandsome: {
      name: "明星帅哥",
      score: 300,
      radius: 42,
      speed: 16,
      pullSpeed: 350,
      spawnCount: 4,
      spriteScale: 1.18,
      image: "assets/images/star-handsome.jpg",
      color: "#ffd85e"
    },
    hamster: {
      name: "我的仓鼠",
      score: 120,
      radius: 20,
      speed: 58,
      pullSpeed: 640,
      spawnCount: 6,
      spriteScale: 0.86,
      image: "assets/images/hamster.jpg",
      color: "#e8b17b"
    },
    uglyMan: {
      name: "丑男",
      score: 20,
      radius: 44,
      speed: 8,
      pullSpeed: 250,
      spawnCount: 5,
      spriteScale: 1.12,
      image: "assets/images/ugly-man.jpg",
      color: "#93a1b7"
    },
    husband: {
      name: "我老公",
      score: 500,
      radius: 24,
      speed: 96,
      pullSpeed: 500,
      spawnCount: 3,
      spriteScale: 1.08,
      image: "assets/images/husband.jpg",
      color: "#ff6aa0"
    },
    angryOctopus: {
      name: "愤怒章鱼哥",
      score: -GAME_CONFIG.angryOctopusPenalty,
      radius: 30,
      speed: 42,
      pullSpeed: 300,
      spawnCount: 2,
      spriteScale: 1.04,
      image: "assets/images/angry-octopus.png",
      color: "#3f365f"
    }
  };

  const AUDIO_FILES = {
    hookLaunch: "assets/audio/hook-launch.mp3",
    scorePop: "assets/audio/score-pop.mp3",
    win: "assets/audio/win.mp3",
    lose: "assets/audio/lose.mp3"
  };

  function query(id) {
    return document.querySelector(`#${id}`);
  }

  const elements = {
    canvas: query("game-canvas"),
    score: query("score"),
    targetScore: query("target-score"),
    timeLeft: query("time-left"),
    overlay: query("overlay"),
    overlayTitle: query("overlay-title"),
    overlayText: query("overlay-text"),
    rankText: query("rank-text"),
    leaderboardStatus: query("leaderboard-status"),
    startBtn: query("start-btn"),
    restartBtn: query("restart-btn"),

    playerNameLabel: query("player-name-label"),
    authLabel: query("auth-label"),
    recordsBtn: query("records-btn"),
    renameBtn: query("rename-btn"),
    logoutBtn: query("logout-btn"),

    authModal: query("auth-modal"),
    phoneInput: query("phone-input"),
    otpInput: query("otp-input"),
    sendOtpBtn: query("send-otp-btn"),
    verifyOtpBtn: query("verify-otp-btn"),
    authStatus: query("auth-status"),
    authError: query("auth-error"),

    nameModal: query("name-modal"),
    nameModalTitle: query("name-modal-title"),
    nameInput: query("name-input"),
    nameError: query("name-error"),
    nameSaveBtn: query("name-save-btn"),
    nameCancelBtn: query("name-cancel-btn"),

    recordsModal: query("records-modal"),
    recordsStatus: query("records-status"),
    recordsList: query("records-list"),
    recordsCloseBtn: query("records-close-btn")
  };

  class AudioManager {
    constructor(files) {
      this.sounds = {};
      this.enabled = true;

      Object.entries(files).forEach(([key, src]) => {
        const audio = new Audio(src);
        audio.preload = "auto";
        this.sounds[key] = audio;
      });
    }

    play(name, volume = 1) {
      if (!this.enabled) return;
      const audio = this.sounds[name];
      if (!audio) return;

      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, volume));
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch {
        // ignore autoplay errors and missing files
      }
    }
  }

  class Hook {
    constructor(anchor, options = {}) {
      this.anchor = anchor;
      this.state = "idle";
      this.angle = options.minAngle ?? -0.85;
      this.minAngle = options.minAngle ?? -0.85;
      this.maxAngle = options.maxAngle ?? 0.85;
      this.swingSpeed = options.swingSpeed ?? 1.9;
      this.length = 0;
      this.maxLength = options.maxLength ?? 430;
      this.extendSpeed = options.extendSpeed ?? 720;
      this.retractSpeed = options.retractSpeed ?? 840;
      this.swingDirection = 1;
      this.caughtItem = null;
      this.tipRadius = 12;
    }

    fire() {
      if (this.state !== "idle") {
        return false;
      }
      this.state = "extending";
      return true;
    }

    attachItem(item) {
      this.caughtItem = item;
      this.state = "retracting";
    }

    getTipPosition() {
      const offsetX = Math.sin(this.angle) * this.length;
      const offsetY = Math.cos(this.angle) * this.length;
      return { x: this.anchor.x + offsetX, y: this.anchor.y + offsetY };
    }

    update(deltaTime, bounds) {
      if (this.state === "idle") {
        this.angle += this.swingSpeed * this.swingDirection * deltaTime;
        if (this.angle >= this.maxAngle) {
          this.angle = this.maxAngle;
          this.swingDirection = -1;
        } else if (this.angle <= this.minAngle) {
          this.angle = this.minAngle;
          this.swingDirection = 1;
        }
        return { deliveredItem: null };
      }

      if (this.state === "extending") {
        this.length += this.extendSpeed * deltaTime;
        const tip = this.getTipPosition();
        const outOfBounds = tip.y > bounds.height - 10 || tip.x < 8 || tip.x > bounds.width - 8;
        if (this.length >= this.maxLength || outOfBounds) {
          this.state = "retracting";
        }
        return { deliveredItem: null };
      }

      const retractSpeed = this.caughtItem?.pullSpeed ?? this.retractSpeed;
      this.length = Math.max(0, this.length - retractSpeed * deltaTime);
      if (this.length <= 0) {
        const deliveredItem = this.caughtItem;
        this.caughtItem = null;
        this.state = "idle";
        return { deliveredItem };
      }

      return { deliveredItem: null };
    }
  }

  let itemId = 0;
  const imageBoundsCache = new WeakMap();

  function hitTestCircle(circleA, circleB) {
    const deltaX = circleA.x - circleB.x;
    const deltaY = circleA.y - circleB.y;
    const sumRadius = circleA.r + circleB.r;
    return deltaX * deltaX + deltaY * deltaY <= sumRadius * sumRadius;
  }

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createItems(stage) {
    itemId = 0;
    const items = [];
    const entries = Object.entries(ITEM_CONFIGS);

    entries.forEach(([typeKey, config], typeIndex) => {
      for (let index = 0; index < config.spawnCount; index += 1) {
        const x = randomInRange(80, stage.width - 80);
        const y = randomInRange(stage.groundY + 50, stage.height - 70);
        const direction = Math.random() > 0.5 ? 1 : -1;

        items.push({
          id: ++itemId,
          typeKey,
          ...config,
          x,
          y,
          vx: config.speed * direction,
          lane: typeIndex
        });
      }
    });

    return items;
  }

  function updateItems(items, deltaTime, stage, hook) {
    items.forEach((item) => {
      if (hook.caughtItem && item.id === hook.caughtItem.id) {
        const tip = hook.getTipPosition();
        item.x = tip.x;
        item.y = tip.y;
        return;
      }

      item.x += item.vx * deltaTime;
      if (item.x < item.radius || item.x > stage.width - item.radius) {
        item.vx *= -1;
        item.x = Math.max(item.radius, Math.min(stage.width - item.radius, item.x));
      }
    });
  }

  function applyInkCorrosion(items, center, radius, excludedIds = []) {
    const excludedSet = new Set(excludedIds);
    const remainingItems = [];
    const corrodedItems = [];

    items.forEach((item) => {
      if (excludedSet.has(item.id)) {
        remainingItems.push(item);
        return;
      }

      const hit = hitTestCircle(
        { x: center.x, y: center.y, r: radius },
        { x: item.x, y: item.y, r: item.radius }
      );

      if (hit) {
        corrodedItems.push(item);
      } else {
        remainingItems.push(item);
      }
    });

    return { remainingItems, corrodedItems };
  }

  function buildImageCandidates(path) {
    const candidates = [path];
    if (path.endsWith(".jpg")) {
      candidates.push(path.replace(/\.jpg$/i, ".png"));
      candidates.push(path.replace(/\.jpg$/i, ".jpeg"));
    } else if (path.endsWith(".png")) {
      candidates.push(path.replace(/\.png$/i, ".jpg"));
      candidates.push(path.replace(/\.png$/i, ".jpeg"));
    } else if (path.endsWith(".jpeg")) {
      candidates.push(path.replace(/\.jpeg$/i, ".jpg"));
      candidates.push(path.replace(/\.jpeg$/i, ".png"));
    }
    return [...new Set(candidates)];
  }

  function getLoadedImage(path, imageCache) {
    const candidates = buildImageCandidates(path);
    for (const candidate of candidates) {
      if (imageCache[candidate]) {
        return imageCache[candidate];
      }
    }
    return null;
  }

  function getAdaptiveSourceSquare(image) {
    if (imageBoundsCache.has(image)) {
      return imageBoundsCache.get(image);
    }

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    let bounds = { x: 0, y: 0, w: width, h: height };

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, width, height);

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha <= 10) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX >= minX && maxY >= minY) {
        bounds = {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1
        };
      }
    } catch {
      bounds = { x: 0, y: 0, w: width, h: height };
    }

    const size = Math.max(bounds.w, bounds.h);
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const x = Math.max(0, Math.min(width - size, centerX - size / 2));
    const y = Math.max(0, Math.min(height - size, centerY - size / 2));
    const square = { x, y, size };
    imageBoundsCache.set(image, square);
    return square;
  }

  function drawAngryOctopus(ctx, item) {
    const x = item.x;
    const y = item.y;
    const r = item.radius;

    ctx.save();
    ctx.translate(x, y);

    for (let i = 0; i < 8; i += 1) {
      const t = i / 7;
      const tx = -r * 0.95 + t * r * 1.9;
      const wave = Math.sin(i * 0.9 + x * 0.03 + y * 0.02) * 4;
      ctx.strokeStyle = "#2e2548";
      ctx.lineWidth = Math.max(3, r * 0.16);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.15);
      ctx.quadraticCurveTo(tx + wave, r * 0.95, tx - wave * 0.3, r * 1.42);
      ctx.stroke();
    }

    const bodyGradient = ctx.createRadialGradient(-r * 0.28, -r * 0.4, r * 0.2, 0, 0, r * 1.2);
    bodyGradient.addColorStop(0, "#8f78bd");
    bodyGradient.addColorStop(0.58, "#594677");
    bodyGradient.addColorStop(1, "#312447");
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.14, r * 0.24, 0, Math.PI * 2);
    ctx.arc(r * 0.34, -r * 0.14, r * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#130f1f";
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.34, -r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1f172d";
    ctx.lineWidth = Math.max(2, r * 0.11);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.42);
    ctx.lineTo(-r * 0.1, -r * 0.3);
    ctx.moveTo(r * 0.6, -r * 0.42);
    ctx.lineTo(r * 0.1, -r * 0.3);
    ctx.stroke();

    ctx.strokeStyle = "#190f23";
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, r * 0.38);
    ctx.quadraticCurveTo(0, r * 0.2, r * 0.36, r * 0.38);
    ctx.stroke();

    ctx.restore();
  }

  function drawItems(ctx, items, imageCache) {
    items.forEach((item) => {
      const texture = getLoadedImage(item.image, imageCache);
      if (item.typeKey === "angryOctopus" && !texture) {
        drawAngryOctopus(ctx, item);
        return;
      }

      if (texture) {
        const source = getAdaptiveSourceSquare(texture);
        const drawSize = item.radius * 2 * (item.spriteScale ?? 1);

        ctx.save();
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          texture,
          source.x,
          source.y,
          source.size,
          source.size,
          item.x - drawSize / 2,
          item.y - drawSize / 2,
          drawSize,
          drawSize
        );

        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.fillStyle = item.color;
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#101221";
      ctx.font = "15px Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.fillText(item.name, item.x, item.y + 5);
    });
  }

  class GoldMinerGame {
    constructor(canvas, audioManager) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.audio = audioManager;

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
      this.roundFinished = false;
      this.onRoundEnd = null;

      const fullReachLength = Math.hypot(GAME_CONFIG.width / 2, GAME_CONFIG.height - 110) + 100;
      this.hook = new Hook(
        { x: GAME_CONFIG.width / 2, y: 110 },
        {
          minAngle: -0.95,
          maxAngle: 0.95,
          maxLength: fullReachLength,
          swingSpeed: 1.85
        }
      );
    }

    async init() {
      await this.loadImages();
      this.resetRound();
      this.render();
    }

    async loadImages() {
      const uniquePaths = new Set([HERO_IMAGE]);
      Object.values(ITEM_CONFIGS).forEach((item) => {
        buildImageCandidates(item.image).forEach((path) => uniquePaths.add(path));
      });
      buildImageCandidates("assets/images/husband.jpg").forEach((path) => uniquePaths.add(path));

      const tasks = [...uniquePaths].map(
        (path) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
              this.imageCache[path] = image;
              resolve();
            };
            image.onerror = () => resolve();
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
      this.roundFinished = false;
      this.hook.length = 0;
      this.hook.state = "idle";
      this.hook.caughtItem = null;
      this.updateHUD();
    }

    start() {
      this.resetRound();
      this.state = "running";
      hide(elements.overlay);
      this.lastFrameTime = performance.now();
      this.loop(this.lastFrameTime);
    }

    restart() {
      this.start();
    }

    stopForLogout() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.state = "idle";
      this.resetRound();
      this.render();
    }

    fireHook() {
      if (this.state !== "running") {
        return;
      }
      const fired = this.hook.fire();
      if (fired) {
        this.audio.play("hookLaunch", 0.58);
      }
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
        this.audio.play("scorePop", 0.5);
        this.items = this.items.filter((item) => item.id !== hookEvent.deliveredItem.id);
      }

      this.updateHUD();

      if (this.timeLeft <= 0) {
        this.finishRound();
      }
    }

    finishRound() {
      if (this.roundFinished) return;
      this.roundFinished = true;

      this.state = "finished";
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      show(elements.overlay);
      hide(elements.startBtn);
      show(elements.restartBtn);

      const isWin = this.score >= this.targetScore;
      elements.overlayTitle.textContent = isWin ? "你赢了！" : "差一点点";
      elements.overlayText.textContent = `本局得分 ${Math.max(0, Math.floor(this.score))}，目标分 ${this.targetScore}`;

      this.audio.play(isWin ? "win" : "lose", 0.62);

      if (typeof this.onRoundEnd === "function") {
        this.onRoundEnd({
          score: Math.max(0, Math.floor(this.score)),
          targetScore: this.targetScore,
          durationSeconds: GAME_CONFIG.roundSeconds,
          capturedHusbandCount: this.rescuedHusbandCount
        });
      }
    }

    updateHUD() {
      elements.score.textContent = `${Math.max(0, Math.floor(this.score))}`;
      elements.targetScore.textContent = `${this.targetScore}`;
      elements.timeLeft.textContent = `${Math.max(0, Math.ceil(this.timeLeft))}`;
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
          if (x === 0) {
            this.ctx.moveTo(x, waveY);
          } else {
            this.ctx.lineTo(x, waveY);
          }
        }
        this.ctx.stroke();
      }
    }

    renderHero() {
      const hero = getLoadedImage(HERO_IMAGE, this.imageCache);
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

      const husbandImage = getLoadedImage("assets/images/husband.jpg", this.imageCache);
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

      if (this.hook.state === "idle") {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.33)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.hook.anchor.x, this.hook.anchor.y);
        this.ctx.lineTo(displayTip.x, displayTip.y);
        this.ctx.stroke();
      }

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
      this.ctx.lineTo(displayTip.x + Math.cos(leftAngle) * clawLength, displayTip.y + Math.sin(leftAngle) * clawLength);
      this.ctx.moveTo(displayTip.x, displayTip.y);
      this.ctx.lineTo(displayTip.x + Math.cos(rightAngle) * clawLength, displayTip.y + Math.sin(rightAngle) * clawLength);
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

  const audio = new AudioManager(AUDIO_FILES);
  const game = new GoldMinerGame(elements.canvas, audio);

  let authClient = null;
  let leaderboardClient = null;
  const authState = {
    session: null,
    user: null,
    profile: null,
    nickname: "",
    maskedPhone: ""
  };

  function show(element) {
    if (!element) return;
    element.classList.remove("hidden");
  }

  function hide(element) {
    if (!element) return;
    element.classList.add("hidden");
  }

  function disableButton(button, disabled) {
    if (!button) return;
    button.disabled = disabled;
  }

  function setControlsByAuth(isAuthed) {
    disableButton(elements.startBtn, !canStartRound());
    disableButton(elements.restartBtn, !canStartRound());
    disableButton(elements.recordsBtn, false);
    disableButton(elements.renameBtn, !isAuthed);

    if (isAuthed) {
      show(elements.logoutBtn);
    } else {
      hide(elements.logoutBtn);
    }
  }

  function clearRoundRankUI() {
    elements.rankText.textContent = "本局全服排名：--";
    hide(elements.rankText);
    elements.leaderboardStatus.textContent = "";
    hide(elements.leaderboardStatus);
  }

  function setLeaderboardStatus(message) {
    elements.leaderboardStatus.textContent = message;
    show(elements.leaderboardStatus);
  }

  function setAuthStatus(text, isError = false) {
    elements.authStatus.textContent = text || "";
    elements.authError.textContent = "";
    hide(elements.authError);

    if (isError && text) {
      elements.authError.textContent = text;
      show(elements.authError);
    }
  }

  function updateAuthHUD() {
    if (!authState.user) {
      elements.authLabel.textContent = "未登录";
      elements.playerNameLabel.textContent = "未设置";
      return;
    }

    const mask = authState.maskedPhone || "已登录";
    elements.authLabel.textContent = `已登录 ${mask}`;
    elements.playerNameLabel.textContent = authState.nickname || "未设置";
  }

  function openAuthModal(tip = "") {
    setAuthStatus(tip || "请先登录", false);
    show(elements.authModal);
  }

  function closeAuthModal() {
    hide(elements.authModal);
    setAuthStatus("");
  }

  function openNameModal(force = true) {
    elements.nameModal.dataset.force = force ? "1" : "0";
    elements.nameModalTitle.textContent = force ? "设置昵称" : "修改昵称";

    if (force) {
      hide(elements.nameCancelBtn);
    } else {
      show(elements.nameCancelBtn);
    }

    elements.nameInput.value = authState.nickname || localStorage.getItem(STORAGE_KEYS.lastNickname) || "";
    elements.nameError.textContent = "";
    hide(elements.nameError);
    show(elements.nameModal);

    setTimeout(() => elements.nameInput.focus(), 0);
  }

  function closeNameModal() {
    hide(elements.nameModal);
    elements.nameError.textContent = "";
    hide(elements.nameError);
  }

  function isAuthError(error) {
    const message = String(error?.message ?? error ?? "").toLowerCase();
    return (
      message.includes("jwt") ||
      message.includes("auth") ||
      message.includes("token") ||
      message.includes("not authenticated") ||
      message.includes("permission denied") ||
      message.includes("rls")
    );
  }

  function closeRecordsModal() {
    hide(elements.recordsModal);
  }

  function applyLoggedOutState(reason = "请先登录", options = { openAuthModal: false }) {
    authState.session = null;
    authState.user = null;
    authState.profile = null;
    authState.nickname = "";
    authState.maskedPhone = "";

    updateAuthHUD();
    setControlsByAuth(false);

    game.stopForLogout();

    show(elements.overlay);
    show(elements.startBtn);
    hide(elements.restartBtn);
    elements.overlayTitle.textContent = "邪恶小女孩出击";
    elements.overlayText.textContent = "点击屏幕发钩，抓住你的目标！";

    closeNameModal();
    closeRecordsModal();
    clearRoundRankUI();

    if (options?.openAuthModal === true) {
      openAuthModal(reason);
    }
  }
async function ensureNickname() {
    if (!authState.user) return false;

    let profile = null;
    try {
      profile = await authClient.getProfile(authState.user.id);
    } catch {
      profile = null;
    }

    if (profile?.nickname) {
      authState.profile = profile;
      authState.nickname = profile.nickname;
      localStorage.setItem(STORAGE_KEYS.lastNickname, profile.nickname);
      updateAuthHUD();
      return true;
    }

    openNameModal(true);
    return false;
  }

  async function applyLoggedInState(session) {
    authState.session = session;
    authState.user = session?.user ?? null;

    const phone = authState.user?.phone || elements.phoneInput.value.trim();
    if (phone) {
      localStorage.setItem(STORAGE_KEYS.lastPhone, phone);
      authState.maskedPhone = global.AuthClient.maskPhoneNumber(phone);
    } else {
      authState.maskedPhone = "";
    }

    setControlsByAuth(true);
    closeAuthModal();
    updateAuthHUD();

    await ensureNickname();

    elements.overlayTitle.textContent = "邪恶小女孩出击";
    elements.overlayText.textContent = "点击屏幕发钩，抓住你的目标！";
  }

  async function handleSendOtp() {
    if (!authClient?.enabled) {
      setAuthStatus("认证服务不可用", true);
      return;
    }

    const rawPhone = elements.phoneInput.value.trim();
    const normalized = global.AuthClient.normalizePhoneNumber(rawPhone);

    if (!normalized) {
      setAuthStatus("手机号格式不正确", true);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.lastPhone, normalized);
    elements.phoneInput.value = normalized;

    disableButton(elements.sendOtpBtn, true);
    setAuthStatus("验证码发送中...");

    try {
      await authClient.sendOtp(normalized);
      setAuthStatus("验证码已发送，请查收短信");
    } catch (error) {
      setAuthStatus(`发送失败：${error?.message || "请稍后重试"}`, true);
    } finally {
      disableButton(elements.sendOtpBtn, false);
    }
  }

  async function handleVerifyOtp() {
    if (!authClient?.enabled) {
      setAuthStatus("认证服务不可用", true);
      return;
    }

    const phone = elements.phoneInput.value.trim();
    const otp = elements.otpInput.value.trim();

    disableButton(elements.verifyOtpBtn, true);
    setAuthStatus("登录中...");

    try {
      await authClient.verifyOtp(phone, otp);
      const session = await authClient.getSession();
      if (!session?.user) {
        throw new Error("登录失败，请重试");
      }
      await applyLoggedInState(session);
      elements.otpInput.value = "";
      setAuthStatus("登录成功");
    } catch (error) {
      setAuthStatus(`登录失败：${error?.message || "请重试"}`, true);
    } finally {
      disableButton(elements.verifyOtpBtn, false);
    }
  }

  async function handleLogout() {
    try {
      if (authClient?.enabled) {
        await authClient.signOut();
      }
    } catch {
      // swallow and still clear local state
    }

    applyLoggedOutState("已退出登录，请重新登录", { openAuthModal: true });
  }

  async function handleSaveNickname() {
    if (!authState.user) {
      show(elements.nameError);
      elements.nameError.textContent = "请先登录";
      return;
    }

    const validation = global.AuthClient.validateNickname(elements.nameInput.value);
    if (!validation.ok) {
      show(elements.nameError);
      elements.nameError.textContent = validation.message;
      return;
    }

    disableButton(elements.nameSaveBtn, true);

    try {
      const profile = await authClient.upsertProfile(authState.user.id, validation.value);
      authState.profile = profile;
      authState.nickname = profile.nickname;
      localStorage.setItem(STORAGE_KEYS.lastNickname, profile.nickname);
      updateAuthHUD();
      closeNameModal();
    } catch (error) {
      show(elements.nameError);
      elements.nameError.textContent = error?.message || "昵称保存失败";
    } finally {
      disableButton(elements.nameSaveBtn, false);
    }
  }

  function formatPlayedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  function escapeHtml(input) {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRecordsRows(rows) {
    if (!rows.length) {
      elements.recordsList.innerHTML = '<div class="records-row"><span>暂无记录</span><span></span><span></span><span></span></div>';
      return;
    }

    const head =
      '<div class="records-row head"><span>排名</span><span>昵称</span><span>分数</span><span>游戏时间</span></div>';

    const body = rows
      .map((row, index) => {
        const rank = index + 1;
        const name = escapeHtml(String(row.player_name || "匿名"));
        const score = Number(row.score || 0);
        const playedAt = escapeHtml(formatPlayedAt(row.created_at));
        return `<div class="records-row"><span>#${rank}</span><span>${name}</span><span>${score}</span><span>${playedAt}</span></div>`;
      })
      .join("");

    elements.recordsList.innerHTML = `${head}${body}`;
  }

  async function handleOpenRecords() {
    const isAuthed = Boolean(authState.user);
    if (shouldPromptLoginForRecords({ isAuthed })) {
      openAuthModal("请先登录后再查询战绩");
      return;
    }

    show(elements.recordsModal);
    elements.recordsStatus.textContent = "加载中...";
    elements.recordsList.innerHTML = "";

    if (!leaderboardClient?.enabled) {
      elements.recordsStatus.textContent = "排行榜未配置";
      return;
    }

    disableButton(elements.recordsBtn, true);

    try {
      const rows = await leaderboardClient.fetchTopScores(15);
      renderRecordsRows(rows);
      elements.recordsStatus.textContent = `已加载 ${rows.length} 条`;
    } catch (error) {
      elements.recordsStatus.textContent = `加载失败：${error?.message || "请稍后重试"}`;
    } finally {
      disableButton(elements.recordsBtn, false);
    }
  }

  async function submitRoundScore(result) {
    clearRoundRankUI();

    const isAuthed = Boolean(authState.user);
    const leaderboardEnabled = Boolean(leaderboardClient?.enabled);
    if (!canSubmitScore({ isAuthed, leaderboardEnabled })) {
      if (!isAuthed) {
        setLeaderboardStatus("游客模式：登录后可参与排行榜");
        return;
      }
      if (!leaderboardEnabled) {
        setLeaderboardStatus("排行榜未配置");
        return;
      }
    }

    show(elements.rankText);
    elements.rankText.textContent = "本局全服排名：计算中...";

    const payload = {
      user_id: authState.user.id,
      player_name: authState.nickname || "未命名",
      score: Math.max(0, Number(result.score || 0)),
      duration_seconds: Math.max(1, Number(result.durationSeconds || GAME_CONFIG.roundSeconds)),
      captured_husband_count: Math.max(0, Number(result.capturedHusbandCount || 0))
    };

    try {
      const inserted = await leaderboardClient.submitScore(payload);
      const rows = await leaderboardClient.fetchScores();
      const sorted = global.LeaderboardUtils.sortLeaderboardRows(rows);
      const rank = global.LeaderboardUtils.findInsertedEntryRank(sorted, inserted.id);

      if (rank) {
        elements.rankText.textContent = `本局全服排名：#${rank}`;
      } else {
        elements.rankText.textContent = "本局全服排名：--";
      }
    } catch (error) {
      if (isAuthError(error)) {
        elements.rankText.textContent = "本局全服排名：--";
        setLeaderboardStatus("登录状态失效，请重新登录后继续");
        applyLoggedOutState("登录已失效，请重新登录", { openAuthModal: true });
        return;
      }
      elements.rankText.textContent = "本局全服排名：--";
      setLeaderboardStatus(`成绩提交失败：${error?.message || "请稍后重试"}`);
    }
  }

  function attemptStartRound(action) {
    if (!canStartRound()) {
      return;
    }
    if (shouldRequireNickname({ isAuthed: Boolean(authState.user), nickname: authState.nickname })) {
      openNameModal(true);
      return;
    }

    clearRoundRankUI();
    action();
  }

  function bindEvents() {
    const unlockAudio = createOneTimeUnlocker(() => {
      audio.play("hookLaunch", 0.02);
    });

    const isCanvasTarget = (target) => {
      if (!target) return false;
      if (target === elements.canvas) return true;
      if (typeof target.closest === "function") {
        return target.closest("#game-canvas") === elements.canvas;
      }
      return false;
    };

    const tapToFire = createTapToFireHandler({
      fireHook: () => game.fireHook(),
      unlockAudio,
      isCanvasTarget
    });

    const preventTouchMove = (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    elements.startBtn.addEventListener("click", () => {
      attemptStartRound(() => game.start());
    });

    elements.restartBtn.addEventListener("click", () => {
      attemptStartRound(() => game.restart());
    });

    elements.sendOtpBtn.addEventListener("click", handleSendOtp);
    elements.verifyOtpBtn.addEventListener("click", handleVerifyOtp);
    elements.logoutBtn.addEventListener("click", handleLogout);

    elements.recordsBtn.addEventListener("click", handleOpenRecords);
    elements.recordsCloseBtn.addEventListener("click", closeRecordsModal);

    elements.renameBtn.addEventListener("click", () => {
      if (!authState.user) {
        openAuthModal("请先登录");
        return;
      }
      openNameModal(false);
    });

    elements.nameSaveBtn.addEventListener("click", handleSaveNickname);
    elements.nameCancelBtn.addEventListener("click", () => {
      const force = elements.nameModal.dataset.force === "1";
      if (!force) {
        closeNameModal();
      }
    });

    elements.canvas.addEventListener("pointerdown", tapToFire);
    window.addEventListener("touchstart", unlockAudio, { passive: true });

    elements.canvas.addEventListener("touchmove", preventTouchMove, { passive: false });
    elements.overlay.addEventListener("touchmove", preventTouchMove, { passive: false });

    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();

      game.fireHook();
    });
  }
  async function initClients() {
    leaderboardClient = global.LeaderboardClient?.createLeaderboardClient({
      supabaseUrl: SUPABASE_CONFIG.url,
      supabaseAnonKey: SUPABASE_CONFIG.anonKey,
      tableName: SUPABASE_CONFIG.tableName
    });

    authClient = global.AuthClient?.createAuthClient({
      supabaseUrl: SUPABASE_CONFIG.url,
      supabaseAnonKey: SUPABASE_CONFIG.anonKey,
      profileTable: "player_profiles"
    });

    if (!authClient || !authClient.enabled) {
      const initPolicy = getInitAuthPolicy({ authEnabled: false, hasSession: false });
      applyLoggedOutState("认证服务未配置或未加载", { openAuthModal: initPolicy.openAuthModal });
      return;
    }

    const savedPhone = localStorage.getItem(STORAGE_KEYS.lastPhone);
    if (savedPhone) {
      elements.phoneInput.value = savedPhone;
    }

    try {
      const session = await authClient.getSession();
      const initPolicy = getInitAuthPolicy({ authEnabled: true, hasSession: Boolean(session?.user) });
      if (initPolicy.shouldApplyLoggedIn) {
        await applyLoggedInState(session);
        return;
      }
    } catch {
      // continue to login modal
    }

    const initPolicy = getInitAuthPolicy({ authEnabled: true, hasSession: false });
    applyLoggedOutState("请先登录后开始游戏", { openAuthModal: initPolicy.openAuthModal });
  }

  async function init() {
    bindEvents();

    game.onRoundEnd = (result) => {
      submitRoundScore(result);
    };

    show(elements.overlay);
    show(elements.startBtn);
    hide(elements.restartBtn);
    clearRoundRankUI();

    await game.init();
    await initClients();
  }

  init();
})(typeof window !== "undefined" ? window : globalThis);
}

















