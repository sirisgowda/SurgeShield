const BASE = import.meta.env.VITE_API_URL;

export function getToken() { return localStorage.getItem('token'); }
export function setToken(t) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

/**
 * Single choke point for every network call the app makes.
 * - attaches the bearer token when we have one
 * - bounces to /login on 401 (expired/invalid token)
 * - normalizes both HTTP errors and network failures into Error(message)
 *   so every screen can render `err.message` directly, no special-casing.
 */
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // fetch itself threw: server down, DNS failure, offline, CORS block, etc.
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401) {
    clearToken();
    if (location.pathname !== '/login') location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Something went wrong (HTTP ${res.status}).`);
    if (Array.isArray(data.problems)) err.problems = data.problems; // field-level validation errors
    err.code = data.error;
    throw err;
  }
  return data;
}
