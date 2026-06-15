import type { Alpine } from "alpinejs";

export type OpenOptions = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

type StoredCallbacks = {
  onConfirm: () => void;
  onCancel?: () => void;
};

export function confirmationModalState(Alpine: Alpine) {
  let callbacks: StoredCallbacks = { onConfirm: () => {} };

  const store = Alpine.reactive({
    showModal: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",

    init() {
      Alpine.effect(() => {
        if (!store.showModal) {
          setTimeout(() => {
            store.reset();
          }, 100);
        }
      });
    },

    open(options: OpenOptions) {
      callbacks = {
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      };
      store.title = options.title;
      store.message = options.message;
      store.confirmLabel = options.confirmLabel ?? "Confirm";
      store.cancelLabel = options.cancelLabel ?? "Cancel";
      store.showModal = true;
    },

    confirm() {
      callbacks.onConfirm();
      store.showModal = false;
    },

    cancel() {
      callbacks.onCancel?.();
      store.showModal = false;
    },

    reset() {
      store.title = "";
      store.message = "";
      store.confirmLabel = "Confirm";
      store.cancelLabel = "Cancel";
      callbacks = { onConfirm: () => {} };
    },
  });

  return store;
}

export type ConfirmationModalStore = ReturnType<typeof confirmationModalState>;
