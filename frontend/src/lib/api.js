const BASE_URL = import.meta.env.VITE_API_URL;

export function setAuth(token) {
  localStorage.setItem("token", token);
}

export function clearAuth() {
  localStorage.removeItem("token");
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "Erro de servidor");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida do servidor");
  }
}
