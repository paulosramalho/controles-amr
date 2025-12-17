// frontend/src/lib/api.js
// ============================================================
// API helper para Controles-AMR
// - Base URL vem de VITE_API_URL (ex.: http://localhost:4000/api  ou  https://...onrender.com/api)
// - Sempre envia Authorization: Bearer <token> quando existir
// - Serializa body JSON automaticamente quando body for objeto
// - Tratamento de 401: limpa auth e dispara evento "amr:logout"
// OBS: logs abaixo são TEMPORÁRIOS para rastreio. Remover ao final.
// ============================================================

const AUTH_KEY = "amr_auth";
const DEBUG = true; // <-- coloque false para silenciar logs

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  const auth = getAuth();
  return auth?.token || "";
}

/**
 * setAuth aceita:
 * - string (token)
 * - { token, user }
 */
export function setAuth(next) {
  if (!next) return;
  const value = typeof next === "string" ? { token: next } : next;
  localStorage.setItem(AUTH_KEY, JSON.stringify(value));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new CustomEvent("amr:logout"));
}

function normalizeBaseUrl(raw) {
  const base = (raw || "").trim().replace(/\s+/g, "");
  const fallback = "http://localhost:4000/api";
  const finalBase = base || fallback;
  return finalBase.replace(/\/+$/, "");
}

function joinUrl(base, path) {
  const p = (path || "").startsWith("/") ? path : `/${path || ""}`;
  return `${base}${p}`;
}

export async function apiFetch(path, options = {}) {
  const baseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  const url = joinUrl(baseUrl, path);

  const token = getToken();

  const opts = { ...options };
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (opts.body !== undefined && opts.body !== null) {
    const isBodyInit =
      typeof opts.body === "string" ||
      opts.body instanceof FormData ||
      opts.body instanceof Blob ||
      opts.body instanceof ArrayBuffer;

    if (!isBodyInit && typeof opts.body === "object") {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      opts.body = JSON.stringify(opts.body);
    } else if (typeof opts.body === "string") {
      if (opts.body.trim().startsWith("{") || opts.body.trim().startsWith("[")) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }
    }
  }

  opts.headers = headers;

  if (DEBUG) {
    console.log("[apiFetch] BASE_URL =", baseUrl);
    console.log("[apiFetch] PATH =", path);
    console.log("[apiFetch] FINAL URL =", url);
    console.log("[apiFetch] HEADERS =", headers);
    // não logar conteúdo do body (pode conter senha)
    console.log("[apiFetch] OPTIONS =", { ...opts, body: opts.body ? "[body]" : undefined });
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (DEBUG) console.log("[apiFetch] FETCH ERROR =", err);
    throw new Error("Falha de rede ao acessar o servidor.");
  }

  const contentType = res.headers.get("content-type") || "";

  let rawText = "";
  try {
    rawText = await res.text();
  } catch {
    rawText = "";
  }

  if (DEBUG) {
    console.log("[apiFetch] STATUS =", res.status);
    console.log("[apiFetch] OK =", res.ok);
    console.log("[apiFetch] CONTENT-TYPE =", contentType);
    console.log("[apiFetch] RAW RESPONSE =", rawText);
  }

  if (res.status === 401) {
    clearAuth();
  }

  const isJson = contentType.includes("application/json");
  let data = null;

  if (rawText) {
    if (isJson) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      (rawText && rawText.slice(0, 140)) ||
      `Erro ${res.status}`;
    throw new Error(msg);
  }

  return isJson ? data : rawText;
}
