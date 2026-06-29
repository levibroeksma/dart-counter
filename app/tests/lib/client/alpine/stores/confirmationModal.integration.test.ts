// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from "vitest";
import Alpine from "alpinejs";
import { confirmationModalState } from "@lib/client/alpine/stores/confirmationModal.store";
import { tenUpOneDownPlay } from "@lib/client/alpine/games/ten-up-one-down.play";

beforeAll(() => {
  (Alpine as unknown as Record<string, unknown>).$persist = (value: unknown) => ({
    as: (_key: string) => ({ using: (_storage: Storage) => value }),
  });
});

const roundsSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 1,
    currentTarget: 41,
    status: "active" as const,
    lastAdjustment: null,
  },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

async function flushAlpine() {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("confirmation modal integration", () => {
  it("shows modal after leave() updates reactive store", async () => {
    document.body.innerHTML = `
      <section x-data="play">
        <button id="leave" @click="leave()">Leave</button>
      </section>
      <div id="modal" x-data="{}" x-show="$store.confirmationModal.showModal" x-cloak>Modal</div>
    `;

    Alpine.data("play", () => tenUpOneDownPlay(structuredClone(roundsSession)));
    Alpine.store("confirmationModal", confirmationModalState(Alpine));
    Alpine.start();

    const modal = document.getElementById("modal")!;
    document.getElementById("leave")!.click();
    await flushAlpine();

    expect(
      (Alpine.store("confirmationModal") as ReturnType<
        typeof confirmationModalState
      >).showModal,
    ).toBe(true);
    expect(modal.style.display).not.toBe("none");
  });
});
