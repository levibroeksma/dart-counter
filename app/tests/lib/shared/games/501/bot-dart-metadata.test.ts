import { describe, expect, it } from "vitest";
import type { SimulatedVisit } from "@lib/shared/dartbot";
import {
  deriveBotVisitDartMetadata,
  format501PlayerDisplayName,
} from "@lib/shared/games/501";

describe("deriveBotVisitDartMetadata", () => {
  it("counts double/bull rings as dartsOnDouble", () => {
    const visit = {
      darts: [
        { target: {}, actual: { ring: "single", label: "T20", score: 60 }, score: 60 },
        { target: {}, actual: { ring: "double", label: "D10", score: 20 }, score: 20 },
        { target: {}, actual: { ring: "double", label: "D10", score: 20 }, score: 20 },
      ],
      visitScore: 100,
      bust: false,
      checkout: true,
    } as SimulatedVisit;
    const meta = deriveBotVisitDartMetadata(visit);
    expect(meta.dartsThrown).toBe(3);
    expect(meta.dartsOnDouble).toBe(2);
    expect(meta.dartsForFinish).toBe(3);
  });

  it("omits dartsForFinish when visit is not a checkout", () => {
    const visit = {
      darts: [
        { target: {}, actual: { ring: "triple", label: "T20", score: 60 }, score: 60 },
      ],
      visitScore: 60,
      bust: false,
      checkout: false,
    } as SimulatedVisit;
    const meta = deriveBotVisitDartMetadata(visit);
    expect(meta.dartsThrown).toBe(1);
    expect(meta.dartsOnDouble).toBe(0);
    expect(meta.dartsForFinish).toBeUndefined();
  });
});

describe("format501PlayerDisplayName", () => {
  it("formats dartbot with level", () => {
    expect(
      format501PlayerDisplayName({
        id: "bot",
        type: "dartbot",
        name: "DartBot",
        level: 7,
      }),
    ).toBe("DartBot - lvl 7");
  });

  it("returns name for user and guest players", () => {
    expect(
      format501PlayerDisplayName({ id: "u1", type: "user", name: "Alice" }),
    ).toBe("Alice");
    expect(
      format501PlayerDisplayName({ id: "g1", type: "guest", name: "Bob" }),
    ).toBe("Bob");
  });
});
