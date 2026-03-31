# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added - 2026-03-31
- Added new underwater target "愤怒章鱼哥" in gameplay configs:
  - `src/main-standalone.js`
  - `src/config.js`
- Added ink corrosion utility `applyInkCorrosion` to `src/items.js`.
- Added core test for ink corrosion range behavior in `tests/core.test.js`.

### Changed - 2026-03-31
- Updated standalone gameplay loop (`src/main-standalone.js`) to:
  - trigger ink splash expansion when hook catches angry octopus
  - corrode/remove nearby other targets within configurable radius
  - apply configurable octopus penalty score (default `-200`)
  - render negative score popup style and ink spread effect
- Synced module gameplay (`src/game.js`) with octopus ink splash + penalty behavior.
- Updated `README.md` with octopus rules, config locations, and local validation steps.

### Added - 2026-03-30
- Added design spec: `docs/superpowers/specs/2026-03-30-evil-girl-gold-miner-design.md`
- Added implementation plan: `docs/superpowers/plans/2026-03-30-evil-girl-gold-miner-mvp.md`
- Added project docs: `README.md`, `CHANGELOG.md`
- Added phone OTP auth client: `src/auth-client.js`
- Added auth helper tests: `tests/auth-client.test.js`
- Added playable MVP files:
  - `index.html`
  - `styles.css`
  - `src/main.js`
  - `src/game.js`
  - `src/hook.js`
  - `src/items.js`
  - `src/config.js`
  - `src/ui.js`
  - `assets/images/README.md`
  - `assets/images/.gitkeep`
  - `tests/core.test.js`
  - `package.json`
  - `src/leaderboard-utils.js`
  - `src/leaderboard-client.js`
  - `tests/leaderboard.test.js`
  - `docs/supabase-setup.md`

### Changed - 2026-03-30
- Updated `README.md` from planning view to current playable MVP usage.
- Switched `index.html` runtime script to `src/main-standalone.js` so `file://` double-click opening works without ES module import restrictions.
- Added per-role `spriteScale` and adaptive circular crop (auto trims transparent padding before circle clipping).
- Added idle hook direction preview line so launch direction is visible before pressing Space.
- Rebalanced item movement/pull speeds closer to classic gold-miner pacing (big targets slower, critters faster).
- Replaced background with undersea style and subtle animated wave lines.
- Adjusted scene composition to "small shore + large underwater area" and moved waterline upward.
- Simplified launch-direction preview to a short soft guide line (removed dashed line and preview hook head).
- Added rescued-husband display near the girl after catching husband targets (up to 3 visible icons).
- Updated hook visuals to closer claw style and extended max hook length to reach all map targets.
- Added floating score popup (e.g. `+300`) when an item is successfully delivered.
- Added audio system with BGM loop and gameplay SFX (launch/catch/score/win/lose) for standalone runtime.
- Added `assets/audio/README.md` with required filenames and placement guide.
- Switched standalone audio to use uploaded MP3 SFX only (`hook-launch.mp3`, `score-pop.mp3`, `win.mp3`, `lose.mp3`) and disabled BGM.
- Result overlay now shows only current run rank (`#N`) instead of full leaderboard list.
- Added main-page "Records" query modal to show global Top15 history with played-at time (`YYYY-MM-DD HH:mm`).
- Added leaderboard client method for direct Top-N query and kept round rank sync flow intact.
- Added Supabase cross-device leaderboard flow in standalone runtime:
  - first-run nickname modal + localStorage persistence
  - rename button in HUD
  - round-end score submission with `player_name`, `score`, `duration_seconds`, `captured_husband_count`
  - global mixed leaderboard (Top20) in result overlay
  - per-round rank display (`#N / total`)
  - graceful fallback when Supabase config is missing or unavailable
- Updated `index.html` and `styles.css` to support nickname and leaderboard UI.
- Updated `package.json` test script to run leaderboard tests.
- Rebuilt `src/main-standalone.js` with mandatory phone OTP login gate:
  - unauthenticated users cannot start/restart/query records
  - login success checks/loads account nickname from `player_profiles`
  - first login requires nickname setup (1-12 chars)
  - HUD now supports logout and returns to login state after sign-out
  - score submission now includes `user_id`
  - round-end rank and Top15 records flow remain available after login
- Updated `src/leaderboard-client.js` select columns to include `user_id`.
- Updated `index.html` and `styles.css` for auth-disabled controls and login inputs.
- Rewrote `docs/supabase-setup.md` in UTF-8 and added Auth/Profile SQL + RLS policies.
- Rewrote `README.md` in UTF-8 and synced auth/leaderboard instructions.
- Updated `package.json` test script to include `tests/auth-client.test.js`.

### Verified - 2026-03-30
- Ran `npm test` and got all-pass on core hook/collision checks.

---

## Update Template

### Added - YYYY-MM-DD
- What was newly added (with file path)

### Changed - YYYY-MM-DD
- What behavior/parameter/structure changed

### Fixed - YYYY-MM-DD
- What bug was fixed and under what condition

### Removed - YYYY-MM-DD
- What was removed and why
