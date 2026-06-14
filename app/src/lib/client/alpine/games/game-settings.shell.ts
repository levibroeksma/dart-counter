import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface GameSettingsShellState {
  slug: string;
  playUrl: string;
  loading: boolean;
  error: string;
  formDataToSettings(form: HTMLFormElement): Record<string, unknown>;
  start(): Promise<void>;
}

/**
 * Alpine data factory for the shared game settings shell.
 */
export function gameSettingsShell(
  slug: string,
  playUrl: string
): GameSettingsShellState {
  return {
    slug,
    playUrl,
    loading: false,
    error: "",

    formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
      const settings: Record<string, unknown> = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string") {
          settings[key] = value;
        }
      }
      return settings;
    },

    async start() {
      const form = document.getElementById(
        "game-settings-form"
      ) as HTMLFormElement | null;
      if (!form) return;

      this.loading = true;
      this.error = "";

      try {
        const response = await fetch(`/api/games/${this.slug}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: this.formDataToSettings(form),
          }),
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
