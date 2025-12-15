import { Navigate } from "react-router-dom";

/**
 * ProtectedRoute
 * - se ainda está carregando o /me: mostra nada (App pode ter loading global)
 * - se não logado: manda pro /login
 * - se exige role e não bate: bloqueia
 */
export default function ProtectedRoute({
  isLoading,
  isAuthenticated,
  userRole,
  allowRoles, // ex: ["ADMIN"] ou ["ADMIN","USER"]
  children,
}) {
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    if (!allowRoles.includes(userRole)) {
      return (
        <div className="p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-sm text-slate-500">Acesso restrito</div>
            <div className="text-lg font-semibold text-slate-900">
              Você não tem permissão para acessar esta área.
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
}
