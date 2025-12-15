// frontend/src/lib/api.js
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://controles-amr-backend.onrender.com/api"
    : "/api");

function getToken() {
  return localStorage.getItem("token") || "";
}

function logoutHard() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // deixa o App.jsx decidir redireciono/estado
  window.dispatchEvent(new Event("amr:logout"));
}

async function safeParse(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (ct.includes("application/json")) {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      // caiu em JSON inválido
      return { message: "Resposta JSON inválida do servidor.", raw: text };
    }
  }

  // HTML ou texto
  return { message: "Resposta inesperada do servidor.", raw: text };
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : undefined,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    logoutHard();
    throw new Error("Não autenticado.");
  }

  const data = await safeParse(res);

  if (!res.ok) {
    const msg = data?.message || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export { API_BASE, logoutHard };
