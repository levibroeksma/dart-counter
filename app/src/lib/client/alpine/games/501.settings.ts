import Alpine from "alpinejs";
import type { FiveOhOnePlayer } from "@lib/shared/games/501/settings";

const FIVE_OH_ONE_SESSION_KEY = "501-session";

/**
 * Alpine state factory for 501 settings and player selection.
 */
export function fiveOhOneSettings(displayName: string, userId: string) {
  const userPlayer: FiveOhOnePlayer = {
    id: userId,
    type: "user",
    name: displayName,
  };

  return {
    matchMode: "best-of" as "best-of" | "first-to",
    unit: "legs" as "legs" | "sets",
    players: [userPlayer] as FiveOhOnePlayer[],
    guestModalOpen: false,
    guestNameDraft: "",
    inProgressSession: false,

    get hasGuest() {
      return this.players.length > 1;
    },

    openGuestModal() {
      this.guestModalOpen = true;
      this.guestNameDraft = "";
    },

    cancelGuestModal() {
      this.guestModalOpen = false;
    },

    confirmGuest() {
      const guestName = this.guestNameDraft.trim();
      if (!guestName || this.hasGuest) return;

      const guest: FiveOhOnePlayer = {
        id: crypto.randomUUID(),
        type: "guest",
        name: guestName,
      };
      this.players = [...this.players, guest];
      this.guestModalOpen = false;
      this.guestNameDraft = "";
    },

    removeGuest() {
      if (!this.hasGuest) return;
      this.players = this.players.filter((player) => player.type !== "guest");
    },

    serializePlayers(): string {
      return JSON.stringify(this.players);
    },

    checkInProgressSession() {
      const key = Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY);
      this.inProgressSession = sessionStorage.getItem(key) !== null;
    },

    resumeGame() {
      window.location.href = "/games/501";
    },

    abandonSession() {
      sessionStorage.removeItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY));
      this.inProgressSession = false;
    },
  };
}
