// frontend/src/pages/Configuracoes/Advogados/AdvogadoView.jsx
import React from "react";

function Badge({ children, tone = "slate" }) {
  const map = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[tone] || map.slate}`}>
      {children}
    </span>
  );
}

export default function AdvogadoView({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Advogado</h2>
              <Badge tone={item.ativo ? "green" : "red"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
              {item.role ? <Badge tone="blue">{item.role}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">Detalhes do cadastro (somente leitura).</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Info label="ID" value={item.id} />
          <Info label="Nome" value={item.nome} />
          <Info label="CPF" value={item.cpf} />
          <Info label="OAB" value={item.oab} />
          <Info label="E-mail (login)" value={item.email} />
          <Info label="Telefone/WhatsApp" value={item.telefone} />
          <Info label="Chave Pix" value={item.chavePix || "—"} />
          <Info label="Usuário vinculado" value={item.usuarioId ? `#${item.usuarioId}` : "—"} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{String(value ?? "—")}</div>
    </div>
  );
}
