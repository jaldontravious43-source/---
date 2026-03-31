import assert from "node:assert/strict";
import {
  canStartRound,
  canSubmitScore,
  getRecordsAction,
  getInitAuthPolicy,
  shouldPromptLoginForRecords,
  shouldRequireNickname
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

runTest("init policy avoids auto auth modal when auth service unavailable", () => {
  const policy = getInitAuthPolicy({ authEnabled: false, hasSession: false });
  assert.equal(policy.openAuthModal, false);
  assert.equal(policy.shouldApplyLoggedIn, false);
});

runTest("init policy avoids auto auth modal when session missing", () => {
  const policy = getInitAuthPolicy({ authEnabled: true, hasSession: false });
  assert.equal(policy.openAuthModal, false);
  assert.equal(policy.shouldApplyLoggedIn, false);
});

runTest("init policy allows logged-in branch when session exists", () => {
  const policy = getInitAuthPolicy({ authEnabled: true, hasSession: true });
  assert.equal(policy.shouldApplyLoggedIn, true);
});

runTest("records helper prompts login for guests", () => {
  assert.equal(shouldPromptLoginForRecords({ isAuthed: false }), true);
  for (const value of [undefined, "yes", 1]) {
    assert.equal(shouldPromptLoginForRecords({ isAuthed: value }), true);
  }
  assert.equal(shouldPromptLoginForRecords({ isAuthed: true }), false);
});

runTest("nickname helper requires nickname only for authed users", () => {
  assert.equal(shouldRequireNickname({ isAuthed: true, nickname: "" }), true);
  assert.equal(shouldRequireNickname({ isAuthed: true, nickname: "  " }), true);
  assert.equal(shouldRequireNickname({ isAuthed: true, nickname: "小红" }), false);
  assert.equal(shouldRequireNickname({ isAuthed: false, nickname: "" }), false);
});

console.log("Game access tests completed.");
