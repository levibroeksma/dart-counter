import { describe, it, expect } from "vitest";
import {
  getCheckoutConstraints,
  buildSuccessModalQuestions,
} from "@lib/shared/darts/checkout-constraints";

describe("getCheckoutConstraints", () => {
  it("returns table entries for known targets", () => {
    expect(getCheckoutConstraints(41)).toEqual({ minFinish: 2, maxFinish: 3 });
    expect(getCheckoutConstraints(40)).toEqual({ minFinish: 1, maxFinish: 3 });
    expect(getCheckoutConstraints(170)).toEqual({ minFinish: 3, maxFinish: 3 });
    expect(getCheckoutConstraints(161)).toEqual({ minFinish: 3, maxFinish: 3 });
  });

  it("returns null for bogeys", () => {
    expect(getCheckoutConstraints(169)).toBeNull();
  });
});

describe("buildSuccessModalQuestions", () => {
  it("41 shows darts for finish [2,3] and darts on double [1,2]", () => {
    const questions = buildSuccessModalQuestions(41);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [2, 3] },
      { id: "dartsOnDouble", label: "Darts on double", options: [1, 2] },
    ]);
  });

  it("40 shows both pickers with full ranges", () => {
    const questions = buildSuccessModalQuestions(40);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [1, 2, 3] },
      { id: "dartsOnDouble", label: "Darts on double", options: [1, 2, 3] },
    ]);
  });

  it("170 auto-fills both values (submit-only modal)", () => {
    const questions = buildSuccessModalQuestions(170);
    expect(questions).toEqual([
      { id: "dartsForFinish", label: "Darts for finish", options: [3], autoValue: 3 },
      { id: "dartsOnDouble", label: "Darts on double", options: [1], autoValue: 1 },
    ]);
  });
});
