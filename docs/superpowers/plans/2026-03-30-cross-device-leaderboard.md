# Cross-Device Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-device score persistence and ranking with Supabase so each finished run stores score + duration and shows round rank in global history.

**Architecture:** Keep current standalone runtime (`index.html` + `src/main-standalone.js`) and add a small Supabase data layer plus pure ranking utilities. UI updates stay in the existing overlay and append a leaderboard panel. Local nickname is stored in `localStorage` and reused automatically.

**Tech Stack:** Vanilla JS (IIFE), Supabase JS v2 CDN, Supabase Postgres table + RLS, Node-based local unit tests for ranking utilities.

---

### Task 1: Create Ranking Utility Module (TDD first)

**Files:**
- Create: `src/leaderboard-utils.js`
- Create: `tests/leaderboard.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for ranking and sorting**

Create `tests/leaderboard.test.js` with:

```js
import assert from "node:assert/strict";
import { sortLeaderboardRows, findInsertedEntryRank } from "../src/leaderboard-utils.js";

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

run("sortLeaderboardRows sorts by score desc, duration asc, created_at asc", () => {
  const rows = [
    { id: "a", score: 100, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "b", score: 300, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "c", score: 300, duration_seconds: 58, created_at: "2026-03-30T10:00:00.000Z" }
  ];
  const sorted = sortLeaderboardRows(rows);
  assert.deepEqual(sorted.map((r) => r.id), ["c", "b", "a"]);
});

