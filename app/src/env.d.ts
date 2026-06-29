/// <reference types="astro/client" />

type AppSession = import("@lib/server/auth/neon").AppSession;

declare namespace App {
  interface Locals {
    /** Set by middleware after auth validation on protected routes. */
    session?: AppSession;
  }
}
