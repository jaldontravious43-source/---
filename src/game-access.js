export const canStartRound = () => true;

export const canSubmitScore = ({ isAuthed, leaderboardEnabled }) =>
  isAuthed === true && leaderboardEnabled === true;

export const getRecordsAction = ({ isAuthed }) =>
  (isAuthed === true ? 'open_records' : 'prompt_login');

export const getInitAuthPolicy = ({ authEnabled, hasSession }) => ({
  shouldApplyLoggedIn: authEnabled === true && hasSession === true,
  openAuthModal: false
});
