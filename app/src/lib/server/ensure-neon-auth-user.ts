/** Default dev login credentials (matches curl-verify scripts). */
export const DEV_AUTH_DEFAULTS = {
  email: "test@example.com",
  password: "testpass",
  name: "Dev User",
} as const;

export type EnsureNeonAuthUserOptions = {
  baseUrl?: string;
  email?: string;
  password?: string;
  name?: string;
  origin?: string;
};

type AuthFetchResult = "ready" | "created";

/**
 * Ensure a Neon Auth user exists and accepts the given password.
 * Signs in when the user already exists; otherwise signs up.
 */
export async function ensureNeonAuthUser(
  options: EnsureNeonAuthUserOptions = {},
): Promise<AuthFetchResult> {
  const baseUrl = options.baseUrl ?? process.env.NEON_AUTH_BASE_URL;
  const email = options.email ?? process.env.SEED_AUTH_EMAIL ?? DEV_AUTH_DEFAULTS.email;
  const password =
    options.password ?? process.env.SEED_AUTH_PASSWORD ?? DEV_AUTH_DEFAULTS.password;
  const name = options.name ?? process.env.SEED_AUTH_NAME ?? DEV_AUTH_DEFAULTS.name;
  const origin =
    options.origin ??
    process.env.SEED_AUTH_ORIGIN ??
    process.env.APP_ORIGIN ??
    "http://localhost:4321";

  if (!baseUrl) {
    throw new Error("NEON_AUTH_BASE_URL is not set");
  }

  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
    "x-neon-auth-middleware": "true",
  };

  const signInResponse = await fetch(`${baseUrl}/sign-in/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  if (signInResponse.ok) {
    return "ready";
  }

  const signUpResponse = await fetch(`${baseUrl}/sign-up/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, name }),
  });
  if (signUpResponse.ok) {
    return "created";
  }

  const signUpBody = await signUpResponse.text();
  if (
    signUpResponse.status === 422 &&
    signUpBody.includes("USER_ALREADY_EXISTS")
  ) {
    throw new Error(
      `Auth user ${email} exists but password does not match. ` +
        "Set SEED_AUTH_PASSWORD to the correct value or use another SEED_AUTH_EMAIL.",
    );
  }

  throw new Error(
    `Failed to ensure auth user (${signUpResponse.status}): ${signUpBody}`,
  );
}
