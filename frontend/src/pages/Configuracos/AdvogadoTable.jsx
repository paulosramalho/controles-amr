// frontend/src/pages/Configuracoes/Advogados.jsx
import { useState } from "react";
import AdvogadoTable from "./AdvogadoTable";
import AdvogadoForm from "./AdvogadoForm";

export default function Advogados({ user }) {
  const isAdmin = user?.role === "ADMIN";

  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("list"); // list | create | edit | view

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Advogados
          </h1>
          <p className="text-sm text-slate-600">
            Cadastro e manutenção de advogados do escritório
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setSelected(null);
              setMode("create");
            }}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            Novo advogado
          </button>
        )}
      </header>

      {mode === "list" && (
        <AdvogadoTable
          onView={(a) => {
            setSelected(a);
            setMode("view");
          }}
          onEdit={(a) => {
            setSelected(a);
            setMode("edit");
          }}
          isAdmin={isAdmin}
        />
      )}

      {(mode === "create" || mode === "edit") && (
        <AdvogadoForm
          advogado={selected}
          isAdmin={isAdmin}
          onCancel={() => setMode("list")}
        />
      )}

      {mode === "view" && (
        <AdvogadoForm
          advogado={selected}
          readOnly
          isAdmin={isAdmin}
          onCancel={() => setMode("list")}
        />
      )}
    </div>
  );
}
