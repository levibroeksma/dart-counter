import { afterEach, describe, expect, it, vi } from "vitest";
import { createId } from "@lib/shared/utils/id";

describe("createId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID in a secure context", () => {
    vi.stubGlobal("isSecureContext", true);
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back when not in a secure context", () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("crypto", { randomUUID: vi.fn() });

    const id = createId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
