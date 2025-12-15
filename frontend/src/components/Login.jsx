import { useMemo, useState } from "react";
import { apiFetch, setToken } from "../lib/api";

/**
 * Login (Admin/User)
 * - usa /api/auth/login
 * - salva token no localStorage (amr_token)
 * - chama onLoggedIn() pra App revalidar /api/auth/me e renderizar role
 *
 * OBS: Layout aqui é neutro/AMR e não interfere no layout aprovado,
 * pois só aparece na rota /login (vamos ligar no App.jsx depois).
 */
export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && senha.trim().length >= 4 && !loading;
  }, [email, senha, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), senha }),
      });

      if (!data?.token) {
        throw new Error("Login sem token. Verifique o backend.");
      }

      setToken(data.token);

      // App deve chamar /api/auth/me e decidir role/layout
      onLoggedIn?.();
    } catch (err) {
      setErro(err?.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="text-sm text-slate-500">AMR Advogados</div>
          <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
          <p className="text-sm text-slate-600 mt-1">
            Use seu e-mail e senha para acessar o Controles-AMR.
          </p>
        </div>

        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="financeiro@amradvogados.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {erro ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {erro}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-slate-900 text-white py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-xs text-slate-500">
            * “Esqueci minha senha” entra na próxima etapa.
          </div>
        </form>
      </div>
    </div>
  );
}
