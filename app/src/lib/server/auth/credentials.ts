import { MessageCode } from "@lib/shared/constants/errors.constants";
import { bootstrapEnv } from "@lib/server/bootstrap-env";

bootstrapEnv();

/**
 * Assert required auth env vars are present. Throws MessageCode.SERVER_CONFIG if not.
 */
export function assertAuthConfig(): void {
  if (
    !process.env.AUTH_USERNAME ||
    !process.env.AUTH_PASSWORD ||
    !process.env.SESSION_SECRET
  ) {
    throw new Error(MessageCode.SERVER_CONFIG);
  }
}

/**
 * Compare submitted credentials against process.env values.
 */
export function validateCredentials(
  username: string,
  password: string
): boolean {
  assertAuthConfig();
  return (
    username === process.env.AUTH_USERNAME &&
    password === process.env.AUTH_PASSWORD
  );
}
