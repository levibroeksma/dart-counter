// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimulatedVisit } from "@lib/shared/dartbot";
import { animateDartBotVisit } from "@lib/client/alpine/games/dartbot-turn-modal";

function buildVisit(labels: string[]): SimulatedVisit {
  return {
    darts: labels.map((label) => ({
      target: { label, score: 0, ring: "single", base: 20, adjacent: [] },
      actual: { label, score: 0, ring: "single", base: 20, adjacent: [] },
      score: 0,
    })),
    visitScore: 0,
    bust: false,
    checkout: false,
  };
}

describe("animateDartBotVisit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits each dart after delay and completes", async () => {
    vi.useFakeTimers();
    const events: string[] = [];

    const done = animateDartBotVisit(buildVisit(["T20", "T20", "D20"]), {
      dartMs: 400,
      onDart: (segmentLabel) => events.push(segmentLabel),
      onComplete: () => events.push("complete"),
    });

    await vi.advanceTimersByTimeAsync(399);
    expect(events).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual(["T20"]);

    await vi.advanceTimersByTimeAsync(400);
    expect(events).toEqual(["T20", "T20"]);

    await vi.advanceTimersByTimeAsync(400);
    await done;
    expect(events).toEqual(["T20", "T20", "D20", "complete"]);
  });

  it("skips remaining delays when aborted and still completes once", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const controller = new AbortController();

    const done = animateDartBotVisit(buildVisit(["20", "5", "1"]), {
      dartMs: 500,
      onDart: (segmentLabel) => events.push(segmentLabel),
      onComplete: () => events.push("complete"),
      signal: controller.signal,
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(events).toEqual(["20"]);

    controller.abort();
    await done;

    expect(events).toEqual(["20", "complete"]);
  });

  it("pauses timers while page is hidden and resumes on visibilitychange", async () => {
    vi.useFakeTimers();
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });

    const events: string[] = [];
    hidden = true;

    const done = animateDartBotVisit(buildVisit(["T19"]), {
      dartMs: 300,
      onDart: (segmentLabel) => events.push(segmentLabel),
      onComplete: () => events.push("complete"),
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(events).toEqual([]);

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(300);
    await done;

    expect(events).toEqual(["T19", "complete"]);
  });
});
