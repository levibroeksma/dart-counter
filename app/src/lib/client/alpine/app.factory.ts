import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
};
