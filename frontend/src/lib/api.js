// frontend/src/lib/api.js
// API helper (Bearer token) + tratamento robusto de JSON/HTML + auto-logout em 401
// Observação: BASE_URL deve apontar para a BASE da API, incluindo "/api"
// Ex.: https://controles-amr-backend.onrender.com/api  |  http://localhost:4000/api

const BASE_URL_RAW = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// =====================
// Storage do token
// =====================
const TOKEN_KEY = "amr_token";

export function setAuth(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
}
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

// =====================
// Utils
// =====================
function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  const p2 = p.startsWith("/") ? p : `/${p}`;
  return `${b}${p2}`;
}

async function readBodySmart(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // Se for JSON, tenta JSON
  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return { kind: "json", data };
  }

  // Senão, lê texto (ex.: HTML de erro)
  const text = await res.text().catch(() => "");
  return { kind: "text", text, contentType: ct };
}

// =====================
// Fetch principal
// =====================
export async function apiFetch(path, options = {}) {
  const url = joinUrl(BASE_URL_RAW, path);

  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  // Só seta Content-Type se tiver body (e se não for FormData)
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = hasBody && (typeof FormData !== "undefined") && (options.body instanceof FormData);

  if (hasBody && !isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  // 401 -> derruba sessão
  if (res.status === 401) {
    clearAuth();
    const err = new Error("Não autenticado.");
    err.status = 401;
    throw err;
  }

  const body = await readBodySmart(res);

  if (!res.ok) {
    // Mensagem amigável com snippet do HTML/texto quando não for JSON
    let msg = `Erro HTTP ${res.status}`;
    if (body.kind === "json" && body.data) {
      msg = body.data.message || body.data.error || msg;
    } else if (body.kind === "text" && body.text) {
      const snippet = body.text.replace(/\s+/g, " ").slice(0, 160);
      msg = `Resposta inválida do servidor (${res.status}). Esperado JSON, recebido: ${snippet}`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  // ok
  if (body.kind === "json") return body.data;
  // Se por acaso vier texto em 200, devolve o texto
  return body.text ?? null;
}
