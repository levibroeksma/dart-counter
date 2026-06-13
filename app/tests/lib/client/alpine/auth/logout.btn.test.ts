// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("logoutBtn", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createComponent(redirect = "/login") {
    const button = document.createElement("button");
    button.dataset.redirect = redirect;
    document.body.appendChild(button);

    const component = logoutBtn() as ReturnType<typeof logoutBtn> & {
      $el: HTMLButtonElement;
      logout: () => Promise<void>;
    };
    component.$el = button;
    return component;
  }

  it("starts with loading false and no error", () => {
    const component = createComponent();
    expect(component.loading).toBe(false);
    expect(component.error).toBe("");
  });

  it("POSTs to logout API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    const component = createComponent();
    await component.logout();

    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });

  it("redirects to /login on successful logout", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent();
    await component.logout();

    expect(window.location.href).toBe("/login");
  });

  it("redirects to custom path from data-redirect", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent("/goodbye");
    await component.logout();

    expect(window.location.href).toBe("/goodbye");
  });

  it("displays network error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    const component = createComponent();
    await component.logout();

    expect(component.error).toBe("Unable to connect. Please try again.");
    expect(component.loading).toBe(false);
  });

  it("displays translated error when API returns ok: false", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_CONFIG }),
    } as Response);

    const component = createComponent();
    await component.logout();

    expect(component.error).toBe("Server configuration error");
    expect(component.loading).toBe(false);
  });
});
