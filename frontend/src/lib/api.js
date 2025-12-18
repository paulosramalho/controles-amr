const BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const TOKEN_KEY = "amr_token";
const USER_KEY = "amr_user";

export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// path deve começar com "/".
// Ex.: apiFetch("/auth/login") -> BASE_URL + "/auth/login"
export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Resposta inválida do servidor (${res.status}). Esperado JSON, recebido: ${text.slice(0, 80)}`
    );
  }

  // 401 => desloga automático EXCETO no login
  if (res.status === 401) {
    const isLogin = path === "/auth/login";
    if (!isLogin) {
      clearAuth();
      if (window.location.pathname !== "/") window.location.href = "/";
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || `Erro HTTP ${res.status}`);
  }

  return data;
}
