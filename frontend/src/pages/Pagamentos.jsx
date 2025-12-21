import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

/** ===== Helpers (sem dependências externas) ===== */

function formatMoneyBRL(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "R$ —";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Badge({ color = "blue", children }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
  const map = {
    blue: "bg-blue-600 text-white",
    red: "bg-red-600 text-white",
    green: "bg-emerald-600 text-white",
    slate: "bg-slate-500 text-white",
  };
  return <span className={`${base} ${map[color] || map.blue}`}>{children}</span>;
}

function Modal({ title, onClose, size = "xl", children }) {
  const maxW =
    size === "xl"
      ? "max-w-5xl"
      : size === "lg"
      ? "max-w-3xl"
      : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="presentation"
      />
      {/* panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`w-full ${maxW} rounded-2xl bg-white shadow-xl border border-slate-200`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

const isAtrasada = (parcela) => {
  if (parcela.status !== "PREVISTA") return false;
  const hoje = new Date();
  const v = new Date(parcela.vencimento);
  return Number.isFinite(v.getTime()) && v < hoje;
};

export default function Pagamentos() {
  const [contratos, setContratos] = useState([]);
  const [selectedContrato, setSelectedContrato] = useState(null);

  const load = async () => {
    const data = await apiFetch("/contratos");
    setContratos(data || []);

    // mantém modal sincronizado sem precisar fechar
    if (selectedContrato) {
      const novo = (data || []).find((c) => c.id === selectedContrato.id);
      if (novo) setSelectedContrato(novo);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totais = useMemo(() => {
    if (!selectedContrato) return null;

    const parcelas = selectedContrato.parcelas || [];

    const totalPrevisto = parcelas
      .filter((p) => p.status !== "CANCELADA")
      .reduce((s, p) => s + Number(p.valorPrevisto || 0), 0);

    const totalRecebido = parcelas
      .filter((p) => p.status === "RECEBIDA")
      .reduce((s, p) => s + Number(p.valorRecebido || 0), 0);

    return {
      totalPrevisto,
      totalRecebido,
      diferenca: totalRecebido - totalPrevisto,
    };
  }, [selectedContrato]);

  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Pagamentos</h1>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Contrato
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">
                Cliente
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                Valor total
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                Valor recebido
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                Pendente
              </th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {contratos.map((c) => {
              const parcelas = c.parcelas || [];

              const totalPrevisto = parcelas
                .filter((p) => p.status !== "CANCELADA")
                .reduce((s, p) => s + Number(p.valorPrevisto || 0), 0);

              const totalRecebido = parcelas
                .filter((p) => p.status === "RECEBIDA")
                .reduce((s, p) => s + Number(p.valorRecebido || 0), 0);

              const pendente = totalPrevisto - totalRecebido;

              const atrasado = parcelas.some(isAtrasada);

              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedContrato(c)}
                >
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {c.numeroContrato}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.cliente?.nome || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoneyBRL(totalPrevisto)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoneyBRL(totalRecebido)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoneyBRL(pendente)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {atrasado ? (
                      <Badge color="red">Atrasado</Badge>
                    ) : (
                      <Badge color="blue">Em dia</Badge>
                    )}
                  </td>
                </tr>
              );
            })}

            {contratos.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Nenhum contrato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedContrato && (
        <Modal
          title={`Controle de Parcelas do Contrato ${selectedContrato.numeroContrato} — ${
            selectedContrato.cliente?.nome || "Cliente"
          }`}
          onClose={() => setSelectedContrato(null)}
          size="xl"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Vencimento
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Valor
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Recebido
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {(selectedContrato.parcelas || []).map((p, i) => {
                  const atrasada = isAtrasada(p);

                  return (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoneyBRL(p.valorPrevisto)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.status === "CANCELADA" && (
                          <Badge color="slate">Cancelada</Badge>
                        )}
                        {p.status === "RECEBIDA" && (
                          <Badge color="green">Recebida</Badge>
                        )}
                        {p.status === "PREVISTA" && !atrasada && (
                          <Badge color="blue">Prevista</Badge>
                        )}
                        {p.status === "PREVISTA" && atrasada && (
                          <Badge color="red">Atrasada</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.valorRecebido ? formatMoneyBRL(p.valorRecebido) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.status === "PREVISTA" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            onClick={async () => {
                              const motivo = window.prompt(
                                "Motivo do cancelamento (obrigatório):"
                              );
                              if (!motivo || !motivo.trim()) return;

                              await apiFetch(`/parcelas/${p.id}/cancelar`, {
                                method: "PATCH",
                                body: { motivo: motivo.trim() },
                              });

                              await load();
                            }}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Totais no rodapé da tabela */}
                {totais && (
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right font-semibold text-slate-700">
                      Totais:
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatMoneyBRL(totais.totalPrevisto)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-slate-500">—</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatMoneyBRL(totais.totalRecebido)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs text-slate-500">
                        Diferença:{" "}
                        <span
                          className={
                            totais.diferenca >= 0
                              ? "text-emerald-700 font-semibold"
                              : "text-red-700 font-semibold"
                          }
                        >
                          {formatMoneyBRL(totais.diferenca)}
                        </span>
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
