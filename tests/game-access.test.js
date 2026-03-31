import assert from "node:assert/strict";
import { canStartRound, canSubmitScore, getRecordsAction } from "../src/game-access.js";

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
  assert.equal(canStartRound(), true);
});

runTest("score submit requires strict auth and leaderboard", () => {
  assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: true }), true);
  assert.equal(canSubmitScore({ isAuthed: false, leaderboardEnabled: true }), false);
  assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: false }), false);
  assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: undefined }), false);
});

runTest("score submit rejects non-true auth values", () => {
  for (const value of ["yes", 1, undefined]) {
    assert.equal(canSubmitScore({ isAuthed: value, leaderboardEnabled: true }), false);
  }
});

runTest("score submit rejects non-true leaderboard values", () => {
  for (const value of [false, undefined, 0, "true"]) {
    assert.equal(canSubmitScore({ isAuthed: true, leaderboardEnabled: value }), false);
  }
});

runTest("records action is open_records only when authorized", () => {
  assert.equal(getRecordsAction({ isAuthed: true }), "open_records");
});

runTest("records action prompts login when not strictly authorized", () => {
  assert.equal(getRecordsAction({ isAuthed: false }), "prompt_login");
  for (const value of ["yes", 1, undefined]) {
    assert.equal(getRecordsAction({ isAuthed: value }), "prompt_login");
  }
});

console.log("Game access tests completed.");
