const BASE_URL = import.meta.env.VITE_API_URL || "";
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

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * REGRA SIMPLES E SEGURA:
 * - VITE_API_URL = ".../api"
 * - path = "/auth/login"
 * - concatena SEM duplicar
 */
function buildUrl(path) {
  const base = BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path), {
    ...options,
    headers,
    body:
      options.body && headers["Content-Type"] === "application/json"
        ? JSON.stringify(options.body)
        : options.body,
  });

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Resposta inválida do servidor (${res.status}). Esperado JSON, recebido: ${text.slice(
        0,
        80
      )}`
    );
  }

  if (res.status === 401) {
    clearAuth();
  }

  if (!res.ok) {
    throw new Error(data?.message || `Erro HTTP ${res.status}`);
  }

  return data;
}