run("findInsertedEntryRank returns 1-based rank", () => {
  const rows = [
    { id: "x", score: 400, duration_seconds: 55, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "y", score: 300, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" }
  ];
  assert.equal(findInsertedEntryRank(rows, "y"), 2);
});

console.log("Leaderboard utility tests completed.");
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL with module not found for `src/leaderboard-utils.js`.

- [ ] **Step 3: Implement minimal utility module**

Create `src/leaderboard-utils.js`:

```js
export function sortLeaderboardRows(rows) {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.duration_seconds !== b.duration_seconds) return a.duration_seconds - b.duration_seconds;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function findInsertedEntryRank(rows, entryId) {
  const index = rows.findIndex((row) => row.id === entryId);
  return index === -1 ? null : index + 1;
}
```

- [ ] **Step 4: Update test runner entrypoint**

In `package.json`, set:

```json
{
  "scripts": {
    "test": "node tests/core.test.js && node tests/leaderboard.test.js"
  }
}
```

- [ ] **Step 5: Run tests to verify green**

Run:

```bash
npm test
```

Expected: PASS for existing core tests and new leaderboard tests.

### Task 2: Add Supabase Config and Data Client

**Files:**
- Create: `src/leaderboard-client.js`
- Modify: `index.html`
- Modify: `src/main-standalone.js`

- [ ] **Step 1: Inject Supabase CDN script**

In `index.html`, add before `main-standalone.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

- [ ] **Step 2: Add leaderboard client module**

Create `src/leaderboard-client.js`:

```js
export function createLeaderboardClient({ supabaseUrl, supabaseAnonKey }) {
  if (!window.supabase) throw new Error("Supabase SDK not loaded");
  const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  return {
    async submitScore(payload) {
      const { data, error } = await client.from("game_scores").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    async fetchScores(limit = 200) {
      const { data, error } = await client
        .from("game_scores")
        .select("id,player_name,score,duration_seconds,captured_husband_count,created_at")
        .order("score", { ascending: false })
        .order("duration_seconds", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data || [];
    }
  };
}
```

- [ ] **Step 3: Add runtime config constants**

In `src/main-standalone.js`, add:

```js
const SUPABASE_CONFIG = {
  url: "REPLACE_WITH_SUPABASE_URL",
  anonKey: "REPLACE_WITH_SUPABASE_ANON_KEY"
};
```

And fail gracefully when placeholders remain.

- [ ] **Step 4: Wire client creation in game boot**

Instantiate client during init and keep reference in game runtime state.

- [ ] **Step 5: Manual verification**

Open `index.html` and verify no crash before gameplay if keys are placeholders; show user-friendly warning in overlay or console.

### Task 3: Add Nickname Persistence and Prompt

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-standalone.js`

- [ ] **Step 1: Add nickname modal markup**

In `index.html`, add modal container:

```html
<div id="name-modal" class="name-modal hidden">
  <div class="name-card">
    <h3>输入昵称</h3>
    <input id="name-input" maxlength="12" />
    <button id="name-save-btn" type="button">保存昵称</button>
  </div>
</div>
```

- [ ] **Step 2: Add nickname modal styles**

In `styles.css`, add styles for `.name-modal`, `.name-card`, input, and button states.

- [ ] **Step 3: Implement local storage logic**

In `src/main-standalone.js`, add:

```js
const PLAYER_NAME_KEY = "playerName";

function getSavedPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

function savePlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}
```

- [ ] **Step 4: Show modal only for first run**

On init, if no name exists, block game start button and show modal until valid name entered.

- [ ] **Step 5: Add rename action**

Add a small `改昵称` button in HUD and reuse same modal flow.

### Task 4: Persist Score on Round End and Compute Rank

**Files:**
- Modify: `src/main-standalone.js`
- Modify: `src/leaderboard-utils.js`

- [ ] **Step 1: Add round-result payload builder**

When round finishes, build:

```js
{
  player_name: currentPlayerName,
  score: this.score,
  duration_seconds: GAME_CONFIG.roundSeconds,
  captured_husband_count: this.rescuedHusbandCount
}
```

- [ ] **Step 2: Submit score in finish flow**

In `finishRound()`, after local result render, call:

```js
const insertedId = await leaderboardClient.submitScore(payload);
```

- [ ] **Step 3: Fetch and rank**

Fetch rows, call `sortLeaderboardRows(rows)`, then:

```js
const rank = findInsertedEntryRank(sortedRows, insertedId);
```

- [ ] **Step 4: Add network error states**

Support states:
- `loading leaderboard...`
- `submission failed`
- `fetch failed`

- [ ] **Step 5: Verify with mock/offline scenario**

Disconnect network and verify game still reaches replayable end-state with clear message.

### Task 5: Render Leaderboard in Result Overlay

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main-standalone.js`

- [ ] **Step 1: Add ranking UI placeholders**

In overlay, add:

```html
<p id="rank-text"></p>
<div id="leaderboard-panel" class="leaderboard-panel"></div>
```

- [ ] **Step 2: Implement list renderer**

Render top 20 rows:

```js
function renderLeaderboard(rows, currentName) {
  return rows.slice(0, 20).map((row, idx) => ({
    rank: idx + 1,
    name: row.player_name,
    score: row.score,
    duration: row.duration_seconds
  }));
}
```

- [ ] **Step 3: Highlight current run**

If inserted row is in top 20, add highlight style class.

- [ ] **Step 4: Show rank summary**

Display: `本局历史排名：#${rank} / ${total}`.

- [ ] **Step 5: Manual UI validation**

Play one round and confirm ranking text + list layout remain readable in 16:9 and narrower widths.

### Task 6: Supabase SQL Setup and Security Notes

**Files:**
- Create: `docs/supabase-setup.md`
- Modify: `README.md`

- [ ] **Step 1: Document table creation SQL**

In `docs/supabase-setup.md`, include:

```sql
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 12),
  score int not null check (score >= 0),
  duration_seconds int not null check (duration_seconds > 0),
  captured_husband_count int not null default 0,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Document RLS policies**

Include:

```sql
alter table public.game_scores enable row level security;

create policy "allow public read scores"
on public.game_scores for select
to anon
using (true);

create policy "allow public insert scores"
on public.game_scores for insert
to anon
with check (true);
```

- [ ] **Step 3: Add required frontend config instructions**

Document exactly where to set Supabase URL and anon key in `src/main-standalone.js`.

- [ ] **Step 4: Add deployment reminder**

Mention that friends must access hosted URL (not local file path) for shared data.

### Task 7: Final Verification and Documentation Update

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Verification checklist run**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Manual E2E verification**

On device A:
- set nickname A
- finish a round, note score

On device B:
- set nickname B
- verify A record appears in leaderboard

- [ ] **Step 3: Update README usage section**

Add:
- nickname first-run flow
- leaderboard behavior
- Supabase setup prerequisites

- [ ] **Step 4: Update CHANGELOG**

Add entries for:
- cross-device score saving
- ranking display
- nickname persistence

- [ ] **Step 5: Final smoke check**

Reopen `index.html`, ensure game starts, ends, and overlay updates even when Supabase credentials are absent (graceful errors only).
