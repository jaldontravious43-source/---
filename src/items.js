import { ITEM_CONFIGS } from "./config.js";

let itemId = 0;
const imageBoundsCache = new WeakMap();

export function hitTestCircle(circleA, circleB) {
  const deltaX = circleA.x - circleB.x;
  const deltaY = circleA.y - circleB.y;
  const sumRadius = circleA.r + circleB.r;
  return deltaX * deltaX + deltaY * deltaY <= sumRadius * sumRadius;
}

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function createItems(stage) {
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

export function updateItems(items, deltaTime, stage, hook) {
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

export function applyInkCorrosion(items, center, radius, excludedIds = []) {
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
      return;
    }

    remainingItems.push(item);
  });

  return { remainingItems, corrodedItems };
}

export function drawItems(ctx, items, imageCache) {
  items.forEach((item) => {
    const texture = imageCache[item.image];
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
