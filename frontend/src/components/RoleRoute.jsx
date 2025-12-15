// frontend/src/components/RoleRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

export default function RoleRoute({ user, allowedRoles = [], children }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [tick, setTick] = useState(5);

  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  const ok = allowedRoles.length === 0 || allowedRoles.includes(user.role);
  useEffect(() => {
    if (ok) return;
    setTick(5);
    const id = setInterval(() => setTick((p) => p - 1), 1000);
    const t = setTimeout(() => nav("/dashboard", { replace: true }), 5000);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, [ok, nav]);

  if (ok) return children;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0 }}>Acesso não autorizado</h2>
      <p style={{ marginTop: 8 }}>
        Você não tem permissão para acessar esta área. Voltando ao Dashboard em {tick}s...
      </p>
      <button onClick={() => nav("/dashboard", { replace: true })}>Voltar agora</button>
    </div>
  );
}
