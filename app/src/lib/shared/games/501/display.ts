import type { FiveOhOnePlayer } from "./types";

export function format501PlayerDisplayName(player: FiveOhOnePlayer): string {
  if (player.type === "dartbot") return `DartBot - lvl ${player.level}`;
  return player.name;
}
