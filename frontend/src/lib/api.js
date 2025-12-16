// frontend/src/lib/api.js
const BASE_URL = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "amr_token";
const USER_KEY = "amr_user"; // opcional

export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
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
 * Monta URL SEM duplicar "/api".
 * Regras:
 * - Se BASE_URL vazio: usa "/api/..." (bom p/ dev com proxy)
 * - Se BASE_URL tem /api e path também: remove um /api
 * - Se BASE_URL não tem /api e path não tem: adiciona /api
 */
function buildUrl(path) {
  const base = String(BASE_URL || "").replace(/\/+$/, "");
  let p = String(path || "");
  if (!p.startsWith("/")) p = "/" + p;

  const baseHasApi = /\/api$/.test(base);
  const pathHasApi = /^\/api(\/|$)/.test(p);

  // Sem base => usa proxy local (/api/...)
  if (!base) {
    if (!pathHasApi) return "/api" + p;
    return p;
  }

  // Base com /api e path com /api => remove o do path
  if (baseHasApi && pathHasApi) {
    p = p.replace(/^\/api/, "");
    return base + p;
  }

  // Base sem /api e path sem /api => adiciona /api
  if (!baseHasApi && !pathHasApi) {
    return base + "/api" + p;
  }

  // Demais combinações: só concatena
  return base + p;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  // Só seta Content-Type se for JSON "normal"
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  // 401 => logout automático
  if (res.status === 401) {
    clearAuth();
  }

  const text = await res.text();

  // Se vier HTML (<!DOCTYPE...), dá diagnóstico curto
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Resposta inválida do servidor (${res.status}). Esperado JSON, recebido: ${text.slice(0, 80)}`
    );
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}
