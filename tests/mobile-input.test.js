import assert from "node:assert/strict";
import {
  createOneTimeUnlocker,
  createTapToFireHandler,
  isInteractiveTarget
} from "../src/main-mobile.js";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("one-time unlock should only play once", () => {
  let count = 0;
  const unlock = createOneTimeUnlocker(() => {
    count += 1;
  });

  unlock();
  unlock();
  unlock();

  assert.equal(count, 1);
});

runTest("tap handler should ignore interactive targets", () => {
  let fired = 0;
  const handler = createTapToFireHandler({
    fireHook: () => {
      fired += 1;
    },
    unlockAudio: () => {},
    shouldIgnoreTarget: isInteractiveTarget,
    isCanvasTarget: () => true
  });

  handler({
    target: { tagName: "BUTTON" },
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });

  assert.equal(fired, 0);
});

runTest("tap handler should not fire outside canvas", () => {
  let fired = 0;
  const handler = createTapToFireHandler({
    fireHook: () => {
      fired += 1;
    },
    unlockAudio: () => {},
    shouldIgnoreTarget: () => false,
    isCanvasTarget: () => false
  });

  handler({
    target: { tagName: "DIV" },
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  });

  assert.equal(fired, 0);
});

runTest("tap handler should unlock and fire on canvas", () => {
  let fired = 0;
  let unlocked = 0;
  const handler = createTapToFireHandler({
    fireHook: () => {
      fired += 1;
    },
    unlockAudio: () => {
      unlocked += 1;
    },
    shouldIgnoreTarget: () => false,
    isCanvasTarget: () => true
  });

  const event = {
    target: { tagName: "CANVAS" },
    cancelable: true,
    preventDefault() {
      this.prevented = true;
    }
  };

  handler(event);

  assert.equal(fired, 1);
  assert.equal(unlocked, 1);
  assert.equal(event.prevented, true);
});

console.log("All tests completed.");
