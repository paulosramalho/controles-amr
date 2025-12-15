// frontend/src/lib/api.js
// Helper central de API com:
// - Authorization: Bearer <token>
// - Auto-logout em 401
// - Proteção contra resposta HTML (<!DOCTYPE ...), comum quando API_BASE está errado em produção
//
// IMPORTANTE:
// Em produção (Vercel), configure:
// VITE_API_URL=https://controles-amr-backend.onrender.com
// (sem /api no final)

const RAW_BASE =
  (import.meta?.env?.VITE_API_URL || "").trim() ||
  (import.meta?.env?.VITE_API_BASE || "").trim() ||
  "";

// Se RAW_BASE vier vazio, cai em "/api" (funciona em DEV com proxy do Vite)
const API_BASE = RAW_BASE
  ? RAW_BASE.replace(/\/+$/, "") + "/api"
  : "/api";

const AUTH_KEY = "amr_auth";

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

export function logoutLocal() {
  localStorage.removeItem(AUTH_KEY);
  // sinaliza para o app reagir (listener no App.jsx)
  window.dispatchEvent(new Event("amr:logout"));
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function looksLikeHTML(text) {
  const t = (text || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

export async function apiFetch(path, options = {}) {
  const auth = readAuth();
  const token = auth?.token;

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, { ...options, headers });

  // 401 -> derruba sessão local
  if (res.status === 401) {
    logoutLocal();
    throw new Error("Sessão expirada ou não autenticado. Faça login novamente.");
  }

  // tenta ler como texto primeiro para detectar HTML
  const text = await safeReadText(res);

  // Resposta HTML = geralmente API_BASE errado em produção
  if (looksLikeHTML(text)) {
    throw new Error(
      "A API respondeu com HTML (não JSON). Verifique VITE_API_URL no Vercel (deve apontar para o backend)."
    );
  }

  // se veio vazio
  if (!text) {
    if (!res.ok) throw new Error("Erro na requisição.");
    return null;
  }

  // parse JSON
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida da API (JSON malformado).");
  }

  if (!res.ok) {
    // tenta padronizar msg de erro
    const msg = data?.message || data?.error || "Erro na requisição.";
    throw new Error(msg);
  }

  return data;
}
