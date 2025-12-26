// frontend/src/lib/api.js

const RAW_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const TOKEN_KEY = "amr_token";
const USER_KEY = "amr_user";

function normalizeBase(url) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  // Se vier ".../api", guardamos o base "raiz" e deixamos a função montar os paths
  return u.endsWith("/api") ? u.slice(0, -4) : u;
}

const BASE = normalizeBase(RAW_BASE);

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

// compatível com seu App.jsx: setAuth(token, user)
export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function buildUrl(path) {
  let p = String(path || "").trim();
  if (!p.startsWith("/")) p = "/" + p;

  // Auth NÃO usa /api
  if (p.startsWith("/auth/")) return `${BASE}${p}`;

  // Se já veio /api/..., mantém
  if (p.startsWith("/api/")) return `${BASE}${p}`;

  // Qualquer outra rota do app → /api + rota
  return `${BASE}/api${p}`;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  // Só seta Content-Type automaticamente se houver body
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(buildUrl(path), {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // Aqui é o "Failed to fetch" real (rede / CORS / DNS / backend fora)
    throw new Error("Failed to fetch");
  }

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  // 401: desloga automático (exceto login)
  if (res.status === 401) {
    const isLogin = String(path || "") === "/auth/login";
    if (!isLogin) {
      clearAuth();
      if (window.location.pathname !== "/") window.location.href = "/";
    }
  }

  if (!res.ok) {
    // Se veio HTML (404/502), data vai ser null → ainda assim damos erro útil
    const msg = data?.message || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}
