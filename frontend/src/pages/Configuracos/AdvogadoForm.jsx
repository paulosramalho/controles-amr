// frontend/src/pages/Configuracoes/AdvogadoForm.jsx
export default function AdvogadoForm({
  advogado,
  isAdmin,
  readOnly,
  onCancel,
}) {
  const disabled = readOnly || (!isAdmin && advogado);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {advogado ? "Advogado" : "Novo advogado"}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Nome completo" disabled={disabled} />
        <Input label="CPF" disabled={disabled} />
        <Input label="OAB" disabled={disabled} />
        <Input label="E-mail" disabled={disabled} />
        <Input label="Telefone / WhatsApp" />
        <Input label="Chave Pix" />
        <Input label="Senha" type="password" disabled={!isAdmin} />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-300 text-sm"
        >
          Cancelar
        </button>

        {!readOnly && (
          <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold">
            Salvar
          </button>
        )}
      </div>
    </div>
  );
}

function Input({ label, type = "text", disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        disabled={disabled}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
      />
    </div>
  );
}
