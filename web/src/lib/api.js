const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function getToken() { 
  return localStorage.getItem('token'); 
}

export function setToken(t) { 
  localStorage.setItem('token', t); 
}

export function clearToken() { 
  localStorage.removeItem('token'); 
  localStorage.removeItem('user');
}

export function getStoredUser() {
  const u = localStorage.getItem('user');
  if (u) {
    try { return JSON.parse(u); } catch {}
  }
  // Fallback to decoding JWT payload if stored
  const token = getToken();
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return { id: payload.sub, email: payload.email, role: payload.role };
      }
    } catch {}
  }
  return null;
}

export function setStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Single choke point for network calls across the app
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
    throw new Error("Can't reach the server. Make sure the API is running at " + BASE);
  }

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Something went wrong (HTTP ${res.status}).`);
    if (Array.isArray(data.problems)) err.problems = data.problems;
    err.code = data.error;
    throw err;
  }
  return data;
}
