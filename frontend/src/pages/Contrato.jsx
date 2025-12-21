// src/pages/Contrato.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

/* helpers (copiados do padrão das telas) */
function formatBRLFromDecimal(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDDMMYYYY(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function normalizeForma(fp) {
  const v = String(fp || "").toUpperCase();
  if (v === "AVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA_PARCELAS") return "Entrada + Parcelas";
  return fp || "—";
}

function computeStatusContrato(contrato) {
  if (!contrato?.ativo) return { label: "Inativo", tone: "red" };

  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return { label: "Sem parcelas", tone: "amber" };

  const recebidas = parcelas.filter((p) => p.status === "RECEBIDA").length;
  if (recebidas === parcelas.length) return { label: "Quitado", tone: "green" };

  const now = new Date();
  const hasOverdue = parcelas.some((p) => {
    if (p.status !== "PREVISTA") return false;
    const v = new Date(p.vencimento);
    return Number.isFinite(v.getTime()) && v < now;
  });

  return hasOverdue ? { label: "Atrasado", tone: "red" } : { label: "Em dia", tone: "blue" };
}

function Badge({ tone = "slate", children }) {
  const map = {
    slate: "border-slate-200 bg-slate-600 text-white",
    blue: "border-blue-700 bg-blue-600 text-white",
    red: "border-red-700 bg-red-600 text-white",
    green: "border-green-700 bg-green-600 text-white",
    amber: "border-amber-700 bg-amber-600 text-white",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[tone] || map.slate}`}>
      {children}
    </span>
  );
}

function Modal({ title, children, onClose, size = "lg" }) {
  const width =
    size === "sm" ? "max-w-md" : size === "xl" ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${width} rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}


function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="text-xl font-semibold text-slate-900">{title}</div>
        {right ? <div className="pt-0.5">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelParcela, setCancelParcela] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [canceling, setCanceling] = useState(false);

  const openCancel = (parcela) => {
    setCancelParcela(parcela);
    setCancelMotivo("");
    setCancelOpen(true);
  };

  const submitCancel = async () => {
    if (!cancelParcela) return;
    const motivo = String(cancelMotivo || "").trim();
    if (!motivo) return;
    setCanceling(true);
    try {
      await apiFetch(`/parcelas/${cancelParcela.id}/cancelar`, {
        method: "PATCH",
        body: { motivo },
      });
      setCancelOpen(false);
      setCancelParcela(null);
      setCancelMotivo("");
      await load();
    } finally {
      setCanceling(false);
    }
  };

  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState("");

  async function loadContrato() {
    setError("");
    setLoading(true);
    try {
      // Preferência: endpoint dedicado
      const c = await apiFetch(`/contratos/${id}`);
      setContrato(c || null);
    } catch (e1) {
      // Fallback: se não existir rota GET /contratos/:id ainda,
      // busca lista e localiza.
      try {
        const all = await apiFetch(`/contratos`);
        const found = (Array.isArray(all) ? all : []).find((x) => String(x.id) === String(id));
        if (!found) throw new Error("Contrato não encontrado.");
        setContrato(found);
      } catch (e2) {
        setError(e2?.message || e1?.message || "Falha ao carregar contrato.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const parcelas = contrato?.parcelas || [];

  const totals = useMemo(() => {
    const totalPrevisto = parcelas.reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
    const totalRecebido = parcelas.reduce((sum, p) => sum + Number(p?.valorRecebido || 0), 0);
    const diferenca = totalRecebido - totalPrevisto;
    return { totalPrevisto, totalRecebido, diferenca };
  }, [parcelas]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xl font-semibold text-slate-900">Contrato</div>
          <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>
        </div>
      </div>
    );
  }

  const status = contrato ? computeStatusContrato(contrato) : { label: "—", tone: "slate" };

  return (
    <div className="p-6">
      <Card
        title={contrato ? `Contrato ${contrato.numeroContrato}` : "Contrato"}
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              ← Voltar
            </button>

            <Link
              to="/pagamentos"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Pagamentos
            </Link>
          </div>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        ) : null}

        {!contrato ? (
          <div className="text-sm text-slate-600">{loading ? "Carregando..." : "Contrato não encontrado."}</div>
        ) : (
          <div className="space-y-5">
            {/* Bloco “como foi lançado” */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-500">Cliente</div>
                <div className="font-semibold text-slate-900">{contrato?.cliente?.nomeRazaoSocial || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Forma</div>
                <div className="font-semibold text-slate-900">{normalizeForma(contrato.formaPagamento)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-slate-500">Status</div>
                  <div className="mt-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-500">Valor total</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(contrato.valorTotal)}</div>
              </div>
              <div>
                <div className="text-slate-500">Criado em</div>
                <div className="font-semibold text-slate-900">{toDDMMYYYY(contrato.createdAt)}</div>
              </div>
              <div>
                <div className="text-slate-500">Ativo</div>
                <div className="font-semibold text-slate-900">{contrato.ativo ? "Sim" : "Não"}</div>
              </div>

              {contrato.observacoes ? (
                <div className="md:col-span-3">
                  <div className="text-slate-500">Observações</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-800">{contrato.observacoes}</div>
                </div>
              ) : null}
            </div>

            {/* Parcelas (read-only) */}
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">#</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Previsto</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Recebido</th>
                    <th className="text-left px-4 py-3 font-semibold">Meio</th>
                    <th className="text-left px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parcelas.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{p.numero}</td>
                      <td className="px-4 py-3 text-slate-800">{toDDMMYYYY(p.vencimento)}</td>
                      <td className="px-4 py-3 text-slate-800">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                      <td className="px-4 py-3">
                        {p.status === "CANCELADA" ? (
                          <Badge tone="slate">Cancelada</Badge>
                        ) : p.status === "RECEBIDA" ? (
                          <Badge tone="green">Recebida</Badge>
                        ) : isParcelaAtrasada(p) ? (
                          <Badge tone="red">Atrasada</Badge>
                        ) : (
                          <Badge tone="blue">Prevista</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {p.valorRecebido ? `R$ ${formatBRLFromDecimal(p.valorRecebido)}` : "—"}
                        {p.dataRecebimento ? (
                          <div className="text-xs text-slate-500 mt-1">{toDDMMYYYY(p.dataRecebimento)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.meioRecebimento || "—"}</td>
                    </tr>
                  ))}

                  {!parcelas.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                        Nenhuma parcela cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Totais (read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-500">Total previsto</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(totals.totalPrevisto)}</div>
              </div>
              <div>
                <div className="text-slate-500">Total recebido</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(totals.totalRecebido)}</div>
              </div>
              <div>
                <div className="text-slate-500">Diferença</div>
                <div
                  className={`font-semibold ${
                    totals.diferenca < 0 ? "text-red-600" : totals.diferenca > 0 ? "text-blue-600" : "text-slate-900"
                  }`}
                >
                  R$ {formatBRLFromDecimal(totals.diferenca)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}