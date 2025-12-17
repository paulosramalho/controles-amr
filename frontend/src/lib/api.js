// frontend/src/lib/api.js
// API helper (Bearer token) + tratamento de JSON/HTML + 401 auto-logout
// Observação: VITE_API_URL pode ser:
//  - http://localhost:4000        (sem /api)  ✅ funciona
//  - http://localhost:4000/api    (com /api)  ✅ funciona
//  - https://controles-amr-backend.onrender.com
//  - https://controles-amr-backend.onrender.com/api

const TOKEN_KEY = "amr_token";
const USER_KEY = "amr_user";

function normalizeBase(raw) {
  const base = (raw || "").trim().replace(/\/+$/, "");
  return base || "http://localhost:4000";
}

// Monta URL SEM duplicar /api
function buildUrl(path) {
  const base = normalizeBase(import.meta.env.VITE_API_URL);

  let p = String(path || "");
  if (!p.startsWith("/")) p = `/${p}`;

  // Se o path já vier com /api/..., respeita
  const pathHasApiPrefix = p === "/api" || p.startsWith("/api/");

  // Se a base já termina com /api, NÃO adiciona /api de novo
  const baseHasApiSuffix = base.endsWith("/api");

  // Regras:
  // - Se path já tem /api -> base + path
  // - Senão:
  //    - se base já tem /api -> base + path
  //    - se base não tem /api -> base + "/api" + path
  if (pathHasApiPrefix) return `${base}${p}`;
  if (baseHasApiSuffix) return `${base}${p}`;
  return `${base}/api${p}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token, user = undefined) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user !== undefined) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  const token = getToken();
  const headers = new Headers(options.headers || {});

  // Se tiver token, manda Bearer
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Body: se for objeto normal, vira JSON automaticamente
  let body = options.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isString = typeof body === "string";

  if (body !== undefined && body !== null && !isFormData && !isString) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  } else if (isString) {
    // Se você já mandou string, garanta content-type se não existir
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  // Accept JSON
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const resp = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  // 401: limpa auth e dispara erro
  if (resp.status === 401) {
    clearAuth();
    const msg = "Não autenticado.";
    const err = new Error(msg);
    err.status = 401;
    throw err;
  }

  // Tenta ler JSON; se vier HTML (Render/Vercel 404/400), devolve erro claro
  const ct = resp.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!isJson) {
    const text = await resp.text().catch(() => "");
    const preview = text.slice(0, 220).replace(/\s+/g, " ").trim();
    const err = new Error(
      `Resposta inválida do servidor (${resp.status}). Esperado JSON, recebido: ${preview || "(vazio)"}`
    );
    err.status = resp.status;
    err.raw = text;
    throw err;
  }

  const data = await resp.json();

  if (!resp.ok) {
    const err = new Error(data?.message || `Erro HTTP ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  return data;
}
