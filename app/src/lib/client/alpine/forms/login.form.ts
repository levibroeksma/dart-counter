import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface LoginFormState {
  username: string;
  password: string;
  loading: boolean;
  error: string;
  $el: HTMLFormElement;
  submit(): Promise<void>;
}

/**
 * Alpine data factory for the login form.
 */
export function loginForm(): LoginFormState {
  return {
    username: "",
    password: "",
    loading: false,
    error: "",

    $el: undefined as unknown as HTMLFormElement,

    async submit(this: LoginFormState) {
      this.loading = true;
      this.error = "";

      const redirect = this.$el.dataset.redirect || "/";

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
        });

        const data: ApiResponse = await response.json();

        if (data.ok) {
          window.location.href = redirect;
          return;
        }

        this.error = t(data.code);
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
