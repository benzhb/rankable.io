let sessionToken: string | null = null;

export function setSessionToken(token: string): void {
  sessionToken = token;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);

  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error?.message
        : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}
