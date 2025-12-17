const BASE_URL = import.meta.env.VITE_API_URL;

export function setAuth(token) {
  localStorage.setItem("token", token);
}

export function clearAuth() {
  localStorage.removeItem("token");
}

export async function apiFetch(path, options = {}) {
  console.log("[apiFetch] BASE_URL =", BASE_URL);
  console.log("[apiFetch] PATH =", path);

  const url = `${BASE_URL}${path}`;
  console.log("[apiFetch] FINAL URL =", url);

  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  console.log("[apiFetch] HEADERS =", headers);
  console.log("[apiFetch] OPTIONS (antes) =", options);

  const fetchOptions = {
    ...options,
    headers,
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  };

  console.log("[apiFetch] OPTIONS (depois) =", fetchOptions);

  const response = await fetch(url, fetchOptions);

  console.log("[apiFetch] STATUS =", response.status);
  console.log("[apiFetch] OK =", response.ok);

  const rawText = await response.text();
  console.log("[apiFetch] RAW RESPONSE =", rawText);

  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Resposta inválida do servidor (${response.status}). Esperado JSON, recebido: ${rawText.slice(
        0,
        120
      )}`
    );
  }
}
