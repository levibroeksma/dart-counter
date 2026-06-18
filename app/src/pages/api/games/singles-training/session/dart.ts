import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyDartToSession,
} from "@lib/shared/games/singles-training/state";
import {
  isValidOutcomeForTarget,
  type DartOutcome,
} from "@lib/shared/games/singles-training/dart";
import { buildSummary } from "@lib/shared/games/singles-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/singles-training/stats";
import { getSession } from "@lib/server/auth/session";
import {
  deleteSinglesTrainingSession,
  getSinglesTrainingSession,
  saveSinglesTrainingSession,
} from "@lib/server/data/singles-training-session";
import {
  getPlayerSinglesTrainingStats,
  savePlayerSinglesTrainingStats,
} from "@lib/server/data/player-singles-training-stats";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isDartOutcome(value: unknown): value is DartOutcome {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const outcome = value as Record<string, unknown>;
  return (
    outcome.type === "miss" ||
    outcome.type === "single" ||
    outcome.type === "double" ||
    outcome.type === "triple"
  );
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getSinglesTrainingSession(auth.userId);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }
  if (session.state.status !== "active") {
    return jsonResponse({ ok: false, code: MessageCode.GAME_COMPLETED }, 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  if (!payload || typeof payload !== "object" || !("outcome" in payload)) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const record = payload as Record<string, unknown>;
  if (!isDartOutcome(record.outcome)) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const target = session.targetSequence[session.state.currentTargetIndex];
  if (!isValidOutcomeForTarget(target, record.outcome)) {
    return jsonResponse({ ok: false, code: MessageCode.INVALID_DART_OUTCOME }, 400);
  }

  try {
    const nextSession = applyDartToSession(session, record.outcome);
    if (
      nextSession.state.status === "completed" ||
      nextSession.state.status === "dead"
    ) {
      const summary = buildSummary(nextSession);
      const stats = await getPlayerSinglesTrainingStats(auth.userId);
      applyGameCompletionToStats(stats, nextSession);
      await savePlayerSinglesTrainingStats(auth.userId, stats);
      await deleteSinglesTrainingSession(auth.userId);
      return jsonResponse(
        { ok: true, session: nextSession, terminal: true, summary },
        200,
      );
    }

    await saveSinglesTrainingSession(auth.userId, nextSession);
    return jsonResponse({ ok: true, session: nextSession }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
