// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alpine as AlpineType } from "alpinejs";
import { confirmationModalState } from "@lib/client/alpine/stores/confirmationModal.store";

describe("confirmationModalState", () => {
  let Alpine: { effect: (fn: () => void) => void };
  let effectFn: (() => void) | null = null;
  let store: ReturnType<typeof confirmationModalState>;

  beforeEach(() => {
    vi.useFakeTimers();
    effectFn = null;
    Alpine = {
      effect: (fn) => {
        effectFn = fn;
        fn();
      },
    };
    store = confirmationModalState(Alpine as unknown as AlpineType);
    store.init();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("open sets title, message, labels, and showModal", () => {
    store.open({
      title: "Leave game?",
      message: "Progress will be lost.",
      onConfirm: vi.fn(),
      confirmLabel: "Yes",
      cancelLabel: "No",
    });

    expect(store.showModal).toBe(true);
    expect(store.title).toBe("Leave game?");
    expect(store.message).toBe("Progress will be lost.");
    expect(store.confirmLabel).toBe("Yes");
    expect(store.cancelLabel).toBe("No");
  });

  it("open uses default button labels", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
    });

    expect(store.confirmLabel).toBe("Confirm");
    expect(store.cancelLabel).toBe("Cancel");
  });

  it("confirm calls onConfirm then closes modal", () => {
    const onConfirm = vi.fn();
    store.open({
      title: "T",
      message: "M",
      onConfirm,
    });

    store.confirm();

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(store.showModal).toBe(false);
  });

  it("cancel calls optional onCancel then closes modal", () => {
    const onCancel = vi.fn();
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
      onCancel,
    });

    store.cancel();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(store.showModal).toBe(false);
  });

  it("cancel closes without onCancel", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
    });

    store.cancel();

    expect(store.showModal).toBe(false);
  });

  it("reset clears public fields after close", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
      confirmLabel: "Go",
      cancelLabel: "Stop",
    });
    store.cancel();
    effectFn!();
    vi.advanceTimersByTime(100);

    expect(store.title).toBe("");
    expect(store.message).toBe("");
    expect(store.confirmLabel).toBe("Confirm");
    expect(store.cancelLabel).toBe("Cancel");
  });
});
