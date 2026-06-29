import { describe, it, expect } from "vitest";
import { validateCompletedSinglesTrainingSession } from "@lib/shared/games/singles-training/completion";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";
import { ALL_TARGETS } from "@lib/shared/games/singles-training/target-sequence";

function buildDeadSession() {
  let session = buildSinglesTrainingSession({
    direction: "low-to-high",
    mode: "hard",
    scoring: "traditional",
  });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  return session;
}

describe("validateCompletedSinglesTrainingSession", () => {
  it("accepts a legitimately dead session", () => {
    const session = buildDeadSession();
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.state.status).toBe("dead");
  });

  it("rejects active session", () => {
    const session = buildSinglesTrainingSession({
      direction: "low-to-high",
      mode: "normal",
      scoring: "traditional",
    });
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.GAME_NOT_COMPLETE });
  });

  it("rejects tampered score", () => {
    const session = buildDeadSession();
    session.state.score = 999;
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_DART_OUTCOME });
  });

  it("rejects invalid target sequence for low-to-high", () => {
    const session = buildDeadSession();
    session.targetSequence = [2, 1, ...ALL_TARGETS.slice(2)];
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedSinglesTrainingSession({ slug: "501" });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
