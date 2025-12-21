import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

const isAtrasada = (p) => {
  if (p.status !== "PREVISTA") return false;
  const hoje = new Date();
  const v = new Date(p.vencimento);
  return Number.isFinite(v.getTime()) && v < hoje;
};

export default function Contrato() {
  const { id } = useParams();
  const [contrato, setContrato] = useState(null);

  const load = async () => {
    const data = await apiFetch(`/contratos/${id}`);
    setContrato(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!contrato) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4 text-slate-900">
        Contrato {contrato.numeroContrato}
      </h1>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
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
            </tr>
          </thead>

          <tbody>
            {(contrato.parcelas || []).map((p, i) => {
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
                </tr>
              );
            })}

            {(contrato.parcelas || []).length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Nenhuma parcela encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
