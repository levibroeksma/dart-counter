import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { userMenu } from "@lib/client/alpine/layout/user.menu";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";
import { gameToast } from "@lib/client/alpine/games/toast";
import { gameSettingsShell } from "@lib/client/alpine/games/game-settings.shell";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";
import { tenUpOneDownPlay } from "@lib/client/alpine/games/ten-up-one-down.play";
import { scoreTrainingSettings } from "@lib/client/alpine/games/score-training.settings";
import { scoreTrainingPlay } from "@lib/client/alpine/games/score-training.play";
import { singlesTrainingSettings } from "@lib/client/alpine/games/singles-training.settings";
import { singlesTrainingPlay } from "@lib/client/alpine/games/singles-training.play";

import { confirmationModalState } from "@lib/client/alpine/stores/confirmationModal.store";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
  Alpine.data("userMenu", userMenu);
  Alpine.data("displayNameSetting", displayNameSetting);
  Alpine.data("gameToast", gameToast);
  Alpine.data("gameSettingsShell", gameSettingsShell);
  Alpine.data("tenUpOneDownSettings", tenUpOneDownSettings);
  Alpine.data("scoreTrainingSettings", scoreTrainingSettings);
  Alpine.data("singlesTrainingSettings", singlesTrainingSettings);
  Alpine.data("tenUpOneDownPlay", tenUpOneDownPlay);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("singlesTrainingPlay", singlesTrainingPlay);

  const confirmationModal = confirmationModalState(Alpine);
  Alpine.store("confirmationModal", confirmationModal);
};
