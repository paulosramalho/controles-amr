import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

/** ===== Helpers ===== */

function formatMoneyBRL(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "R$ —";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getClienteNome(contrato) {
  const c = contrato?.cliente;

  // tenta caminhos mais comuns
  const candidates = [
    c?.nome,
    c?.nomeRazaoSocial,
    c?.razaoSocial,
    c?.nomeFantasia,
    contrato?.clienteNome,
    contrato?.clienteRazaoSocial,
    contrato?.cliente_nome,
    contrato?.cliente_razao_social,
    contrato?.nomeCliente,
  ];

  const v = candidates.find((x) => typeof x === "string" && x.trim());
  return v ? v.trim() : "Cliente";
}

function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
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

function Modal({ title, onClose, size = "xl", children, footer }) {
  const maxW =
    size === "xl"
      ? "max-w-6xl"
      : size === "lg"
      ? "max-w-4xl"
      : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="presentation"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={`w-full ${maxW} rounded-2xl bg-white shadow-xl border border-slate-200`}>
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

          {footer ? (
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              {footer}
            </div>
          ) : null}
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

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/contratos");
      setContratos(data || []);

      // mantém modal sincronizado sem precisar fechar
      if (selectedContrato) {
        const novo = (data || []).find((c) => c.id === selectedContrato.id);
        if (novo) setSelectedContrato(novo);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contratosFiltrados = useMemo(() => {
    const needle = normalizeText(q);
    if (!needle) return contratos;

    return contratos.filter((c) => {
      const texto = [
        c?.numeroContrato,
        getClienteNome(c),
        c?.formaPagamento,
        c?.status,
      ]
        .filter(Boolean)
        .join(" | ");

      return normalizeText(texto).includes(needle);
    });
  }, [contratos, q]);

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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Pagamentos</h1>

        {/* Buscar + Atualizar (topo, padrão) */}
        <div className="flex items-center gap-2">
          <input
            className="w-80 max-w-[55vw] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Buscar por contrato, cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            title="Atualizar"
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Listagem */}
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
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {contratosFiltrados.map((c) => {
              const parcelas = c.parcelas || [];

              const totalPrevisto = parcelas
                .filter((p) => p.status !== "CANCELADA")
                .reduce((s, p) => s + Number(p.valorPrevisto || 0), 0);

              const totalRecebido = parcelas
                .filter((p) => p.status === "RECEBIDA")
                .reduce((s, p) => s + Number(p.valorRecebido || 0), 0);

              const pendente = totalPrevisto - totalRecebido;
              const atrasado = parcelas.some(isAtrasada);

              const clienteNome = getClienteNome(c);

              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td
                    className="px-4 py-3 text-slate-900 font-medium cursor-pointer"
                    onClick={() => setSelectedContrato(c)}
                    title="Abrir controle de parcelas"
                  >
                    {c.numeroContrato}
                  </td>

                  <td
                    className="px-4 py-3 text-slate-700 cursor-pointer"
                    onClick={() => setSelectedContrato(c)}
                    title="Abrir controle de parcelas"
                  >
                    {clienteNome}
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

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => window.open(`/contratos/${c.id}`, "_blank")}
                      title="Ver contrato (read-only)"
                    >
                      Ver contrato
                    </button>
                  </td>
                </tr>
              );
            })}

            {contratosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Nenhum contrato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedContrato && (
        <Modal
          title={`Controle de Parcelas do Contrato ${selectedContrato.numeroContrato} — ${getClienteNome(
            selectedContrato
          )}`}
          onClose={() => setSelectedContrato(null)}
          size="xl"
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => window.open(`/contratos/${selectedContrato.id}`, "_blank")}
              >
                Ver contrato (read-only)
              </button>

              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={() => setSelectedContrato(null)}
              >
                Fechar
              </button>
            </div>
          }
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

                {/* Totais no rodapé */}
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
