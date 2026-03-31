# Mobile iPhone + PWA Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有桌面网页可用性的前提下，新增 iPhone 友好的移动入口（游客可开局、点击发钩）并提供 PWA 安装体验。

**Architecture:** 保留现有 `index.html + src/main-standalone.js` 作为桌面入口，新增 `mobile.html + src/main-mobile.js` 作为移动入口。通过提取“开局门禁/提交门禁”策略函数减少分叉风险。第二阶段增加 `manifest.webmanifest` 与 `sw.js`，使移动端可添加到主屏幕并具备基础离线缓存。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Canvas 2D、Supabase JS、Service Worker、Node 内置断言测试。

---

## File Structure Map

- Create: `mobile.html`
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `src/game-access.js`（游客/登录能力门禁策略）
- Create: `src/main-mobile.js`（移动端入口脚本，触控 + 游客模式）
- Create: `tests/game-access.test.js`
- Modify: `src/main-standalone.js`（切换为游客可开局、登录增强）
- Modify: `styles.css`（移动入口样式 + safe-area + 触控优化）
- Modify: `README.md`
- Modify: `CHANGELOG.md`

## Task 1: 抽取门禁策略并先写失败测试（TDD 红灯）

**Files:**
- Create: `tests/game-access.test.js`
- Create: `src/game-access.js`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试（游客开局 + 登录才能提交战绩）**

```js
import assert from "node:assert/strict";
import {
  canStartRound,
  canSubmitScore,
  getRecordsAction
} from "../src/game-access.js";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("guest can start round", () => {
  assert.equal(canStartRound({ isAuthed: false, authServiceEnabled: false }), true);
  assert.equal(canStartRound({ isAuthed: false, authServiceEnabled: true }), true);
});

runTest("score submit requires auth and leaderboard", () => {
  assert.equal(canSubmitScore({ isAuthed: false, leaderboardEnabled: true }), false);
  assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: false }), false);
  assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: true }), true);
});

runTest("records action differs by auth", () => {
  assert.equal(getRecordsAction({ isAuthed: false }), "prompt_login");
  assert.equal(getRecordsAction({ isAuthed: true }), "open_records");
});

console.log("Game access tests completed.");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node tests/game-access.test.js`
Expected: FAIL with `Cannot find module '../src/game-access.js'`。

- [ ] **Step 3: 写最小实现让测试通过（绿灯）**

```js
export function canStartRound() {
  return true;
}

export function canSubmitScore({ isAuthed, leaderboardEnabled }) {
  return Boolean(isAuthed && leaderboardEnabled);
}

export function getRecordsAction({ isAuthed }) {
  return isAuthed ? "open_records" : "prompt_login";
}
```

- [ ] **Step 4: 再跑测试确认通过**

Run: `node tests/game-access.test.js`
Expected: PASS all。

- [ ] **Step 5: 把新测试加入全量测试脚本并验证**

```json
{
  "scripts": {
    "test": "node tests/core.test.js && node tests/leaderboard.test.js && node tests/auth-client.test.js && node tests/game-access.test.js"
  }
}
```

Run: `npm test`
Expected: all tests pass。

- [ ] **Step 6: Commit**

```bash
git add tests/game-access.test.js src/game-access.js package.json
git commit -m "test: add guest/auth access policy tests"
```

## Task 2: 桌面端改为“游客可开局，登录增强”

**Files:**
- Modify: `src/main-standalone.js`

- [ ] **Step 1: 先补失败断言（通过策略函数驱动行为）**

在 `tests/game-access.test.js` 添加：

```js
runTest("guest records action should prompt login", () => {
  const action = getRecordsAction({ isAuthed: false });
  assert.equal(action, "prompt_login");
});
```

Run: `node tests/game-access.test.js`
Expected: PASS（作为回归保护）。

- [ ] **Step 2: 引入策略并改开局门禁**

在 `src/main-standalone.js` 顶部增加：

```js
import { canStartRound, canSubmitScore, getRecordsAction } from "./game-access.js";
```

并把 `start/restart` 中“未登录即阻断”替换为：

```js
if (!canStartRound({ isAuthed: Boolean(authState.user), authServiceEnabled: Boolean(authClient?.enabled) })) {
  applyLoggedOutState("请先登录后开始游戏");
  return;
}
```

- [ ] **Step 3: 改 submitRoundScore 门禁**

```js
if (!canSubmitScore({ isAuthed: Boolean(authState.user), leaderboardEnabled: Boolean(leaderboardClient?.enabled) })) {
  if (!authState.user) {
    setLeaderboardStatus("游客模式：登录后可参与排行榜");
  } else {
    setLeaderboardStatus("排行榜未配置");
  }
  return;
}
```

- [ ] **Step 4: 改战绩按钮行为为“游客引导登录”而非强制登出**

```js
const action = getRecordsAction({ isAuthed: Boolean(authState.user) });
if (action === "prompt_login") {
  setLeaderboardStatus("请登录后查询战绩");
  openAuthModal("登录后可查看全服战绩");
  return;
}
```

- [ ] **Step 5: 本地手工验证桌面流**

Run: 双击 `index.html`
Expected:
- 未登录可以开始游戏。
- 未登录结束后显示“登录后可参与排行榜”。
- 登录后可提交成绩并显示排名。

