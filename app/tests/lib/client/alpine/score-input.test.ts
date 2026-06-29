import { describe, expect, it } from "vitest";
import {
  appendScoreDigit,
  backspaceScoreDigit,
  createScoreInputFields,
  shouldIgnoreScoreInputEvent,
} from "@lib/client/alpine/score-input";

describe("shouldIgnoreScoreInputEvent", () => {
  it("blocks synthetic click after touchend", () => {
    const state = createScoreInputFields();

    expect(
      shouldIgnoreScoreInputEvent(state, {
        type: "touchend",
        timeStamp: 100,
      } as Event),
    ).toBe(false);
    expect(
      shouldIgnoreScoreInputEvent(state, {
        type: "click",
        timeStamp: 120,
      } as Event),
    ).toBe(true);
    expect(
      shouldIgnoreScoreInputEvent(state, {
        type: "click",
        timeStamp: 600,
      } as Event),
    ).toBe(false);
  });
});

describe("appendScoreDigit", () => {
  it("appends digits atomically", () => {
    const state = createScoreInputFields();

    appendScoreDigit(state, "5");
    appendScoreDigit(state, "5");

    expect(state.score).toBe("55");
  });

  it("ignores duplicate touchend + click for the same tap", () => {
    const state = createScoreInputFields();

    appendScoreDigit(state, "5", {
      type: "touchend",
      timeStamp: 200,
    } as Event);
    appendScoreDigit(state, "5", {
      type: "click",
      timeStamp: 210,
    } as Event);

    expect(state.score).toBe("5");
  });

  it("allows two quick distinct taps", () => {
    const state = createScoreInputFields();

    appendScoreDigit(state, "5", {
      type: "touchend",
      timeStamp: 200,
    } as Event);
    appendScoreDigit(state, "5", {
      type: "touchend",
      timeStamp: 350,
    } as Event);

    expect(state.score).toBe("55");
  });

  it("limits input to three digits", () => {
    const state = createScoreInputFields();
    state.score = "180";

    appendScoreDigit(state, "0");

    expect(state.score).toBe("180");
  });
});

describe("backspaceScoreDigit", () => {
  it("clears score with backspace", () => {
    const state = createScoreInputFields();
    state.score = "55";

    backspaceScoreDigit(state);
    backspaceScoreDigit(state);

    expect(state.score).toBeNull();
  });
});
