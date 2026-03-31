# Phone OTP Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mandatory Supabase phone-OTP login so users must sign in before playing, with account-bound nickname and cross-device leaderboard identity.

**Architecture:** Extend the standalone frontend runtime with an auth controller (OTP request/verify/signout), profile persistence (`player_profiles`), and score submission tied to `auth.uid()`. Keep current game loop intact while gating start/query actions behind auth state.

**Tech Stack:** Vanilla JS (IIFE), Supabase JS v2 CDN, Supabase Auth (Phone OTP), Postgres tables (`game_scores`, `player_profiles`), RLS policies.

---

### Task 1: Add Auth SQL and RLS Foundation

**Files:**
- Modify: `docs/supabase-setup.md`

- [ ] **Step 1: Add SQL for `player_profiles` table**

Include:

```sql
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add `user_id` column to `game_scores`**

Include:

```sql
alter table public.game_scores
add column if not exists user_id uuid references auth.users(id) on delete cascade;
```

- [ ] **Step 3: Add secure RLS policies**

Include:

```sql
alter table public.player_profiles enable row level security;

drop policy if exists "profile read own" on public.player_profiles;
create policy "profile read own"
on public.player_profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profile upsert own" on public.player_profiles;
create policy "profile upsert own"
on public.player_profiles for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "score insert own user" on public.game_scores;
create policy "score insert own user"
on public.game_scores for insert
to authenticated
with check (auth.uid() = user_id);
```

- [ ] **Step 4: Keep global score read policy**

Ensure select policy on `game_scores` remains readable for leaderboard display.

### Task 2: Build Auth/Profile Client Layer (TDD)

**Files:**
- Create: `src/auth-client.js`
- Create: `tests/auth-client.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for auth helpers**

Create tests validating:
- phone normalization utility
- nickname validation utility
- masked phone display utility

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test
```

Expected: FAIL due to missing `src/auth-client.js`.

- [ ] **Step 3: Implement `auth-client.js` minimal API**

Export:
- `normalizePhoneNumber(raw)`
- `validateNickname(name)`
- `maskPhoneNumber(phone)`
- `createAuthClient({ supabaseUrl, supabaseAnonKey })` with:
  - `sendOtp(phone)`
  - `verifyOtp(phone, token)`
  - `getSession()`
  - `signOut()`
  - `getProfile(userId)`
  - `upsertProfile(userId, nickname)`

- [ ] **Step 4: Update test script**

`package.json`:

```json
{
  "scripts": {
    "test": "node tests/core.test.js && node tests/leaderboard.test.js && node tests/auth-client.test.js"
  }
}
```

- [ ] **Step 5: Verify green**

Run `npm test` and confirm all pass.

### Task 3: Add Login Modal and HUD Auth Controls

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Add login modal markup**

Add fields:
- phone input
- send OTP button
- code input
- verify/login button
- status/error text

- [ ] **Step 2: Add HUD logout area**

Add:
- auth label (`已登录: 138****1234`)
- `退出登录` button

- [ ] **Step 3: Add styles for login flow**

Ensure modal and disabled states are clear on desktop and mobile widths.

### Task 4: Integrate Auth Gate in Runtime

**Files:**
- Modify: `src/main-standalone.js`

- [ ] **Step 1: Wire auth client boot**

Create auth client with existing Supabase config and load session at startup.

- [ ] **Step 2: Enforce gate**

If unauthenticated:
- show login modal
- disable `start`, `restart`, `records query`

If authenticated:
- close login modal
- enable actions

- [ ] **Step 3: Implement send OTP / verify OTP handlers**

Hook buttons to:
- `sendOtp(phone)`
- `verifyOtp(phone, code)`

Update UI status during async operations.

- [ ] **Step 4: Implement sign out**

On logout:
- clear auth state
- show login modal
- disable gameplay actions

### Task 5: Bind Nickname to Account Profile

**Files:**
- Modify: `src/main-standalone.js`
- Modify: `index.html` (if nickname modal text needs auth phrasing)

- [ ] **Step 1: Replace pure local nickname source**

After login, fetch profile by `auth.uid()`.

- [ ] **Step 2: Require first-time nickname setup**

If no profile row:
- force nickname modal (cannot cancel)
- upsert profile

- [ ] **Step 3: Allow rename**

`改昵称` updates `player_profiles.nickname` then refreshes HUD label.

- [ ] **Step 4: Keep local cache as optimization**

Optional local cache is allowed, but source of truth is profile table.

### Task 6: Submit Scores with Account Identity

**Files:**
- Modify: `src/main-standalone.js`
- Modify: `src/leaderboard-client.js`

- [ ] **Step 1: Add `user_id` to submit payload**

Use current session `user.id`.

- [ ] **Step 2: Keep rank computation path**

Continue:
- insert score row
- fetch rows
- compute rank `#N`

- [ ] **Step 3: Ensure top15 query unchanged for history panel**

Keep `Top15` + created_at formatting.

- [ ] **Step 4: Handle auth-expired errors**

If insert fails due to auth:
- prompt re-login
- keep game playable after login restored

### Task 7: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README auth section**

Document:
- must login first
- phone OTP flow
- account-bound nickname
- cross-device behavior

- [ ] **Step 2: Update Supabase setup section**

Point to SQL changes for `player_profiles` + `user_id` + RLS.

- [ ] **Step 3: Update CHANGELOG**

Add entries for auth gate, OTP login, logout, account nickname.

- [ ] **Step 4: Run final checks**

Commands:

```bash
node --check src/main-standalone.js
npm test
```

Expected: no syntax errors; all tests pass.

- [ ] **Step 5: Manual E2E validation**

1. Device A: login phone OTP, set nickname, play 1 round  
2. Device B: login same account, verify nickname auto loads and history includes prior score  
3. Sign out and verify start button is disabled until login again
