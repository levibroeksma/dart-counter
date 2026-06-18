import { proxyAuthRequest, type AppSession } from "@lib/server/auth/neon";
import { bootstrapEnv } from "@lib/server/bootstrap-env";

bootstrapEnv();

export type { AppSession } from "@lib/server/auth/neon";

export async function getSession(request: Request): Promise<AppSession> {
  try {
    const response = await proxyAuthRequest(request, ["get-session"], {
      method: "GET",
    });

    if (!response.ok) {
      return { isLoggedIn: false };
    }

    const data = (await response.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };

    if (!data.user?.id) {
      return { isLoggedIn: false };
    }

    return {
      isLoggedIn: true,
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
    };
  } catch {
    return { isLoggedIn: false };
  }
}
