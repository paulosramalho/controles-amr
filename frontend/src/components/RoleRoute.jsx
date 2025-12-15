// frontend/src/components/RoleRoute.jsx
// Gate de permissão por ROLE.
// Uso:
// <RoleRoute allow={["ADMIN"]}><AdminPage/></RoleRoute>
//
// Não altera layout "aprovado": é estrutural e de segurança.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RoleRoute({ allow = [], role, redirectTo = "/dashboard", children }) {
  const navigate = useNavigate();
  const isAllowed = allow.length === 0 ? true : allow.includes(role);

  useEffect(() => {
    if (isAllowed) return;
    const t = setTimeout(() => navigate(redirectTo, { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [isAllowed, navigate, redirectTo]);

  if (isAllowed) return children;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">Acesso não autorizado</h2>
        <p className="mt-2 text-sm text-slate-600">
          Você não tem permissão para acessar esta área. Vamos te levar de volta ao Dashboard em 5 segundos.
        </p>
        <button
          className="mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:opacity-90"
          onClick={() => navigate(redirectTo, { replace: true })}
        >
          Ir agora
        </button>
      </div>
    </div>
  );
}
