import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
};
