export const canStartRound = () => true;

export const canSubmitScore = ({ isAuthed, leaderboardEnabled }) =>
  Boolean(isAuthed && leaderboardEnabled);

export const getRecordsAction = ({ isAuthed }) =>
  (isAuthed ? 'open_records' : 'prompt_login');
