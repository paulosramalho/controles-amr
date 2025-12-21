import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import Money from "../components/Money";

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
    if (selectedContrato) {
      const novo = (data || []).find((c) => c.id === selectedContrato.id);
      if (novo) setSelectedContrato(novo);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openContrato = (contrato) => {
    setSelectedContrato(contrato);
  };

  const closeModal = () => {
    setSelectedContrato(null);
  };

  const totais = useMemo(() => {
    if (!selectedContrato) return null;

    const parcelas = selectedContrato.parcelas || [];

    const previsto = parcelas
      .filter((p) => p.status !== "CANCELADA")
      .reduce((s, p) => s + Number(p.valorPrevisto || 0), 0);

    const recebido = parcelas
      .filter((p) => p.status === "RECEBIDA")
      .reduce((s, p) => s + Number(p.valorRecebido || 0), 0);

    return {
      previsto,
      recebido,
      diferenca: recebido - previsto,
    };
  }, [selectedContrato]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Pagamentos</h1>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Contrato</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-right">Valor total</th>
              <th className="px-4 py-3 text-right">Valor recebido</th>
              <th className="px-4 py-3 text-right">Pendente</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => {
              const parcelas = c.parcelas || [];

              const previsto = parcelas
                .filter((p) => p.status !== "CANCELADA")
                .reduce((s, p) => s + Number(p.valorPrevisto || 0), 0);

              const recebido = parcelas
                .filter((p) => p.status === "RECEBIDA")
                .reduce((s, p) => s + Number(p.valorRecebido || 0), 0);

              const pendente = previsto - recebido;

              const atrasado = parcelas.some(isAtrasada);

              return (
                <tr
                  key={c.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => openContrato(c)}
                >
                  <td className="px-4 py-3">{c.numeroContrato}</td>
                  <td className="px-4 py-3">{c.cliente?.nome}</td>
                  <td className="px-4 py-3 text-right">
                    <Money value={previsto} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={recebido} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={pendente} />
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
          </tbody>
        </table>
      </div>

      {selectedContrato && (
        <Modal
          title={`Contrato ${selectedContrato.numeroContrato}`}
          onClose={closeModal}
          size="xl"
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Recebido</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {selectedContrato.parcelas.map((p, i) => {
                const atrasada = isAtrasada(p);

                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">
                      {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={p.valorPrevisto} />
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
                    <td className="px-3 py-2 text-right">
                      {p.valorRecebido ? (
                        <Money value={p.valorRecebido} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === "PREVISTA" && (
                        <button
                          className="text-red-600 text-xs font-semibold hover:underline"
                          onClick={async () => {
                            const motivo = window.prompt(
                              "Motivo do cancelamento (obrigatório):"
                            );
                            if (!motivo) return;

                            await apiFetch(
                              `/parcelas/${p.id}/cancelar`,
                              {
                                method: "PATCH",
                                body: { motivo },
                              }
                            );
                            load();
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totais && (
            <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
              <div>
                <div className="text-slate-500">Total previsto</div>
                <div className="font-semibold">
                  <Money value={totais.previsto} />
                </div>
              </div>
              <div>
                <div className="text-slate-500">Total recebido</div>
                <div className="font-semibold">
                  <Money value={totais.recebido} />
                </div>
              </div>
              <div>
                <div className="text-slate-500">Diferença</div>
                <div
                  className={`font-semibold ${
                    totais.diferenca >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  <Money value={totais.diferenca} />
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
