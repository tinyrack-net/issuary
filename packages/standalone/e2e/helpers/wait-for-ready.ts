/**
 * Polls the OIDC discovery endpoint until the server is ready.
 */
export async function waitForReady(
  port: number,
  options?: { attempts?: number; intervalMs?: number },
): Promise<Response> {
  const { attempts = 30, intervalMs = 500 } = options ?? {};
  const url = `http://localhost:${port}/.well-known/openid-configuration`;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Server did not become ready on port ${port}`);
}
