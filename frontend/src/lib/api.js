/**
 * ============================================================
 * API FETCH – CONTROLES AMR
 * ------------------------------------------------------------
 * - Centraliza chamadas ao backend
 * - Injeta automaticamente Authorization: Bearer <token>
 * - Trata erro 401 (token inválido/expirado)
 * - Evita crash "Unexpected token <" (HTML no lugar de JSON)
 *
 * Fonte única do token:
 * - localStorage "amr_auth" (JSON: { token, user })
 *
 * ⚠️ TEMPORÁRIO:
 * Este helper poderá ser removido/substituído futuramente
 * quando evoluirmos para refresh token / cookies httpOnly.
 * ============================================================
 */

const RAW_BASE = (import.meta.env.VITE_API_URL || "").trim();

// Garante que a API base SEMPRE termine em /api
const API_BASE = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api"; // fallback para proxy do Vite em dev

function readAuth() {
  try {
    const raw = localStorage.getItem("amr_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  const auth = readAuth();
  return auth?.token || null;
}

export function setAuth(authObj) {
  localStorage.setItem("amr_auth", JSON.stringify(authObj));
}

export function clearAuth() {
  localStorage.removeItem("amr_auth");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  // Só seta Content-Type se não for FormData
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Não sobrescreve Authorization se já veio explicitamente
  if (!headers.Authorization && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const response = await fetch(url, { ...options, headers });

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  // 401 => derruba sessão
  if (response.status === 401) {
    clearAuth();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // Se não for JSON, não tenta parsear (evita Unexpected token "<")
  if (!contentType.includes("application/json")) {
    const snippet = (rawText || "").slice(0, 160).replace(/\s+/g, " ").trim();
    throw new Error(
      `Resposta inválida do servidor (${response.status}). Esperado JSON, recebido: ${snippet || "(vazio)"}`
    );
  }

  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    const snippet = (rawText || "").slice(0, 160).replace(/\s+/g, " ").trim();
    throw new Error(`JSON inválido do servidor (${response.status}): ${snippet || "(vazio)"}`);
  }

  if (!response.ok) {
    throw new Error(data?.message || "Erro na requisição");
  }

  return data;
}
