import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../services/api";
import Badge from "../components/Badge";
import Money from "../components/Money";

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
  }, [id]);

  if (!contrato) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Contrato {contrato.numeroContrato}
      </h1>

      <table className="min-w-full text-sm border rounded-xl">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Vencimento</th>
            <th className="px-3 py-2 text-right">Valor</th>
            <th className="px-3 py-2 text-center">Status</th>
            <th className="px-3 py-2 text-right">Recebido</th>
          </tr>
        </thead>
        <tbody>
          {contrato.parcelas.map((p, i) => {
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