- [ ] **Step 6: Commit**

```bash
git add src/main-standalone.js
git commit -m "feat: allow guest gameplay on desktop and gate ranking by login"
```

## Task 3: 新增移动入口 `mobile.html` + `src/main-mobile.js`

**Files:**
- Create: `mobile.html`
- Create: `src/main-mobile.js`
- Modify: `styles.css`

- [ ] **Step 1: 先写移动入口结构（HTML）**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />
    <meta name="theme-color" content="#0a1330" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <title>老公别跑 - 手机版</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="mobile-page">
    <main class="app mobile-app">
      <!-- 复用与桌面相同的 HUD/Canvas/弹窗结构，添加 mobile class -->
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="./src/auth-client.js" defer></script>
    <script src="./src/leaderboard-utils.js" defer></script>
    <script src="./src/leaderboard-client.js" defer></script>
    <script src="./src/main-mobile.js" defer></script>
  </body>
</html>
```

- [ ] **Step 2: 复制入口逻辑并最小改造触控发钩**

在 `src/main-mobile.js` 添加：

```js
window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    unlockAudioOnce();
    game.fireHook();
  },
  { passive: false }
);
```

并保留游客可开局门禁策略（复用 `src/game-access.js`）。

- [ ] **Step 3: iOS 音频首次触摸解锁**

```js
let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.play("hookLaunch", 0.01);
}
```

- [ ] **Step 4: 移动样式最小实现**

在 `styles.css` 追加：

```css
.mobile-page {
  overflow: hidden;
  touch-action: manipulation;
}

.mobile-app {
  width: 100vw;
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  gap: 8px;
}

.mobile-app .hud {
  font-size: 14px;
  padding: 10px 12px;
}

.mobile-app #game-canvas {
  width: 100vw;
  height: calc(100dvh - 148px);
  aspect-ratio: auto;
}
```

- [ ] **Step 5: 手工验证移动入口**

Run: 打开 `mobile.html`
Expected:
- 点击屏幕可发钩。
- 页面不误滚动。
- 游客可直接开始。

- [ ] **Step 6: Commit**

```bash
git add mobile.html src/main-mobile.js styles.css
git commit -m "feat: add mobile entry with tap-to-fire controls"
```

## Task 4: PWA 支持（安装与离线基础）

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Modify: `mobile.html`
- Modify: `src/main-mobile.js`

- [ ] **Step 1: 写 manifest**

```json
{
  "name": "老公别跑",
  "short_name": "老公别跑",
  "start_url": "/mobile.html",
  "display": "standalone",
  "background_color": "#091229",
  "theme_color": "#0a1330",
  "icons": [
    {
      "src": "/assets/images/evil-girl.jpg",
      "sizes": "192x192",
      "type": "image/jpeg"
    },
    {
      "src": "/assets/images/evil-girl.jpg",
      "sizes": "512x512",
      "type": "image/jpeg"
    }
  ]
}
```

- [ ] **Step 2: 写 service worker**

```js
const CACHE_NAME = "laogong-bie-pao-v1";
const CORE_ASSETS = [
  "/mobile.html",
  "/styles.css",
  "/src/main-mobile.js",
  "/src/auth-client.js",
  "/src/leaderboard-client.js",
  "/src/leaderboard-utils.js",
  "/src/game-access.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
```

- [ ] **Step 3: 在移动入口注册 SW**

在 `src/main-mobile.js` `init()` 里追加：

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
```

- [ ] **Step 4: 手工验证 PWA**

Expected:
- iPhone Safari 可“添加到主屏幕”。
- 从主屏图标打开为独立窗口。
- 断网可打开已缓存页面（登录/排行榜按网络降级）。

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest sw.js mobile.html src/main-mobile.js
git commit -m "feat: add pwa manifest and offline shell for mobile"
```

## Task 5: 文档与最终验证

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 更新 README（新增移动端与 PWA 章节）**

添加内容：

```md
## 手机端（iPhone）

- 入口：`mobile.html`
- 操作：点击屏幕发钩
- 游客可直接开局，登录后可参与排行榜

## PWA 安装

- iPhone Safari 打开 `mobile.html`
- 分享 -> 添加到主屏幕
```

- [ ] **Step 2: 更新 CHANGELOG（Added/Changed）**

```md
### Added - 2026-03-31
- Added mobile entry: `mobile.html`, `src/main-mobile.js`
- Added PWA files: `manifest.webmanifest`, `sw.js`
- Added guest/auth access policy module: `src/game-access.js`
- Added tests: `tests/game-access.test.js`

### Changed - 2026-03-31
- Changed desktop auth gate to allow guest gameplay and login-only ranking features.
- Updated styles for iPhone safe-area and mobile touch layout.
```

- [ ] **Step 3: 全量验证**

Run: `npm test`
Expected: all pass。

手工验证清单：
- `index.html` 桌面端仍可玩（游客可开局、登录可上榜）。
- `mobile.html` iPhone 点击可发钩。
- PWA 可添加主屏。

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document iPhone mobile entry and pwa usage"
```

- [ ] **Step 5: 发布前总提交（可选）**

```bash
git log --oneline -n 8
```

Expected: 包含本计划各任务提交记录。
