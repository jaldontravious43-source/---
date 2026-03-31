export const canStartRound = () => true;

export const canSubmitScore = ({ isAuthed, leaderboardEnabled }) =>
  isAuthed === true && leaderboardEnabled === true;

export const getRecordsAction = ({ isAuthed }) =>
  (isAuthed === true ? 'open_records' : 'prompt_login');
