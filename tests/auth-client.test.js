import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadAuthClient() {
  const code = fs.readFileSync("src/auth-client.js", "utf8");
  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(code, context);
  return context.globalThis.AuthClient;
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

const { normalizePhoneNumber, validateNickname, maskPhoneNumber } = loadAuthClient();

runTest("normalizePhoneNumber trims spaces and keeps leading plus", () => {
  assert.equal(normalizePhoneNumber(" +86 138 1234 5678 "), "+8613812345678");
});

runTest("normalizePhoneNumber converts 11-digit CN phone to +86", () => {
  assert.equal(normalizePhoneNumber("13812345678"), "+8613812345678");
});

runTest("normalizePhoneNumber rejects too short value", () => {
  assert.equal(normalizePhoneNumber("12345"), "");
});

runTest("validateNickname validates 1-12 chars", () => {
  assert.equal(validateNickname("A").ok, true);
  assert.equal(validateNickname("123456789012").ok, true);
  assert.equal(validateNickname("").ok, false);
  assert.equal(validateNickname("1234567890123").ok, false);
});

runTest("maskPhoneNumber hides middle digits", () => {
  assert.equal(maskPhoneNumber("+8613812345678"), "+86138****5678");
});

console.log("Auth client tests completed.");
