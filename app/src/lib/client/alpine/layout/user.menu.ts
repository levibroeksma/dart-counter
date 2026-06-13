interface UserMenuState {
  open: boolean;
  toggle(): void;
  close(): void;
}

/**
 * Alpine data factory for the profile user menu dropdown.
 */
export function userMenu(): UserMenuState {
  return {
    open: false,

    toggle() {
      this.open = !this.open;
    },

    close() {
      this.open = false;
    },
  };
}
