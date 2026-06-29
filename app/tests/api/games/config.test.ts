import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, PUT } from "../../../src/pages/api/games/[slug]/config";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetGameBySlug = vi.fn();
const mockGetGameConfig = vi.fn();
const mockSaveGameConfig = vi.fn();

vi.mock("@lib/server/data/games", () => ({
  getGameBySlug: (...args: unknown[]) => mockGetGameBySlug(...args),
  getGameConfig: (...args: unknown[]) => mockGetGameConfig(...args),
  saveGameConfig: (...args: unknown[]) => mockSaveGameConfig(...args),
}));

const mockSession: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

const game501 = {
  slug: "501",
  displayName: "501",
  sortOrder: 1,
  enabled: true,
};

function createGetContext(slug = "501"): APIContext {
  return {
    params: { slug },
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

function createPutContext(
  slug: string,
  body: unknown,
  rawBody?: string
): APIContext {
  return {
    params: { slug },
    request: new Request(`http://localhost/api/games/${slug}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: rawBody ?? JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("GET /api/games/[slug]/config", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetGameBySlug.mockReset();
    mockGetGameConfig.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns 404 for unknown game", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(null);

    const response = await GET(createGetContext("unknown"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ ok: false, code: MessageCode.UNKNOWN_GAME });
  });

  it("returns saved config when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);
    const config = {
      slug: "501",
      settings: { doubleOut: true },
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    mockGetGameConfig.mockResolvedValue(config);

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, config });
    expect(mockGetGameConfig).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "501");
  });

  it("returns empty config when none saved", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);
    mockGetGameConfig.mockResolvedValue(null);

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      ok: true,
      config: { slug: "501", settings: {}, updatedAt: "" },
    });
  });

  it("returns 500 when config read fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);
    mockGetGameConfig.mockRejectedValue(new Error("database down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});

describe("PUT /api/games/[slug]/config", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetGameBySlug.mockReset();
    mockSaveGameConfig.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await PUT(createPutContext("501", { settings: {} }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns 404 for unknown game", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(null);

    const response = await PUT(createPutContext("unknown", { settings: {} }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ ok: false, code: MessageCode.UNKNOWN_GAME });
  });

  it("returns 400 for invalid JSON", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);

    const response = await PUT(createPutContext("501", {}, "not-json"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
    expect(mockSaveGameConfig).not.toHaveBeenCalled();
  });

  it("returns 400 when settings missing", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);

    const response = await PUT(createPutContext("501", {}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
    expect(mockSaveGameConfig).not.toHaveBeenCalled();
  });

  it("saves config when valid", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);
    const saved = {
      slug: "501",
      settings: { doubleOut: true },
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    mockSaveGameConfig.mockResolvedValue(saved);

    const response = await PUT(
      createPutContext("501", { settings: { doubleOut: true } })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, config: saved });
    expect(mockSaveGameConfig).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "501", {
      doubleOut: true,
    });
  });

  it("returns 500 when save fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameBySlug.mockResolvedValue(game501);
    mockSaveGameConfig.mockRejectedValue(new Error("database down"));

    const response = await PUT(
      createPutContext("501", { settings: { doubleOut: true } })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
