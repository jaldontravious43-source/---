# 邪恶小女孩黄金矿工 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可在网页直接游玩的黄金矿工风格小游戏（电脑横屏，空格发钩，60 秒结算）。  
**Architecture:** 使用原生 `HTML + CSS + JavaScript` 单页架构，按“配置层 / 游戏循环层 / 钩子逻辑层 / UI 层”分文件，减少耦合。图片资源与目标参数分离，方便后续换图和调参。  
**Tech Stack:** HTML5、CSS3、ES Modules、Canvas 2D API。

---

### Task 1: 搭建最小项目骨架

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/main.js`
- Create: `src/game.js`
- Create: `src/hook.js`
- Create: `src/items.js`
- Create: `src/ui.js`
- Create: `src/config.js`
- Create: `assets/images/.gitkeep`

- [ ] **Step 1: 创建基础页面骨架**

写入 `index.html`：包含 `canvas`、HUD、结算弹层、开始/重开按钮，并通过 `type="module"` 引入 `src/main.js`。

- [ ] **Step 2: 添加基础样式**

在 `styles.css` 中实现 `16:9` 横屏主容器、顶部信息栏、居中画布与结算层显隐样式。

- [ ] **Step 3: 建立模块入口**

在 `src/main.js` 中创建 `initGame()`、按钮事件绑定、页面加载后初始化逻辑。

- [ ] **Step 4: 本地打开验证**

在浏览器直接打开 `index.html`，确认无白屏报错，能看到基础布局和按钮。

### Task 2: 实现游戏主循环与状态机

**Files:**
- Modify: `src/game.js`
- Modify: `src/main.js`
- Test: 手动验证（浏览器控制台）

- [ ] **Step 1: 定义状态模型**

在 `src/game.js` 建立 `idle / running / finished` 状态与核心字段：`score`、`targetScore`、`timeLeft`、`items`、`hook`。

- [ ] **Step 2: 实现动画循环**

基于 `requestAnimationFrame` 写 `update(deltaTime)` 与 `render()`，所有移动依赖 `deltaTime`。

- [ ] **Step 3: 接入倒计时结束逻辑**

`running` 状态下每帧扣减剩余时间，时间到后切换 `finished` 并触发 UI 结算层。

- [ ] **Step 4: 手动回归**

确认开始后时间递减、结束后停止更新并可重开。

### Task 3: 实现钩子机制（摆动、发射、回收）

**Files:**
- Modify: `src/hook.js`
- Modify: `src/game.js`

- [ ] **Step 1: 实现摆动逻辑**

在 `src/hook.js` 定义角度在最小/最大边界来回摆动。

- [ ] **Step 2: 实现空格发钩**

在 `src/main.js` 监听 `Space`，仅在钩子空闲时触发“伸出”。

- [ ] **Step 3: 实现命中与回收流程**

钩子伸出过程中检测与目标碰撞；命中后进入回收并绑定目标；未命中触底回收。

- [ ] **Step 4: 防抖与状态保护**

钩子非空闲时忽略连续空格，避免重复发射。

### Task 4: 实现四类目标与参数配置

**Files:**
- Modify: `src/config.js`
- Modify: `src/items.js`
- Modify: `src/game.js`

- [ ] **Step 1: 建立目标参数表**

在 `src/config.js` 定义四类目标的 `size/speed/score/pullSpeed/spawnCount/sprite`。

- [ ] **Step 2: 生成与更新目标实体**

在 `src/items.js` 实现目标初始化、移动更新、越界处理与基础绘制。

- [ ] **Step 3: 应用差异化手感**

落实设定：  
明星帅哥（大/中速/高分）、仓鼠（小/快/中分）、丑男（大/极慢/超低分）、我老公（超快/超高分）。

- [ ] **Step 4: 命中计分联动**

钩子回收到顶部时结算分数，更新 HUD。

### Task 5: 接入用户图片与降级占位

**Files:**
- Modify: `src/items.js`
- Modify: `src/game.js`
- Create: `assets/images/README.md`

- [ ] **Step 1: 定义图片加载器**

按路径预加载 5 张图，加载成功缓存纹理。

- [ ] **Step 2: 增加缺图降级绘制**

当图片不存在或加载失败，使用彩色占位图形并在控制台输出 warning。

- [ ] **Step 3: 资源放置说明**

在 `assets/images/README.md` 明确文件名规范：
`evil-girl.png`、`star-handsome.png`、`hamster.png`、`ugly-man.png`、`husband.png`。

- [ ] **Step 4: 手动验证**

先用占位运行，再逐张替换为用户图片，确认都能正确显示。

### Task 6: 结算体验与可玩性调参

**Files:**
- Modify: `src/ui.js`
- Modify: `src/config.js`
- Modify: `styles.css`

- [ ] **Step 1: 完成结算层**

显示本局得分、目标分、达标与否，提供“再来一局”按钮。

- [ ] **Step 2: 参数首轮调优**

调节目标数量、速度范围、钩子长度和回收速度，让“我老公难抓但可抓”。

- [ ] **Step 3: 体验检查**

连续试玩 3 局，确认没有明显卡死、分数异常或按键失效。

### Task 7: 交付与运行说明

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写运行指南**

说明两种方式：  
1) 双击 `index.html` 直接玩；  
2) 使用本地静态服务（可选）。

- [ ] **Step 2: 写资源替换指南**

说明如何替换 `assets/images/` 内图片、如何调分值和速度参数。

- [ ] **Step 3: 写后续扩展建议**

记录下一阶段可选项：多关卡、道具系统、音效、排行榜。
