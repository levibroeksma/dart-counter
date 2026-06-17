import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface TenUpOneDownSettingsState {
  playUrl: string;
  hasActiveSession: boolean;
  loading: boolean;
  error: string;
  endMode: "rounds" | "timed";
  formDataToSettings(form: HTMLFormElement): Record<string, unknown>;
  start(): Promise<void>;
  resume(): void;
  abandon(): Promise<void>;
}

/**
 * Alpine data factory for Ten Up One Down settings flow.
 */
export function tenUpOneDownSettings(
  playUrl: string,
  hasActiveSession: boolean
): TenUpOneDownSettingsState {
  return {
    playUrl,
    hasActiveSession,
    loading: false,
    error: "",
    endMode: "rounds",

    /**
     * Collects form values and normalizes numeric fields.
     */
    formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
      const settings: Record<string, unknown> = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value !== "string") continue;
        settings[key] =
          key === "roundCount" || key === "playtimeSeconds"
            ? Number(value)
            : value;
      }
      return settings;
    },

    resume() {
      window.location.href = this.playUrl;
    },

    async abandon() {
      this.loading = true;
      this.error = "";

      try {
        const response = await fetch("/api/games/ten-up-one-down/session", {
          method: "DELETE",
        });
        const data: ApiResponse = await response.json();
        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.SERVER_ERROR);
          return;
        }

        this.hasActiveSession = false;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async start() {
      const form = document.getElementById(
        "game-settings-form"
      ) as HTMLFormElement | null;
      if (!form) return;

      this.loading = true;
      this.error = "";

      try {
        const response = await fetch("/api/games/ten-up-one-down/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.formDataToSettings(form)),
        });

        const data: ApiResponse = await response.json();
        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.SERVER_ERROR);
          return;
        }

        window.location.href = this.playUrl;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
