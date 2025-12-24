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

function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

/**
 * Máscara moeda aprovada (digitando: 1→0,01; 12→0,12; 123→1,23; 1234→12,34; 12345→123,45; 123456→1.234,56)
 * Retorna string sem "R$ " (só número formatado pt-BR).
 */
function maskBRLFromDigits(digits) {
  const d = onlyDigits(digits);
  const n = d ? Number(d) : 0;
  const val = n / 100;
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function digitsToNumber(digits) {
  const d = onlyDigits(digits);
  const n = d ? Number(d) : 0;
  return n / 100;
}

function sumMovimentos(parcela) {
  const movs = Array.isArray(parcela?.movimentos) ? parcela.movimentos : [];
  return movs.reduce((s, m) => s + Number(m?.valor || 0), 0);
}

function toDDMMYYYY(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isDateBeforeToday(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return false;
  const now = new Date();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d0 < n0;
}

function normalizeForma(fp) {
  const v = String(fp || "").toUpperCase();
  if (v === "AVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA_PARCELAS") return "Entrada + Parcelas";
  return fp || "—";
}

/**
 * Padrão aprovado:
 * computeStatusContrato(c) → "EM_DIA" | "ATRASADO" | "QUITADO" | "CANCELADO" | "RENEGOCIADO"
 */
function computeStatusContrato(contrato) {
  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return "EM_DIA";

  // Se houver vínculo de renegociação
  if (contrato?.renegociadoParaId) return "RENEGOCIADO";

  const todasCanceladas = parcelas.every((p) => p.status === "CANCELADA");
  if (todasCanceladas) return "CANCELADO";

  const todasEncerradas = parcelas.every((p) => p.status === "RECEBIDA" || p.status === "CANCELADA");
  if (todasEncerradas) return "QUITADO";

  const hasOverdue = parcelas.some((p) => p?.status === "PREVISTA" && isDateBeforeToday(p.vencimento));
  if (hasOverdue) return "ATRASADO";

  return "EM_DIA";
}

function statusLabel(st) {
  if (st === "ATRASADO") return "Atrasado";
  if (st === "QUITADO") return "Quitado";
  if (st === "CANCELADO") return "Cancelado";
  if (st === "RENEGOCIADO") return "Renegociado";
  return "Em dia";
}

function statusTone(st) {
  if (st === "ATRASADO") return "red";
  if (st === "QUITADO") return "green";
  if (st === "CANCELADO") return "slate";
  if (st === "RENEGOCIADO") return "amber";
  return "blue";
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

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? <div className="p-5 border-t border-slate-200 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState("");

  // 6.3.B — movimentos/ajustes em parcelas (contralançamento)
  const [movOpen, setMovOpen] = useState(false);
  const [movSaving, setMovSaving] = useState(false);
  const [movError, setMovError] = useState("");
  const [movParcela, setMovParcela] = useState(null);
  const [movTipo, setMovTipo] = useState("AJUSTE");
  const [movSign, setMovSign] = useState("-");
  const [movValorDigits, setMovValorDigits] = useState("");
  const [movData, setMovData] = useState("");
  const [movMeio, setMovMeio] = useState("PIX");
  const [movMotivo, setMovMotivo] = useState("");

  const [transfOpen, setTransfOpen] = useState(false);
  const [transfSaving, setTransfSaving] = useState(false);
  const [transfError, setTransfError] = useState("");
  const [transfParcela, setTransfParcela] = useState(null);
  const [transfDestinoId, setTransfDestinoId] = useState("");
  const [transfValorDigits, setTransfValorDigits] = useState("");
  const [transfData, setTransfData] = useState("");
  const [transfMeio, setTransfMeio] = useState("PIX");
  const [transfMotivo, setTransfMotivo] = useState("");

  const [retOpen, setRetOpen] = useState(false);
  const [retSaving, setRetSaving] = useState(false);
  const [retError, setRetError] = useState("");
  const [retParcela, setRetParcela] = useState(null);

  const [retValorDigits, setRetValorDigits] = useState(""); // máscara moeda padrão
  const [retMotivo, setRetMotivo] = useState("");
  const [retAdminPassword, setRetAdminPassword] = useState("");

  function openMovimento(parcela) {
    setMovError("");
    setMovParcela(parcela);
    setMovTipo("AJUSTE");
    setMovSign("-");
    setMovValorDigits("");
    setMovData("");
    setMovMeio("PIX");
    setMovMotivo("");
    setMovOpen(true);
  }

  function openTransferencia(parcela) {
    setTransfError("");
    setTransfParcela(parcela);
    setTransfDestinoId("");
    setTransfValorDigits("");
    setTransfData("");
    setTransfMeio("PIX");
    setTransfMotivo("");
    setTransfOpen(true);
  }

  async function loadContrato() {
    setError("");
    setLoading(true);
    try {
      const c = await apiFetch(`/contratos/${id}`);
      setContrato(c || null);
    } catch (e1) {
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

function openRetificar(parcela) {
  setRetError("");
  setRetParcela(parcela);

  // pré-preenche com o valor previsto atual
  const v = Number(parcela?.valorPrevisto || 0);
  const digits = String(Math.round(v * 100)); // transforma 1234.56 -> "123456"
  setRetValorDigits(digits);

  setRetMotivo("");
  setRetAdminPassword("");
  setRetOpen(true);
}

async function salvarRetificacao() {
  if (!retParcela?.id) return;

  setRetError("");

  const motivo = String(retMotivo || "").trim();
  if (!motivo) return setRetError("Informe o motivo.");

  // ✅ valor como number (não manda '1.234,56' pra API)
  const valorPrevisto = digitsToNumber(retValorDigits);
  if (!valorPrevisto || valorPrevisto <= 0) return setRetError("Informe um valor previsto válido.");

  if (!retAdminPassword) return setRetError("Confirme a senha do admin.");

  setRetSaving(true);
  try {
    await apiFetch(`/parcelas/${retParcela.id}/retificar`, {
      method: "POST",
      body: {
        adminPassword: retAdminPassword,
        motivo,
        patch: { valorPrevisto },  // ✅ number
      },
    });

    setRetOpen(false);
    await loadContrato();
  } catch (e) {
    // ✅ aqui entra a mensagem de bloqueio no modal
    setRetError(e?.message || "Falha ao retificar.");
  } finally {
    setRetSaving(false);
  }
}

  useEffect(() => {
    if (!isAdmin) return;
    loadContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const parcelas = contrato?.parcelas || [];

  const qtdPrevistas = (parcelas || []).filter((x) => x?.status === "PREVISTA").length;

  const totals = useMemo(() => {
    const ativas = parcelas.filter((p) => p?.status !== "CANCELADA");
    const totalPrevisto = ativas.reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
    const totalRecebido = ativas.reduce((sum, p) => {
      if (p?.status !== "RECEBIDA") return sum;
      const efetivo = Number(p?.valorRecebido || 0) + sumMovimentos(p);
      return sum + efetivo;
    }, 0);
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

  const st = contrato ? computeStatusContrato(contrato) : "EM_DIA";
  const stLabel = statusLabel(st);
  const stTone = statusTone(st);

  const renegociarHref = contrato ? `/pagamentos?renegociar=${encodeURIComponent(String(contrato.id))}` : "/pagamentos";

  async function salvarMovimento() {
    if (!movParcela?.id) return;
    setMovError("");

    const motivo = String(movMotivo || "").trim();
    if (!motivo) return setMovError("Informe o motivo.");
    if (!movData) return setMovError("Informe a data do movimento (DD/MM/AAAA).");

    // valor
    const base = digitsToNumber(movValorDigits);
    if (!base || base <= 0) return setMovError("Informe um valor válido.");
    const valor = movSign === "-" ? -base : base;

    setMovSaving(true);
    try {
      await apiFetch(`/parcelas/${movParcela.id}/movimentos`, {
        method: "POST",
        body: {
          tipo: movTipo,
          valor,
          dataMovimento: movData,
          meio: movMeio,
          motivo,
        },
      });
      setMovOpen(false);
      await loadContrato();
    } catch (e) {
      // ✅ a mensagem fica DENTRO do modal
      setMovError(e?.message || "Falha ao salvar movimento.");
    } finally {
      setMovSaving(false);
    }
  }

  async function salvarTransferencia() {
    if (!transfParcela?.id) return;
    setTransfError("");

    const motivo = String(transfMotivo || "").trim();
    if (!motivo) return setTransfError("Informe o motivo.");
    if (!transfData) return setTransfError("Informe a data do movimento (DD/MM/AAAA).");
    if (!transfDestinoId) return setTransfError("Informe o ID da parcela destino.");

    const base = digitsToNumber(transfValorDigits);
    if (!base || base <= 0) return setTransfError("Informe um valor válido.");

    setTransfSaving(true);
    try {
      await apiFetch(`/parcelas/${transfParcela.id}/transferir-recebimento`, {
        method: "POST",
        body: {
          parcelaDestinoId: Number(transfDestinoId),
          valor: base,
          dataMovimento: transfData,
          meio: transfMeio,
          motivo,
        },
      });
      setTransfOpen(false);
      await loadContrato();
    } catch (e) {
      // ✅ a mensagem fica DENTRO do modal
      setTransfError(e?.message || "Falha ao transferir recebimento.");
    } finally {
      setTransfSaving(false);
    }
  }

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
              to={renegociarHref}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              title="Abrir Pagamentos para renegociar o saldo do contrato"
            >
              Renegociar Saldo
            </Link>

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

            {/* Parcelas */}
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-white text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">#</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Previsto</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Recebido</th>
                    <th className="text-left px-4 py-3 font-semibold">Meio</th>
                    <th className="text-right px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parcelas.map((p) => {
                    const isOverdue = p.status === "PREVISTA" && isDateBeforeToday(p.vencimento);
                    const badge =
                      p.status === "CANCELADA"
                        ? { label: "Cancelada", tone: "slate" }
                        : p.status === "RECEBIDA"
                        ? { label: "Recebida", tone: "green" }
                        : isOverdue
                        ? { label: "Atrasada", tone: "red" }
                        : { label: "Prevista", tone: "blue" };

                    const motivo =
                      p.cancelamentoMotivo || p.motivoCancelamento || p.cancelMotivo || p.motivo || "";

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

                          {p.status === "RECEBIDA" && (p.movimentos?.length || 0) > 0 ? (
                            <div className="mt-2 text-xs text-slate-600">
                              <div className="font-semibold text-slate-700">
                                Recebido efetivo: R${" "}
                                {formatBRLFromDecimal(Number(p.valorRecebido || 0) + sumMovimentos(p))}
                              </div>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.meioRecebimento || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            {p.status === "PREVISTA" && qtdPrevistas >= 2 ? (
                              <button
                                type="button"
                                onClick={() => openRetificar(p)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                              >
                                Retificar
                              </button>
                            ) : null}

                          </div>
                        </td>
                      </tr>
                    );
                  })}

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

            {/* Totais */}
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
                    totals.diferenca < 0
                      ? "text-red-600"
                      : totals.diferenca > 0
                      ? "text-blue-600"
                      : "text-slate-900"
                  }`}
                >
                  R$ {formatBRLFromDecimal(totals.diferenca)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* =========================
          MODAL: Movimento (contralançamento)
          - ✅ Erros DENTRO do modal
          - ✅ Valor com máscara BRL aprovada
         ========================= */}
      <Modal
        open={movOpen}
        title={`Movimento na Parcela #${movParcela?.numero ?? "—"}`}
        onClose={() => setMovOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMovOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={movSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarMovimento}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={movSaving}
            >
              {movSaving ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {movError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {movError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Tipo</label>
            <select
              value={movTipo}
              onChange={(e) => setMovTipo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="AJUSTE">AJUSTE</option>
              <option value="ESTORNO">ESTORNO</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Sinal</label>
            <select
              value={movSign}
              onChange={(e) => setMovSign(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="-">- (diminuir)</option>
              <option value="+">+ (aumentar)</option>
            </select>
          </div>

          <div>
            {/* ✅ Máscara no padrão */}
            <label className="block text-sm font-semibold text-slate-800 mb-1">Valor (R$)</label>
            <input
              value={maskBRLFromDigits(movValorDigits)}
              onChange={(e) => setMovValorDigits(onlyDigits(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="0,00"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Data (DD/MM/AAAA)</label>
            <input
              value={movData}
              onChange={(e) => setMovData(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="24/12/2025"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Meio</label>
            <select
              value={movMeio}
              onChange={(e) => setMovMeio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="PIX">PIX</option>
              <option value="TED">TED</option>
              <option value="BOLETO">BOLETO</option>
              <option value="CARTAO">CARTÃO</option>
              <option value="DINHEIRO">DINHEIRO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo *</label>
            <input
              value={movMotivo}
              onChange={(e) => setMovMotivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: Valor recebido a maior"
            />
          </div>
        </div>
      </Modal>

      {/* =========================
          MODAL: Transferência (erro de contrato)
          - ✅ Erros DENTRO do modal
          - ✅ Valor com máscara BRL aprovada
         ========================= */}
      <Modal
        open={transfOpen}
        title={`Transferir recebimento da Parcela #${transfParcela?.numero ?? "—"}`}
        onClose={() => setTransfOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setTransfOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={transfSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarTransferencia}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={transfSaving}
            >
              {transfSaving ? "Transferindo..." : "Transferir"}
            </button>
          </>
        }
      >
        {transfError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {transfError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Parcela destino (ID)</label>
            <input
              value={transfDestinoId}
              onChange={(e) => setTransfDestinoId(onlyDigits(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: 999"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Data (DD/MM/AAAA)</label>
            <input
              value={transfData}
              onChange={(e) => setTransfData(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="24/12/2025"
            />
          </div>

          <div>
            {/* ✅ Máscara no padrão */}
            <label className="block text-sm font-semibold text-slate-800 mb-1">Valor (R$)</label>
            <input
              value={maskBRLFromDigits(transfValorDigits)}
              onChange={(e) => setTransfValorDigits(onlyDigits(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="0,00"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Meio</label>
            <select
              value={transfMeio}
              onChange={(e) => setTransfMeio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="PIX">PIX</option>
              <option value="TED">TED</option>
              <option value="BOLETO">BOLETO</option>
              <option value="CARTAO">CARTÃO</option>
              <option value="DINHEIRO">DINHEIRO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo *</label>
            <input
              value={transfMotivo}
              onChange={(e) => setTransfMotivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: Recebimento lançado no contrato errado"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={retOpen}
        title={`Retificar Parcela #${retParcela?.numero ?? "—"}`}
        onClose={() => setRetOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRetOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={retSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarRetificacao}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={retSaving}
            >
              {retSaving ? "Salvando..." : "Retificar"}
            </button>
          </>
        }
      >
        {retError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {retError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Valor previsto (R$)</label>
    
            {/* ✅ máscara padrão adotada */}
            <input
              value={maskBRLFromDigits(retValorDigits)}
              onChange={(e) => setRetValorDigits(onlyDigits(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="0,00"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Senha do admin</label>
            <input
              value={retAdminPassword}
              onChange={(e) => setRetAdminPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="••••••••"
              type="password"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo *</label>
            <input
              value={retMotivo}
              onChange={(e) => setRetMotivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: Valor previsto lançado errado"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
