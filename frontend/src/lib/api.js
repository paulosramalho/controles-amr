const BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("amr_token");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("amr_token");
    window.location.href = "/";
    throw new Error("Não autenticado");
  }

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Resposta inválida do servidor (${res.status}). Esperado JSON, recebido: ${text.slice(0, 60)}`
    );
  }
}
