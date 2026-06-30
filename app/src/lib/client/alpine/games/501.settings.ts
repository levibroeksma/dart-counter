import Alpine from 'alpinejs';
import { formatDartbotLevelPreview } from '@lib/shared/dartbot';
import {
  MAX_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_SETS,
  MIN_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_SETS,
  type FiveOhOnePlayer,
} from '@lib/shared/games/501';
import { createId } from '@lib/shared/utils/id';
const FIVE_OH_ONE_SESSION_KEY = '501-session';

/**
 * Alpine state factory for 501 settings and player selection.
 */
export function fiveOhOneSettings(displayName: string, userId: string) {
  const userPlayer: FiveOhOnePlayer = {
    id: userId,
    type: 'user',
    name: displayName,
  };

  return {
    matchMode: 'best-of' as 'best-of' | 'first-to',
    unit: 'legs' as 'legs' | 'sets',
    players: [userPlayer] as FiveOhOnePlayer[],
    opponentPickerOpen: false,
    guestModalOpen: false,
    guestNameDraft: '',
    dartbotLevel: 5,
    inProgressSession: false,
    targetCount: 3,

    get targetCountMin() {
      return this.unit === 'legs'
        ? MIN_TARGET_COUNT_LEGS
        : MIN_TARGET_COUNT_SETS;
    },

    get targetCountMax() {
      return this.unit === 'legs'
        ? MAX_TARGET_COUNT_LEGS
        : MAX_TARGET_COUNT_SETS;
    },

    get hasOpponent() {
      return this.players.length > 1;
    },

    get dartbotLevelPreview() {
      const level = Math.min(
        10,
        Math.max(1, Math.round(Number(this.dartbotLevel) || 1)),
      );
      return formatDartbotLevelPreview(level);
    },

    init() {
      Alpine.effect(() => {
        this.targetCount = Math.min(
          Math.max(this.targetCount, this.targetCountMin),
          this.targetCountMax,
        );
      });
    },

    incrementTargetCount() {
      this.targetCount = Math.min(this.targetCountMax, this.targetCount + 1);
    },
    decrementTargetCount() {
      this.targetCount = Math.max(this.targetCountMin, this.targetCount - 1);
    },

    openOpponentPicker() {
      if (this.hasOpponent) return;
      this.opponentPickerOpen = true;
    },

    cancelOpponentPicker() {
      this.opponentPickerOpen = false;
    },

    pickGuestOpponent() {
      if (this.hasOpponent) return;
      this.opponentPickerOpen = false;
      this.guestModalOpen = true;
      this.guestNameDraft = '';
    },

    cancelGuestModal() {
      this.guestModalOpen = false;
    },

    confirmGuest() {
      const guestName = this.guestNameDraft.trim();
      if (!guestName || this.hasOpponent) return;

      const guest: FiveOhOnePlayer = {
        id: createId(),
        type: 'guest',
        name: guestName,
      };
      this.players = [...this.players, guest];
      this.guestModalOpen = false;
      this.guestNameDraft = '';
    },

    confirmDartBot() {
      if (this.hasOpponent) return;
      const level = Math.min(
        10,
        Math.max(1, Math.round(Number(this.dartbotLevel) || 1)),
      );
      this.dartbotLevel = level;

      const dartbot: FiveOhOnePlayer = {
        id: createId(),
        type: 'dartbot',
        name: 'DartBot',
        level,
      };
      this.players = [...this.players, dartbot];
      this.opponentPickerOpen = false;
    },

    removeOpponent() {
      if (!this.hasOpponent) return;
      this.players = this.players.filter((player) => player.type === 'user');
      this.opponentPickerOpen = false;
      this.guestModalOpen = false;
      this.guestNameDraft = '';
    },

    serializePlayers(): string {
      const level = Math.min(
        10,
        Math.max(1, Math.round(Number(this.dartbotLevel) || 1)),
      );
      const players = this.players.map((player) =>
        player.type === 'dartbot' ? { ...player, level } : player,
      );
      return JSON.stringify(players);
    },

    checkInProgressSession() {
      const key = Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY);
      this.inProgressSession = sessionStorage.getItem(key) !== null;
    },

    resumeGame() {
      window.location.href = '/games/501';
    },

    abandonSession() {
      sessionStorage.removeItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY));
      this.inProgressSession = false;
    },
  };
}
