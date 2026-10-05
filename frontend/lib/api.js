import { apiUrl } from "./contracts";

// The server is a convenience: it serves points and history. Every read here returns null when
// the server is unreachable, and callers show nothing rather than an error. Nothing a user needs
// in order to act or exit goes through it.
export async function fetchApi(path, { timeoutMs = 4_000 } = {}) {
  try {
    const res = await fetch(`${apiUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
