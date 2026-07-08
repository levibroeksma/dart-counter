import type { FiveOhOneSession } from "@lib/shared/games/501";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training";
import { isHit, type SinglesTrainingSession } from "@lib/shared/games/singles-training";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down";
import { countVisitMilestones } from "./milestones";
import type { StatCompletionRecord } from "./types";

export type CompletionSnapshotInsert = Omit<StatCompletionRecord, "id" | "completedAt"> & {
  completedAt?: string;
};

function createBaseSnapshot(gameSlug: StatCompletionRecord["gameSlug"]): CompletionSnapshotInsert {
  return {
    gameSlug,
    pointsScored: 0,
    dartsThrown: 0,
    scoringPoints: 0,
    scoringVisits: 0,
    doubleAttempts: 0,
    doubleHits: 0,
    visits100Plus: 0,
    visits120Plus: 0,
    visits140Plus: 0,
    visits180: 0,
    segmentHits: 0,
    segmentAttempts: 0,
  };
}

/**
 * Builds a completion snapshot for 501 from user-only visits.
 */
export function build501CompletionSnapshot(session: FiveOhOneSession): CompletionSnapshotInsert {
  const userIds = new Set(
    session.settings.players.filter((player) => player.type === "user").map((player) => player.id),
  );
  const userVisits = session.visitHistory.filter((visit) => userIds.has(visit.playerId));

  let pointsScored = 0;
  let dartsThrown = 0;
  let scoringPoints = 0;
  let doubleAttempts = 0;
  let doubleHits = 0;
  const visitScores: number[] = [];

  for (const visit of userVisits) {
    pointsScored += Math.max(visit.remainingBefore - visit.remainingAfter, 0);
    dartsThrown += visit.dartsThrown;
    scoringPoints += visit.visitScore;
    visitScores.push(visit.visitScore);
    doubleAttempts += visit.dartsOnDouble ?? 0;
    if (visit.checkout) doubleHits += 1;
  }

  return {
    ...createBaseSnapshot("501"),
    pointsScored,
    dartsThrown,
    scoringPoints,
    scoringVisits: userVisits.length,
    doubleAttempts,
    doubleHits,
    ...countVisitMilestones(visitScores),
  };
}

/**
 * Builds a completion snapshot for score-training rounds.
 */
export function buildScoreTrainingCompletionSnapshot(
  session: ScoreTrainingSession,
): CompletionSnapshotInsert {
  const visitScores = session.roundHistory.map((round) => round.visitScore);
  const scoringPoints = visitScores.reduce((sum, score) => sum + score, 0);

  return {
    ...createBaseSnapshot("score-training"),
    scoringPoints,
    scoringVisits: session.roundHistory.length,
    ...countVisitMilestones(visitScores),
  };
}

/**
 * Builds a completion snapshot for ten-up-one-down doubles rounds.
 */
export function buildTenUpOneDownCompletionSnapshot(
  session: TenUpOneDownSession,
): CompletionSnapshotInsert {
  let doubleAttempts = 0;
  let doubleHits = 0;

  for (const round of session.roundHistory) {
    doubleAttempts += round.dartsOnDouble;
    if (round.finished) doubleHits += 1;
  }

  return {
    ...createBaseSnapshot("ten-up-one-down"),
    doubleAttempts,
    doubleHits,
  };
}

/**
 * Builds a completion snapshot for singles-training dart accuracy.
 */
export function buildSinglesTrainingCompletionSnapshot(
  session: SinglesTrainingSession,
): CompletionSnapshotInsert {
  const segmentAttempts = session.dartHistory.length;
  const segmentHits = session.dartHistory.filter((dart) => isHit(dart.outcome)).length;

  return {
    ...createBaseSnapshot("singles-training"),
    segmentHits,
    segmentAttempts,
  };
}
