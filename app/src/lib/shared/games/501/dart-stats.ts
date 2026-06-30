import type { PlayerDartStats } from "@lib/shared/stats";
import type { FiveOhOneSession, FiveOhOneVisitRecord } from "./types";

export function apply501VisitToDartStats(
  stats: PlayerDartStats,
  visit: FiveOhOneVisitRecord,
): void {
  if (visit.dartsOnDouble !== undefined) {
    stats.doubleAttempts += visit.dartsOnDouble;
  }
  if (visit.checkout && visit.dartsForFinish !== undefined) {
    stats.doubleHits += 1;
    stats.totalCheckouts += 1;
    stats.totalCheckoutDarts += visit.dartsForFinish;
  }
}

export function applyGameCompletionToDartStats(
  stats: PlayerDartStats,
  session: FiveOhOneSession,
): void {
  const user = session.settings.players.find((p) => p.type === "user");
  if (!user) return;
  for (const visit of session.visitHistory) {
    if (visit.playerId !== user.id) continue;
    if (visit.dartsOnDouble === undefined && !visit.checkout) continue;
    apply501VisitToDartStats(stats, visit);
  }
}
