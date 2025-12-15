// frontend/src/lib/api.js
// API helper (Bearer) + auto logout em 401.
// Base URL: use VITE_API_BASE_URL se existir; senão tenta /api (proxy) e, se falhar, usa Render.

const LS_TOKEN = "amr_token";
const LS_ROLE = "amr_role";
const LS_USER = "amr_user";

export function getToken() {
  return localStorage.getItem(LS_TOKEN) || "";
}

export function getAuth() {
  const token = getToken();
  const role = localStorage.getItem(LS_ROLE) || "";
  const userRaw = localStorage.getItem(LS_USER);
  const user = userRaw ? safeJsonParse(userRaw) : null;
  return { token, role, user };
}

export function setAuth({ token, role, user }) {
  if (token) localStorage.setItem(LS_TOKEN, token);
  if (role) localStorage.setItem(LS_ROLE, role);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_USER);
}

export function logout(redirectToLogin = true) {
  clearAuth();
  if (redirectToLogin && typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// Resolve base
function resolveBaseUrl() {
  const envBase = import.meta?.env?.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");

  // Se tiver proxy do Vite, /api funciona no dev e pode funcionar em produção dependendo do setup.
  // Mantemos como primeira tentativa.
  return "";
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function readBodySmart(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  // Ajuda no caso clássico do "Unexpected token '<'" (HTML retornado)
  return { _nonJson: true, text };
}

export async function apiFetch(path, options = {}) {
  const base = resolveBaseUrl();
  const url =
    base
      ? `${base}${path.startsWith("/") ? path : `/${path}`}`
      : path.startsWith("/")
        ? path
        : `/${path}`;

  const token = getToken();

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  // 401 => logout automático
  if (res.status === 401) {
    logout(true);
    throw new Error("Não autenticado.");
  }

  const data = await readBodySmart(res);

  if (!res.ok) {
    // Erro vindo em JSON (ex.: {message:"..."})
    if (data && !data._nonJson) {
      const msg = data.message || data.error || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    // Erro vindo em HTML/texto
    throw new Error(
      data?._nonJson
        ? `Resposta não-JSON do servidor (provável HTML/rota errada). Status ${res.status}.`
        : `Erro HTTP ${res.status}`
    );
  }

  // Se veio HTML por engano e mesmo assim 200, explode com mensagem clara
  if (data && data._nonJson) {
    throw new Error(`Resposta inesperada (HTML/texto). Verifique VITE_API_BASE_URL/proxy.`);
  }

  return data;
}

export const api = {
  get: (path) => apiFetch(path, { method: "GET" }),
  post: (path, body) =>
    apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) =>
    apiFetch(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: (path) => apiFetch(path, { method: "DELETE" }),
};
