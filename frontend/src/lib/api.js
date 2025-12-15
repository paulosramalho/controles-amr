/**
 * ============================================================
 * API FETCH – CONTROLES AMR
 * ------------------------------------------------------------
 * - Centraliza chamadas ao backend
 * - Injeta automaticamente Authorization: Bearer <token>
 * - Trata erro 401 (token inválido/expirado)
 *
 * ⚠️ TEMPORÁRIO:
 * Este helper será removido/substituído futuramente
 * quando evoluirmos para outra estratégia de auth.
 * ============================================================
 */

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export function getToken() {
  return localStorage.getItem("amr_token");
}

export function setToken(token) {
  localStorage.setItem("amr_token", token);
}

export function clearToken() {
  localStorage.removeItem("amr_token");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Token inválido / expirado
  if (response.status === 401) {
    clearToken();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem body
  }

  if (!response.ok) {
    throw new Error(data?.message || "Erro na requisição");
  }

  return data;
}
