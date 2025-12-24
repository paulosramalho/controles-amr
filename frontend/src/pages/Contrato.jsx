// src/pages/Contrato.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

/* ---------------- helpers (mantidos) ---------------- */
function onlyDigits(v = "") {
  return String(v ?? "").replace(/\D/g, "");
}

function parseDateDDMMYYYY(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

function toDDMMYYYY(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDateOnly(d) {
  if (!d) return null;

  if (typeof d === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const parsed = parseDateDDMMYYYY(d);
    if (!parsed) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  const x = new Date(d);
  if (!Number.isFinite(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

function isParcelaAtrasada(p) {
  if (!p) return false;
  if (p.status !== "PREVISTA") return false;
  if (!p.vencimento) return false;

  const hoje = toDateOnly(new Date());
  const venc = toDateOnly(p.vencimento);

  if (!hoje || !venc) return false;

  return venc < hoje;
}

function normalizeForma(fp) {
  const v = String(fp || "").toUpperCase();
  if (v === "AVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA_PARCELAS") return "Entrada + Parcelas";
  return fp || "—";
}

function formatBRLFromDecimal(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------- status helpers (mantidos) ---------------- */
function computeStatusContrato(contrato) {
  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return "EM_DIA";

  // prioridade: RENEGOCIADO
  if (contrato?.renegociadoParaId) return "RENEGOCIADO";

  const todasCanceladas = parcelas.every((p) => p.status === "CANCELADA");
  if (todasCanceladas) return "CANCELADO";

  const todasEncerradas = parcelas.every((p) => p.status === "RECEBIDA" || p.status === "CANCELADA");
  if (todasEncerradas) return "QUITADO";

  const atrasada = parcelas.some((p) => isParcelaAtrasada(p));
  if (atrasada) return "ATRASADO";

  return "EM_DIA";
}

function statusLabel(st) {
  if (st === "ATRASADO") return "Atrasado";
  if (st === "RENEGOCIADO") return "Renegociado";
  if (st === "QUITADO") return "Quitado";
  if (st === "CANCELADO") return "Cancelado";
  return "Em dia";
}

function statusTone(st) {
  if (st === "ATRASADO") return "red";
  if (st === "RENEGOCIADO") return "amber";
  if (st === "QUITADO") return "green";
  if (st === "CANCELADO") return "slate";
  return "blue";
}

/* ---------------- UI components ---------------- */
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

function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-600 text-white",
    green: "bg-green-600 text-white",
    red: "bg-red-600 text-white",
    blue: "bg-blue-600 text-white",
    amber: "bg-amber-500 text-white",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

/* ---------------- Page ---------------- */
export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(`/contratos/${id}`);
      setContrato(data || null);
    } catch (e) {
      setError(e?.message || "Falha ao carregar contrato.");
      setContrato(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

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

  const st = contrato ? computeStatusContrato(contrato) : "EM_DIA";
  const stLabel = statusLabel(st);
  const stTone = statusTone(st);

  return (
    <div className="p-6">
      <Card
        title={contrato ? `Contrato ${contrato.numeroContrato}` : "Contrato"}
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Voltar
            </button>

            <Link
              to="/pagamentos"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
              <div>
                <div className="text-slate-500">Status</div>
                <div className="mt-1">
                  <Badge tone={stTone}>{stLabel}</Badge>
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

            {/* ✅ Vínculos (pai/filho) — renegociação */}
            {(() => {
              const parent = contrato?.contratoOrigem;
              const child = contrato?.renegociadoPara;

              const listA = Array.isArray(contrato?.derivados) ? contrato.derivados : [];
              const listB = Array.isArray(contrato?.renegociadosDele) ? contrato.renegociadosDele : [];
              const all = [...listA, ...listB].filter(Boolean);

              const uniq = [];
              const seen = new Set();
              for (const it of all) {
                if (!it?.id) continue;
                if (seen.has(it.id)) continue;
                seen.add(it.id);
                uniq.push(it);
              }

              if (!parent && !child && uniq.length === 0) return null;

              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <div className="font-semibold text-slate-900">Dossiê de renegociação</div>

                  <div className="mt-2 space-y-1 text-slate-700">
                    {parent ? (
                      <div>
                        Originado da renegociação do contrato{" "}
                        <Link to={`/contratos/${parent.id}`} className="font-semibold text-slate-900 hover:underline">
                          {parent.numeroContrato}
                        </Link>
                      </div>
                    ) : null}

                    {child ? (
                      <div>
                        Renegociado para o contrato{" "}
                        <Link to={`/contratos/${child.id}`} className="font-semibold text-slate-900 hover:underline">
                          {child.numeroContrato}
                        </Link>
                      </div>
                    ) : null}

                    {uniq.length ? (
                      <div className="pt-1">
                        <div className="text-slate-500 text-xs">Renegociações derivadas</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {uniq.map((it) => (
                            <Link
                              key={it.id}
                              to={`/contratos/${it.id}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                              title="Abrir contrato"
                            >
                              {it.numeroContrato}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            {/* Parcelas */}
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">#</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Previsto</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Recebido</th>
                    <th className="text-left px-4 py-3 font-semibold">Meio</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {(contrato.parcelas || []).map((p) => {
                    const badge =
                      p.status === "CANCELADA"
                        ? { label: "Cancelada", tone: "slate" }
                        : p.status === "RECEBIDA"
                        ? { label: "Recebida", tone: "green" }
                        : isParcelaAtrasada(p)
                        ? { label: "Atrasada", tone: "red" }
                        : { label: "Prevista", tone: "blue" };

                    const motivo = p.cancelamentoMotivo || p.motivoCancelamento;

                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{p.numero}</td>
                        <td className="px-4 py-3 text-slate-800">{toDDMMYYYY(p.vencimento)}</td>
                        <td className="px-4 py-3 text-slate-800">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.status === "CANCELADA" ? (
                            <div className="space-y-1">
                              <Badge tone={badge.tone}>{badge.label}</Badge>
                              <div className="text-xs text-slate-500">
                                {p.canceladaEm ? `Cancelada em ${toDDMMYYYY(p.canceladaEm)}` : "Cancelada"}
                                {p.canceladaPor?.nome ? ` por ${p.canceladaPor.nome}` : ""}
                              </div>
                              {motivo ? (
                                <div className="text-xs text-slate-500 truncate max-w-[260px]" title={motivo}>
                                  Motivo: {motivo}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <Badge tone={badge.tone}>{badge.label}</Badge>
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
                    );
                  })}

                  {!(contrato.parcelas || []).length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        Nenhuma parcela cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
