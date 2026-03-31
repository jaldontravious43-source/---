import assert from "node:assert/strict";
import { Hook } from "../src/hook.js";
import { applyInkCorrosion, hitTestCircle } from "../src/items.js";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("hook should start idle and swinging", () => {
  const hook = new Hook({ x: 100, y: 100 }, { minAngle: -0.8, maxAngle: 0.8 });
  assert.equal(hook.state, "idle");
  const previousAngle = hook.angle;
  hook.update(0.016, { width: 1280, height: 720 });
  assert.notEqual(hook.angle, previousAngle);
});

runTest("hook should fire and retract to idle", () => {
  const hook = new Hook({ x: 100, y: 100 }, { minAngle: -0.5, maxAngle: 0.5, maxLength: 120 });
  hook.fire();
  assert.equal(hook.state, "extending");

  for (let index = 0; index < 300; index += 1) {
    hook.update(0.016, { width: 300, height: 300 });
  }

  assert.equal(hook.state, "idle");
  assert.equal(Math.round(hook.length), 0);
});

runTest("hit test circle should detect overlap", () => {
  assert.equal(hitTestCircle({ x: 10, y: 10, r: 5 }, { x: 15, y: 10, r: 5 }), true);
  assert.equal(hitTestCircle({ x: 10, y: 10, r: 3 }, { x: 30, y: 30, r: 4 }), false);
});

runTest("ink corrosion should remove nearby items except excluded id", () => {
  const items = [
    { id: 1, x: 120, y: 180, radius: 20, typeKey: "starHandsome" },
    { id: 2, x: 220, y: 180, radius: 20, typeKey: "hamster" },
    { id: 3, x: 340, y: 180, radius: 20, typeKey: "husband" }
  ];

  const { remainingItems, corrodedItems } = applyInkCorrosion(items, { x: 130, y: 180 }, 140, [1]);
  assert.deepEqual(
    corrodedItems.map((item) => item.id),
    [2]
  );
  assert.deepEqual(
    remainingItems.map((item) => item.id),
    [1, 3]
  );
});

console.log("All tests completed.");
