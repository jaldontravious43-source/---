import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadUtils() {
  const code = fs.readFileSync("src/leaderboard-utils.js", "utf8");
  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(code, context);
  return context.globalThis.LeaderboardUtils;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const { sortLeaderboardRows, findInsertedEntryRank } = loadUtils();

runTest("sortLeaderboardRows sorts by score desc, duration asc, created_at asc", () => {
  const rows = [
    { id: "a", score: 100, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "b", score: 300, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "c", score: 300, duration_seconds: 58, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "d", score: 300, duration_seconds: 58, created_at: "2026-03-30T09:59:00.000Z" }
  ];
  const sorted = sortLeaderboardRows(rows);
  assert.equal(sorted.map((row) => row.id).join(","), "d,c,b,a");
});

runTest("findInsertedEntryRank returns 1-based rank", () => {
  const rows = [
    { id: "x", score: 400, duration_seconds: 55, created_at: "2026-03-30T10:00:00.000Z" },
    { id: "y", score: 300, duration_seconds: 60, created_at: "2026-03-30T10:00:00.000Z" }
  ];
  assert.equal(findInsertedEntryRank(rows, "y"), 2);
  assert.equal(findInsertedEntryRank(rows, "missing"), null);
});

console.log("Leaderboard utility tests completed.");
