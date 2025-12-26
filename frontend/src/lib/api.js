const BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const TOKEN_KEY = "amr_token";
const USER_KEY = "amr_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// path deve começar com "/".
// Convenção:
// - Rotas de auth ficam em /auth/...
// - Demais rotas da API ficam em /api/...
// Para evitar 404 por falta de prefixo, se você passar "/clientes",
// a função automaticamente vira "/api/clientes" (exceto se já vier com "/api" ou "/auth").
export async function apiFetch(path, options = {}) {
  const token = getToken();

  // Normaliza prefixo
  // - "/auth/..." fica como está
  // - "/api/..." fica como está
  // - Qualquer outra rota vira "/api" + path
  let finalPath = String(path || "");
  if (!finalPath.startsWith("/")) finalPath = "/" + finalPath;
  const isAuth = finalPath.startsWith("/auth/");
  const isApi = finalPath.startsWith("/api/");
  if (!isAuth && !isApi) finalPath = "/api" + finalPath;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${finalPath}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // login pode retornar 401/403 com JSON
  const isLogin = finalPath === "/auth/login";

  if (!res.ok) {
    let errMsg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) errMsg = data.message;
      else if (isLogin) errMsg = "Falha ao autenticar.";
    } catch {
      // às vezes vem HTML (502/404). Mantém mensagem padrão.
    }
    throw new Error(errMsg);
  }

  // 204 no-content
  if (res.status === 204) return null;

  // parse JSON
  try {
    return await res.json();
  } catch {
    return null;
  }
}
