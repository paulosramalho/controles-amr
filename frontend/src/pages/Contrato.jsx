/* /mnt/data/Contrato.jsx.updated62.jsx */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api"; // mantém seu import original
import Modal from "../components/Modal"; // mantém seu import original

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-200 text-slate-800",
    blue: "bg-blue-600 text-white",
    green: "bg-emerald-600 text-white",
    red: "bg-red-600 text-white",
    amber: "bg-amber-500 text-white",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tones[tone] || tones.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function isParcelaAtrasada(p) {
  if (!p) return false;
  if (p.status !== "PREVISTA") return false;
  const now = new Date();
  const v = new Date(p.vencimento);
  return Number.isFinite(v.getTime()) && v < now;
}

function moneyBR(v) {
  const n = Number(v ?? 0) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/contratos/${id}`);
      setContrato(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar contrato.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // cancelamento (modal premium)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [parcelaToCancel, setParcelaToCancel] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  function openCancelModal(parcela) {
    setParcelaToCancel(parcela);
    setCancelMotivo("");
    setCancelOpen(true);
  }

  function closeCancelModal() {
    setCancelOpen(false);
    setParcelaToCancel(null);
    setCancelMotivo("");
  }

  async function cancelarParcela() {
    if (!parcelaToCancel) return;
    const motivo = String(cancelMotivo || "").trim();
    if (!motivo) {
      alert("Informe o motivo do cancelamento.");
      return;
    }

    setCanceling(true);
    try {
      const resp = await apiFetch(`/api/parcelas/${parcelaToCancel.id}/cancelar`, {
        method: "PATCH",
        body: { motivo },
      });

      // atualiza contrato imediatamente
      setContrato((prev) => {
        if (!prev) return prev;
        const parcelas = (prev.parcelas || []).map((p) =>
          p.id === parcelaToCancel.id
            ? { ...p, ...(resp?.parcela || {}), status: "CANCELADA", motivoCancelamento: motivo }
            : p
        );
        return { ...prev, parcelas };
      });

      closeCancelModal();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao cancelar parcela.");
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-500">Carregando…</div>;
  }

  if (!contrato) {
    return (
      <div className="p-6">
        <div className="text-slate-700 font-semibold">Contrato não encontrado.</div>
        <button
          className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => nav(-1)}
        >
          Voltar
        </button>
      </div>
    );
  }

  const clienteNome = contrato?.cliente?.nomeRazaoSocial || "Cliente";
  const parcelas = contrato?.parcelas || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ver Contrato</h1>
          <div className="text-sm text-slate-500">
            Contrato <span className="font-semibold text-slate-700">{contrato.numeroContrato}</span> — {clienteNome}
          </div>
        </div>

        <button
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => nav(-1)}
        >
          Voltar
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">#</th>
              <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
              <th className="px-4 py-3 text-right font-semibold">Valor previsto</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Valor recebido</th>
              <th className="px-4 py-3 text-left font-semibold">Data recebimento</th>
              <th className="px-4 py-3 text-left font-semibold">Meio</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {parcelas.map((p, idx) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{idx + 1}</td>
                <td className="px-4 py-3">{p.vencimento}</td>
                <td className="px-4 py-3 text-right">{moneyBR(p.valorPrevisto)}</td>

                <td className="px-4 py-3 whitespace-nowrap">
                  {p.status === "RECEBIDA" ? (
                    <Badge tone="green">Recebida</Badge>
                  ) : p.status === "CANCELADA" ? (
                    <Badge tone="slate">Cancelada</Badge>
                  ) : isParcelaAtrasada(p) ? (
                    <Badge tone="red">Atrasada</Badge>
                  ) : (
                    <Badge tone="blue">Prevista</Badge>
                  )}

                  {p.status === "CANCELADA" && p.motivoCancelamento ? (
                    <div
                      className="mt-1 text-xs text-slate-500 max-w-[220px] truncate"
                      title={p.motivoCancelamento}
                    >
                      Motivo: {p.motivoCancelamento}
                    </div>
                  ) : null}
                </td>

                <td className="px-4 py-3 text-right">{p.status === "RECEBIDA" ? moneyBR(p.valorRecebido) : "—"}</td>
                <td className="px-4 py-3">{p.status === "RECEBIDA" ? (p.dataRecebimento || "—") : "—"}</td>
                <td className="px-4 py-3">{p.status === "RECEBIDA" ? (p.meioRecebimento || "—") : "—"}</td>

                <td className="px-4 py-3 text-right">
                  {isAdmin && p.status !== "RECEBIDA" && p.status !== "CANCELADA" ? (
                    <button
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                      onClick={() => openCancelModal(p)}
                    >
                      Cancelar
                    </button>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Cancelar Parcela */}
      <Modal open={cancelOpen} onClose={closeCancelModal} title="Cancelar parcela" size="md">
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            Informe o motivo (obrigatório). Parcela recebida não pode ser cancelada.
          </div>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Motivo</div>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Ex.: renegociação / isenção / erro de lançamento…"
              disabled={canceling}
            />
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={closeCancelModal}
              disabled={canceling}
            >
              Fechar
            </button>
            <button
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              onClick={cancelarParcela}
              disabled={canceling}
            >
              {canceling ? "Cancelando…" : "Cancelar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
