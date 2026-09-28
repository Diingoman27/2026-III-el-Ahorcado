export const state = {
  token: null,
  user: null,
  difficulty: 'easy',
  gameId: null,
  dailyWordId: null,
  challengeStartTime: null,
};

export function setState(patch) {
  Object.assign(state, patch);
}
