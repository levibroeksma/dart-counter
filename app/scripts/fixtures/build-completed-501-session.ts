import { applyVisit, buildFiveOhOneSession } from "@lib/shared/games/501";

const settings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [{ id: "u1", type: "user" as const, name: "CurlTest" }],
};

let session = buildFiveOhOneSession(settings);

// Deterministic visit sequence summing to 501, ending in checkout from 41
for (const score of [60, 60, 60, 60, 60, 100, 60, 41]) {
  session = applyVisit(session, score);
}

process.stdout.write(JSON.stringify({ session }));
