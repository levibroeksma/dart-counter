import type { ApiResponse, PreferencesSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";
import { validateDisplayName } from "@lib/shared/validation/display-name";

export type DisplayNameMode = "empty" | "view" | "edit";

interface DisplayNameSettingState {
  displayName: string;
  draft: string;
  mode: DisplayNameMode;
  loading: boolean;
  error: string;
  startEdit(): void;
  save(): Promise<void>;
}

/**
 * Alpine data factory for the display name settings control.
 */
export function displayNameSetting(
  initialDisplayName = ""
): DisplayNameSettingState {
  const trimmed = initialDisplayName.trim();
  const hasName = trimmed.length > 0;

  return {
    displayName: hasName ? trimmed : "",
    draft: hasName ? trimmed : "",
    mode: hasName ? "view" : "empty",
    loading: false,
    error: "",

    startEdit() {
      this.draft = this.displayName;
      this.mode = "edit";
      this.error = "";
    },

    async save() {
      this.loading = true;
      this.error = "";

      const validated = validateDisplayName(this.draft);
      if (!validated.valid) {
        this.error = t(validated.code);
        this.loading = false;
        return;
      }

      try {
        const response = await fetch("/api/settings/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: this.draft }),
        });

        const data: ApiResponse = await response.json();

        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.NETWORK_ERROR);
          return;
        }

        const success = data as PreferencesSuccess;
        this.displayName = success.displayName ?? "";
        this.draft = this.displayName;
        this.mode = this.displayName ? "view" : "empty";
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
