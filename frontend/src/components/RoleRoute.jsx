// frontend/src/components/RoleRoute.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "../lib/api";

export default function RoleRoute({ allowed = [], children }) {
  const { token, role } = getAuth();

  // Se nem token tiver, deixa o App/Protected lidar. Aqui só guardamos role.
  if (!token) return children;

  const ok = allowed.length === 0 ? true : allowed.includes(role);

  if (ok) return children;

  return <Unauthorized />;
}

function Unauthorized() {
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => nav("/dashboard", { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
        <div className="text-lg font-semibold text-white">Acesso não autorizado</div>
        <p className="mt-2 text-sm text-white/70">
          Você não tem permissão para acessar esta área. Em 5 segundos você será redirecionado
          para o Dashboard.
        </p>
        <button
          onClick={() => nav("/dashboard", { replace: true })}
          className="mt-4 w-full rounded-xl bg-white/10 hover:bg-white/15 text-white py-2 text-sm"
        >
          Ir para o Dashboard agora
        </button>
      </div>
    </div>
  );
}
