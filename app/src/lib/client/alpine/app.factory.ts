import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { userMenu } from "@lib/client/alpine/layout/user.menu";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";
import { gameToast } from "@lib/client/alpine/games/toast";
import { gameSettingsShell } from "@lib/client/alpine/games/game-settings.shell";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
  Alpine.data("userMenu", userMenu);
  Alpine.data("displayNameSetting", displayNameSetting);
  Alpine.data("gameToast", gameToast);
  Alpine.data("gameSettingsShell", gameSettingsShell);
  Alpine.data("tenUpOneDownSettings", tenUpOneDownSettings);
};
