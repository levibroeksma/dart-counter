const MAX_SCORE_DIGITS = 3;
const CLICK_BLOCK_MS = 400;

export type ScoreInputState = {
  score: string | null;
  _scoreInputClickBlockedUntil: number;
};

/**
 * Ignores the synthetic click that follows a handled touch on the numpad.
 */
export function shouldIgnoreScoreInputEvent(
  state: ScoreInputState,
  event: Event,
): boolean {
  const { timeStamp } = event;

  if (event.type === "touchend") {
    state._scoreInputClickBlockedUntil = timeStamp + CLICK_BLOCK_MS;
    return false;
  }

  if (event.type === "click" && timeStamp < state._scoreInputClickBlockedUntil) {
    return true;
  }

  return false;
}

/** Appends one digit to the in-progress score string. */
export function appendScoreDigit(
  state: ScoreInputState,
  digit: string,
  event?: Event,
): void {
  if (event && shouldIgnoreScoreInputEvent(state, event)) return;

  const current = state.score ?? "";
  if (current.length >= MAX_SCORE_DIGITS) return;

  state.score = current + digit;
}

/** Removes the last entered score digit. */
export function backspaceScoreDigit(
  state: ScoreInputState,
  event?: Event,
): void {
  if (event && shouldIgnoreScoreInputEvent(state, event)) return;

  if (!state.score) {
    state.score = null;
    return;
  }

  const next = state.score.slice(0, -1);
  state.score = next === "" ? null : next;
}

/** Initial score-input fields for Alpine play components. */
export function createScoreInputFields(): ScoreInputState {
  return {
    score: null,
    _scoreInputClickBlockedUntil: 0,
  };
}
