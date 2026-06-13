// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("loginForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createComponent(redirect = "/") {
    const form = document.createElement("form");
    form.dataset.redirect = redirect;
    document.body.appendChild(form);

    const component = loginForm() as ReturnType<typeof loginForm> & {
      $el: HTMLFormElement;
      submit: () => Promise<void>;
    };
    component.$el = form;
    return component;
  }

  it("starts with empty fields and no error", () => {
    const component = createComponent();
    expect(component.username).toBe("");
    expect(component.password).toBe("");
    expect(component.loading).toBe(false);
    expect(component.error).toBe("");
  });

  it("displays translated error on failed login", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.INVALID_CREDENTIALS }),
    } as Response);

    const component = createComponent();
    component.username = "bad";
    component.password = "bad";

    await component.submit();

    expect(component.error).toBe("Invalid username or password");
    expect(component.loading).toBe(false);
  });

  it("displays network error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    const component = createComponent();
    component.username = "testuser";
    component.password = "testpass";

    await component.submit();

    expect(component.error).toBe("Unable to connect. Please try again.");
    expect(component.loading).toBe(false);
  });

  it("redirects on successful login", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent("/games");
    component.username = "testuser";
    component.password = "testpass";

    await component.submit();

    expect(window.location.href).toBe("/games");
  });

  it("POSTs credentials to login API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent();
    component.username = "testuser";
    component.password = "testpass";

    await component.submit();

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser", password: "testpass" }),
    });
  });
});
