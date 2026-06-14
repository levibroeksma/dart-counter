import { errorParamToMessageCode } from "@lib/shared/games/errors";
import { t } from "@lib/shared/i18n";

const TOAST_DURATION_MS = 4000;

interface GameToastState {
  visible: boolean;
  message: string;
  init(): void;
}

/**
 * Alpine data factory for the games page error toast.
 * Cleans the URL when the toast dismisses.
 */
export function gameToast(): GameToastState {
  return {
    visible: false,
    message: "",

    init() {
      const params = new URLSearchParams(window.location.search);
      const code = errorParamToMessageCode(params.get("error"));
      if (!code) return;

      this.message = t(code);
      this.visible = true;

      window.setTimeout(() => {
        this.visible = false;
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        history.replaceState({}, "", `${url.pathname}${url.search}`);
      }, TOAST_DURATION_MS);
    },
  };
}
