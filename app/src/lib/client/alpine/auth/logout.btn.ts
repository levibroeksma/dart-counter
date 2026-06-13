import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface LogoutBtnState {
  loading: boolean;
  error: string;
  $el: HTMLButtonElement;
  logout(): Promise<void>;
}

/**
 * Alpine data factory for the logout button.
 */
export function logoutBtn(): LogoutBtnState {
  return {
    loading: false,
    error: "",

    $el: undefined as unknown as HTMLButtonElement,

    async logout(this: LogoutBtnState) {
      this.loading = true;
      this.error = "";

      const redirect = this.$el.dataset.redirect || "/login";

      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
        });

        const data: ApiResponse = await response.json();

        if (data.ok) {
          window.location.href = redirect;
          return;
        }

        this.error = data.code ? t(data.code) : t(MessageCode.NETWORK_ERROR);
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
