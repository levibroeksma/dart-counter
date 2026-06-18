import { vi } from "vitest";

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: vi.fn(() => ({
    handler: vi.fn(() => ({
      GET: vi.fn(async () => new Response(null, { status: 404 })),
      POST: vi.fn(async () => new Response(null, { status: 404 })),
      PUT: vi.fn(async () => new Response(null, { status: 404 })),
      DELETE: vi.fn(async () => new Response(null, { status: 404 })),
      PATCH: vi.fn(async () => new Response(null, { status: 404 })),
    })),
  })),
}));
