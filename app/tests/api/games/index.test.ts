import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET } from "../../../src/pages/api/games/index";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { SEED_GAMES } from "@lib/shared/games/types";

const mockGetGameTypes = vi.fn();

vi.mock("@lib/server/data/games", () => ({
  getGameTypes: (...args: unknown[]) => mockGetGameTypes(...args),
}));

const mockSession: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createGetContext(): APIContext {
  return {
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("GET /api/games", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetGameTypes.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns 401 when logged in without userId", async () => {
    mockSession.isLoggedIn = true;

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns games catalog when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameTypes.mockResolvedValue(SEED_GAMES);

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, games: SEED_GAMES });
    expect(data.games.some((game: { slug: string }) => game.slug === "singles-training")).toBe(
      true
    );
  });

  it("returns 500 when catalog read fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = "00000000-0000-4000-8000-000000000001";
    mockGetGameTypes.mockRejectedValue(new Error("blob down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
