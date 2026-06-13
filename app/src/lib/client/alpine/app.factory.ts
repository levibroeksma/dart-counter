import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { userMenu } from "@lib/client/alpine/layout/user.menu";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
  Alpine.data("userMenu", userMenu);
  Alpine.data("displayNameSetting", displayNameSetting);
};
