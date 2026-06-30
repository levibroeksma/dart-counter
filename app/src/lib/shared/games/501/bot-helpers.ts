import type { FiveOhOnePlayer, FiveOhOneSession } from "./types";

function getPlayerById(
  session: FiveOhOneSession,
  playerId: string,
): FiveOhOnePlayer | undefined {
  return session.settings.players.find((player) => player.id === playerId);
}

export function getOpponentPlayer(
  session: FiveOhOneSession,
  playerId: string,
): FiveOhOnePlayer | undefined {
  return session.settings.players.find((player) => player.id !== playerId);
}

export function isDartBotSession(session: FiveOhOneSession): boolean {
  return (
    session.settings.players.length === 2 &&
    session.settings.players.some((player) => player.type === "dartbot")
  );
}

export function isDartBotTurn(session: FiveOhOneSession): boolean {
  const current = getPlayerById(session, session.state.currentPlayerId);
  return current?.type === "dartbot";
}

export function lastTwoVisitsAreUserThenDartBot(
  session: FiveOhOneSession,
): boolean {
  if (session.visitHistory.length < 2) return false;

  const userVisit = session.visitHistory.at(-2);
  const botVisit = session.visitHistory.at(-1);
  if (!userVisit || !botVisit) return false;

  const firstPlayer = getPlayerById(session, userVisit.playerId);
  const secondPlayer = getPlayerById(session, botVisit.playerId);

  return firstPlayer?.type === "user" && secondPlayer?.type === "dartbot";
}

export function canUndoDartBotPair(session: FiveOhOneSession): boolean {
  return (
    isDartBotSession(session) &&
    !isDartBotTurn(session) &&
    lastTwoVisitsAreUserThenDartBot(session)
  );
}

export function canUndoUserCheckoutBeforeBotLegStart(
  session: FiveOhOneSession,
): boolean {
  if (!isDartBotSession(session) || !isDartBotTurn(session)) return false;
  const last = session.visitHistory.at(-1);
  if (!last?.checkout) return false;
  const player = getPlayerById(session, last.playerId);
  return player?.type === "user";
}
