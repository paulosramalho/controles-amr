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

function parseDateDDMMYYYY(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900) return null;
  const dt = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

function addMonthsNoon(ddmmyyyy, months) {
  const base = parseDateDDMMYYYY(ddmmyyyy);
  if (!base) return "";
  const d = new Date(base);
  d.setMonth(d.getMonth() + Number(months || 0));
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  return toDDMMYYYY(out);
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

function onlyDigits(v = "") {
  return String(v ?? "").replace(/\D/g, "");
}

// moeda (máscara tipo centavos):
function maskBRLFromDigits(digits = "") {
  const d = onlyDigits(digits);
  const n = d ? BigInt(d) : 0n;
  const intPart = n / 100n;
  const decPart = n % 100n;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intStr},${decPart.toString().padStart(2, "0")}`;
}

function DateInput({ label, value, onChange, disabled, className = "" }) {
  // value: "DD/MM/AAAA"  |  input[type=date] usa "YYYY-MM-DD"
  const toISO = (ddmmyyyy) => {
    if (!ddmmyyyy) return "";
    const m = String(ddmmyyyy).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  const fromISO = (iso) => {
    if (!iso) return "";
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return "";
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <label className={`block ${className}`}>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        type="date"
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={toISO(value)}
        onChange={(e) => onChange(fromISO(e.target.value))}
        disabled={disabled}
      />
    </label>
  );
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="text-base font-bold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-slate-200">{footer}</div> : null}
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

  // 6.3 — renegociar saldo (modal)
  const [renegOpen, setRenegOpen] = useState(false);
  const [renegSaving, setRenegSaving] = useState(false);
  const [renegError, setRenegError] = useState("");

  const [renegForma, setRenegForma] = useState("AVISTA");
  const [renegAvistaVenc, setRenegAvistaVenc] = useState("");
  const [renegParcelasQtd, setRenegParcelasQtd] = useState("3");
  const [renegParcelasPrimeiroVenc, setRenegParcelasPrimeiroVenc] = useState("");
  const [renegEntradaValorDigits, setRenegEntradaValorDigits] = useState("");
  const [renegEntradaVenc, setRenegEntradaVenc] = useState("");
  const [renegEntradaParcelasQtd, setRenegEntradaParcelasQtd] = useState("3");
  const [renegEntradaParcelasPrimeiroVenc, setRenegEntradaParcelasPrimeiroVenc] = useState("");

  // Admin-only: edição (correção de lançamentos)
  const [editContratoOpen, setEditContratoOpen] = useState(false);
  const [editParcelaOpen, setEditParcelaOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const [editContratoForm, setEditContratoForm] = useState({
    numeroContrato: "",
    valorTotal: "",
    formaPagamento: "AVISTA",
    observacoes: "",
  });

  const [editParcela, setEditParcela] = useState(null);
  const [editParcelaForm, setEditParcelaForm] = useState({
    vencimento: "",
    valorPrevisto: "",
  });

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

  useEffect(() => {
    if (!isAdmin) return;
    loadContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const parcelas = contrato?.parcelas || [];

  const totals = useMemo(() => {
    const ativas = parcelas.filter((p) => p?.status !== "CANCELADA");
    const totalPrevisto = ativas.reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
    const totalRecebido = ativas.reduce((sum, p) => sum + Number(p?.valorRecebido || 0), 0);
    const diferenca = totalRecebido - totalPrevisto;
    return { totalPrevisto, totalRecebido, diferenca };
  }, [parcelas]);

  const saldoPendente = useMemo(() => {
    return (parcelas || [])
      .filter((p) => p?.status === "PREVISTA")
      .reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
  }, [parcelas]);

  const dataBaseDD = useMemo(() => {
    const pend = (parcelas || []).filter((p) => p?.status === "PREVISTA" && p?.vencimento);
    if (!pend.length) return "";
    const min = pend
      .map((p) => new Date(p.vencimento))
      .filter((d) => Number.isFinite(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return min ? toDDMMYYYY(new Date(min.getFullYear(), min.getMonth(), min.getDate(), 12, 0, 0, 0)) : "";
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

  function openEditContrato() {
    if (!contrato) return;
    setAdminPassword("");
    setEditContratoForm({
      numeroContrato: contrato.numeroContrato || "",
      valorTotal: contrato.valorTotal || "",
      formaPagamento: contrato.formaPagamento || "AVISTA",
      observacoes: contrato.observacoes || "",
    });
    setEditContratoOpen(true);
  }

  async function saveEditContrato() {
    try {
      if (!adminPassword) {
        setError("Confirme sua senha de admin para editar.");
        return;
      }
      await apiFetch(`/contratos/${contrato.id}/admin-edit`, {
        method: "PUT",
        body: {
          adminPassword,
          numeroContrato: editContratoForm.numeroContrato,
          valorTotal: editContratoForm.valorTotal,
          formaPagamento: editContratoForm.formaPagamento,
          observacoes: editContratoForm.observacoes,
        },
      });
      setEditContratoOpen(false);
      setAdminPassword("");
      await loadContrato();
    } catch (e) {
      setError(e?.message || "Erro ao editar contrato.");
    }
  }

  function openEditParcela(p) {
    setError("");
    setAdminPassword("");
    setEditParcela(p);
    setEditParcelaForm({
      vencimento: toDDMMYYYY(p?.vencimento),
      valorPrevisto: p?.valorPrevisto ?? "",
    });
    setEditParcelaOpen(true);
  }

  async function saveEditParcela() {
    try {
      if (!editParcela) return;
      if (!adminPassword) {
        setError("Confirme sua senha de admin para editar.");
        return;
      }
      await apiFetch(`/parcelas/${editParcela.id}/admin-edit`, {
        method: "PUT",
        body: {
          adminPassword,
          vencimento: editParcelaForm.vencimento,
          valorPrevisto: editParcelaForm.valorPrevisto,
        },
      });
      setEditParcelaOpen(false);
      setEditParcela(null);
      setAdminPassword("");
      await loadContrato();
    } catch (e) {
      setError(e?.message || "Erro ao editar parcela.");
    }
  }

  function openRenegociar() {
    if (!contrato) return;
    setRenegError("");
    // defaults (dataBase pré-preenchida e editável)
    const base = dataBaseDD || toDDMMYYYY(new Date());
    setRenegForma("AVISTA");
    setRenegAvistaVenc(base);
    setRenegParcelasQtd("3");
    setRenegParcelasPrimeiroVenc(base);
    setRenegEntradaValorDigits("");
    setRenegEntradaVenc(base);
    setRenegEntradaParcelasQtd("3");
    setRenegEntradaParcelasPrimeiroVenc(addMonthsNoon(base, 1) || "");
    setRenegOpen(true);
  }

  function validateReneg() {
    // não faz sentido abrir sem saldo
    if (!saldoPendente || saldoPendente <= 0) return "Não há saldo pendente para renegociar.";

    if (renegForma === "AVISTA") {
      if (!parseDateDDMMYYYY(renegAvistaVenc)) return "Informe um vencimento válido (DD/MM/AAAA) para o à vista.";
    }

    if (renegForma === "PARCELADO") {
      const n = Number(renegParcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas.";
      if (!parseDateDDMMYYYY(renegParcelasPrimeiroVenc)) return "Informe o primeiro vencimento (DD/MM/AAAA).";
    }

    if (renegForma === "ENTRADA_PARCELAS") {
      const entrada = BigInt(onlyDigits(renegEntradaValorDigits) || "0");
      if (entrada <= 0n) return "Informe o valor da entrada.";
      if (!parseDateDDMMYYYY(renegEntradaVenc)) return "Informe o vencimento da entrada (DD/MM/AAAA).";

      const n = Number(renegEntradaParcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas após a entrada.";
      if (!parseDateDDMMYYYY(renegEntradaParcelasPrimeiroVenc)) return "Informe o vencimento da 1ª parcela (DD/MM/AAAA).";
    }

    return null;
  }

  async function salvarRenegociacao() {
    if (!contrato) return;
    const msg = validateReneg();
    if (msg) {
      setRenegError(msg);
      return;
    }

    setRenegSaving(true);
    setRenegError("");
    try {
      const payload = { formaPagamento: renegForma };

      if (renegForma === "AVISTA") {
        payload.avista = { vencimento: renegAvistaVenc };
      }

      if (renegForma === "PARCELADO") {
        payload.parcelas = {
          quantidade: Number(renegParcelasQtd),
          primeiroVencimento: renegParcelasPrimeiroVenc,
        };
      }

      if (renegForma === "ENTRADA_PARCELAS") {
        payload.entrada = { valor: onlyDigits(renegEntradaValorDigits), vencimento: renegEntradaVenc };
        payload.parcelas = {
          quantidade: Number(renegEntradaParcelasQtd),
          primeiroVencimento: renegEntradaParcelasPrimeiroVenc,
        };
      }

      const resp = await apiFetch(`/contratos/${contrato.id}/renegociar`, { method: "POST", body: payload });

      const novoId = resp?.contratoNovo?.id ?? resp?.contratoNovoId ?? resp?.id;
      setRenegOpen(false);
      await loadContrato();

      if (novoId) {
        nav(`/contratos/${novoId}`);
      }
    } catch (e) {
      setRenegError(e?.message || "Falha ao renegociar saldo.");
    } finally {
      setRenegSaving(false);
    }
  }

  const st = contrato ? computeStatusContrato(contrato) : "EM_DIA";
  const stLabel = statusLabel(st);
  const stTone = statusTone(st);

  const podeRenegociar =
    !!contrato &&
    !!contrato.ativo &&
    !contrato.renegociadoParaId &&
    saldoPendente > 0;

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

            {podeRenegociar ? (
              <button
                type="button"
                onClick={openRenegociar}
                className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-70"
                disabled={loading}
                title="Renegociar saldo"
              >
                Renegociar Saldo
              </button>
            ) : null}

            {isAdmin ? (
              <button
                type="button"
                onClick={openEditContrato}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                title="Editar contrato (admin-only)"
              >
                Editar
              </button>
            ) : null}

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

              {contrato?.contratoOrigem ? (
                <div className="md:col-span-3">
                  <div className="text-slate-500">Origem</div>
                  <div className="font-semibold text-slate-900">
                    Originado da renegociação do contrato{" "}
                    <Link className="underline" to={`/contratos/${contrato.contratoOrigem.id}`}>
                      {contrato.contratoOrigem.numeroContrato}
                    </Link>
                  </div>
                </div>
              ) : null}

              {contrato?.renegociadoPara ? (
                <div className="md:col-span-3">
                  <div className="text-slate-500">Renegociação</div>
                  <div className="font-semibold text-slate-900">
                    Ver contrato renegociado:{" "}
                    <Link className="underline" to={`/contratos/${contrato.renegociadoPara.id}`}>
                      {contrato.renegociadoPara.numeroContrato}
                    </Link>
                  </div>
                </div>
              ) : null}

              {contrato.observacoes ? (
                <div className="md:col-span-3">
                  <div className="text-slate-500">Observações</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-800">{contrato.observacoes}</div>
                </div>
              ) : null}
            </div>

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
                    {isAdmin ? <th className="text-left px-4 py-3 font-semibold">Ações</th> : null}
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
                      p.cancelamentoMotivo ||
                      p.motivoCancelamento ||
                      p.cancelMotivo ||
                      p.motivo ||
                      "";

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
                        {isAdmin ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openEditParcela(p)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}

                  {!parcelas.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={isAdmin ? 7 : 6}>
                        Nenhuma parcela cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

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

        {/* 6.3 — Modal Renegociar Saldo */}
        <Modal
          open={renegOpen}
          title={contrato ? `Renegociar saldo — ${contrato.numeroContrato}` : "Renegociar saldo"}
          onClose={() => (!renegSaving ? setRenegOpen(false) : null)}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenegOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                disabled={renegSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarRenegociacao}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-70"
                disabled={renegSaving}
              >
                {renegSaving ? "Renegociando..." : "Confirmar renegociação"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {renegError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{renegError}</div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-600">Saldo pendente</div>
              <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(saldoPendente)}</div>
              {dataBaseDD ? <div className="mt-1 text-xs text-slate-500">Base sugerida: {dataBaseDD}</div> : null}
            </div>

            <label className="block">
              <div className="text-sm font-medium text-slate-700">Forma de pagamento</div>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                value={renegForma}
                onChange={(e) => setRenegForma(e.target.value)}
                disabled={renegSaving}
              >
                <option value="AVISTA">À vista</option>
                <option value="PARCELADO">Parcelado</option>
                <option value="ENTRADA_PARCELAS">Entrada + Parcelas</option>
              </select>
            </label>

            {renegForma === "AVISTA" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DateInput label="Vencimento (à vista)" value={renegAvistaVenc} onChange={setRenegAvistaVenc} disabled={renegSaving} />
              </div>
            ) : null}

            {renegForma === "PARCELADO" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <div className="text-sm font-medium text-slate-700">Quantidade de parcelas</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                    value={renegParcelasQtd}
                    onChange={(e) => setRenegParcelasQtd(onlyDigits(e.target.value))}
                    disabled={renegSaving}
                    inputMode="numeric"
                  />
                </label>
                <DateInput
                  label="1º vencimento"
                  value={renegParcelasPrimeiroVenc}
                  onChange={setRenegParcelasPrimeiroVenc}
                  disabled={renegSaving}
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
                  O backend divide o valor automaticamente e ajusta os centavos.
                </div>
              </div>
            ) : null}

            {renegForma === "ENTRADA_PARCELAS" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block">
                    <div className="text-sm font-medium text-slate-700">Valor Entrada</div>
                    <div className="mt-1 relative">
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                        value={maskBRLFromDigits(renegEntradaValorDigits)}
                        onChange={(e) => setRenegEntradaValorDigits(onlyDigits(e.target.value))}
                        placeholder="0,00"
                        disabled={renegSaving}
                        inputMode="numeric"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
                    </div>
                  </label>

                  <DateInput label="Vencimento Entrada" value={renegEntradaVenc} onChange={setRenegEntradaVenc} disabled={renegSaving} />

                  <DateInput
                    label="Vencimento 1ª Parcela"
                    value={renegEntradaParcelasPrimeiroVenc}
                    onChange={setRenegEntradaParcelasPrimeiroVenc}
                    disabled={renegSaving}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block">
                    <div className="text-sm font-medium text-slate-700">Qtd. parcelas (após entrada)</div>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                      value={renegEntradaParcelasQtd}
                      onChange={(e) => setRenegEntradaParcelasQtd(onlyDigits(e.target.value))}
                      disabled={renegSaving}
                      inputMode="numeric"
                    />
                  </label>
                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
                    A entrada fica como parcela nº 1. O backend divide o restante automaticamente e ajusta os centavos.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>

        {/* Admin-only: Modais de edição */}
        <Modal
          open={editContratoOpen}
          title="Editar contrato (admin-only)"
          onClose={() => {
            setEditContratoOpen(false);
            setAdminPassword("");
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditContratoOpen(false);
                  setAdminPassword("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditContrato}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Salvar
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Senha (admin)</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Digite sua senha para confirmar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Número do contrato</label>
              <input
                value={editContratoForm.numeroContrato}
                onChange={(e) => setEditContratoForm((s) => ({ ...s, numeroContrato: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Valor total (R$)</label>
              <input
                value={editContratoForm.valorTotal}
                onChange={(e) => setEditContratoForm((s) => ({ ...s, valorTotal: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ex.: 1234,56"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Forma de pagamento</label>
              <select
                value={editContratoForm.formaPagamento}
                onChange={(e) => setEditContratoForm((s) => ({ ...s, formaPagamento: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="AVISTA">À vista</option>
                <option value="PARCELADO">Parcelado</option>
                <option value="ENTRADA_PARCELAS">Entrada + Parcelas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
              <textarea
                value={editContratoForm.observacoes}
                onChange={(e) => setEditContratoForm((s) => ({ ...s, observacoes: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[90px]"
              />
            </div>
          </div>
        </Modal>

        <Modal
          open={editParcelaOpen}
          title="Editar parcela (admin-only)"
          onClose={() => {
            setEditParcelaOpen(false);
            setEditParcela(null);
            setAdminPassword("");
          }}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditParcelaOpen(false);
                  setEditParcela(null);
                  setAdminPassword("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditParcela}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Salvar
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Senha (admin)</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Digite sua senha para confirmar"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vencimento (DD/MM/AAAA)</label>
                <input
                  value={editParcelaForm.vencimento}
                  onChange={(e) => setEditParcelaForm((s) => ({ ...s, vencimento: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor previsto (R$)</label>
                <input
                  value={editParcelaForm.valorPrevisto}
                  onChange={(e) => setEditParcelaForm((s) => ({ ...s, valorPrevisto: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ex.: 1234,56"
                />
              </div>
            </div>
          </div>
        </Modal>
      </Card>
    </div>
  );
}
