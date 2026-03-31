import { canStartRound, canSubmitScore, getRecordsAction } from '../src/game-access.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(canStartRound() === true, 'guest should always be able to start a round');

assert(
  canSubmitScore({ isAuthed: false, leaderboardEnabled: true }) === false,
  'unauthenticated users cannot submit even when leaderboard exists'
);
assert(
  canSubmitScore({ isAuthed: true, leaderboardEnabled: false }) === false,
  'leaderboard must be enabled to submit'
);
assert(
  canSubmitScore({ isAuthed: true, leaderboardEnabled: true }) === true,
  'authenticated users with leaderboard enabled can submit'
);

assert(
  getRecordsAction({ isAuthed: false }) === 'prompt_login',
  'unauthenticated users should be prompted to log in'
);
assert(
  getRecordsAction({ isAuthed: true }) === 'open_records',
  'authenticated users should open records'
);

console.log('Game access tests completed.');
