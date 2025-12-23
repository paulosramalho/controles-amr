// src/pages/Contrato.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

/* ---------------- helpers ---------------- */
function onlyDigits(v = "") {
  return String(v ?? "").replace(/\D/g, "");
}

// moeda (máscara tipo centavos)
function maskBRLFromDigits(digits = "") {
  const d = onlyDigits(digits);
  const n = d ? BigInt(d) : 0n;
  const intPart = n / 100n;
  const decPart = n % 100n;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intStr},${decPart.toString().padStart(2, "0")}`;
}

function formatBRLFromDecimal(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function addMonthsLocal(d, months) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function toDateOnly(dateLike) {
  if (!dateLike) return null;
  const x = new Date(dateLike);
  if (!Number.isFinite(x.getTime())) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
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

function computeStatusContrato(contrato) {
  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return "EM_DIA";

  if (contrato?.renegociadoParaId) return "RENEGOCIADO";

  const allCanceladas = parcelas.every((p) => p.status === "CANCELADA");
  if (allCanceladas) return "CANCELADO";

  const allEncerradas = parcelas.every((p) => p.status === "RECEBIDA" || p.status === "CANCELADA");
  if (allEncerradas) return "QUITADO";

  const hasAtrasada = parcelas.some((p) => isParcelaAtrasada(p));
  if (hasAtrasada) return "ATRASADO";

  return "EM_DIA";
}

function normalizeForma(fp) {
  const v = String(fp || "").toUpperCase();
  if (v === "AVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA_PARCELAS") return "Entrada + Parcelas";
  return fp || "—";
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

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" type="button">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-slate-200">{footer}</div> : null}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, disabled, type = "text", inputMode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        type={type}
        inputMode={inputMode}
      />
    </label>
  );
}

function Select({ label, value, onChange, disabled, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <select
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, disabled }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <textarea
        className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

function DateInput({ label, value, onChange, disabled, className = "" }) {
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

/* ---------------- Page ---------------- */
export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState("");

  // modal renegociação
  const [openReneg, setOpenReneg] = useState(false);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  // form renegociação (igual Novo Contrato)
  const [formaPagamento, setFormaPagamento] = useState("AVISTA");

  // à vista
  const [avistaVenc, setAvistaVenc] = useState("");

  // parcelado
  const [parcelasQtd, setParcelasQtd] = useState("3");
  const [parcelasPrimeiroVenc, setParcelasPrimeiroVenc] = useState("");

  // entrada + parcelas
  const [entradaValorDigits, setEntradaValorDigits] = useState("");
  const [entradaVenc, setEntradaVenc] = useState("");
  const [entradaParcelasQtd, setEntradaParcelasQtd] = useState("3");
  const [entradaParcelasPrimeiroVenc, setEntradaParcelasPrimeiroVenc] = useState("");

  const [observacoes, setObservacoes] = useState("");

  async function loadContrato() {
    setError("");
    setLoading(true);
    try {
      const c = await apiFetch(`/contratos/${id}`);
      setContrato(c || null);
    } catch (e1) {
      setError(e1?.message || "Falha ao carregar contrato.");
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

  const saldoPendente = useMemo(() => {
    return parcelas.filter((p) => p.status === "PREVISTA").reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
  }, [parcelas]);

  const saldoPendenteDigits = useMemo(() => {
    // converte decimal (Number) -> cents digits string
    if (!Number.isFinite(saldoPendente) || saldoPendente <= 0) return "";
    const cents = Math.round(saldoPendente * 100);
    return String(cents);
  }, [saldoPendente]);

  const dataBase = useMemo(() => {
    const pend = parcelas.filter((p) => p.status === "PREVISTA" && p.vencimento);
    if (!pend.length) return new Date();
    pend.sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
    const d = new Date(pend[0].vencimento);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [parcelas]);

  const podeRenegociar = !!contrato && contrato.ativo && !contrato.renegociadoParaId && saldoPendente > 0;

  function statusBadgeData() {
    const st = computeStatusContrato(contrato);
    return st === "ATRASADO"
      ? { label: "Atrasado", tone: "red" }
      : st === "QUITADO"
        ? { label: "Quitado", tone: "green" }
        : st === "CANCELADO"
          ? { label: "Cancelado", tone: "slate" }
          : st === "RENEGOCIADO"
            ? { label: "Renegociado", tone: "amber" }
            : { label: "Em dia", tone: "blue" };
  }

  function resetRenegForm() {
    // default pelo dataBase (menor vencimento pendente)
    const db = dataBase || new Date();
    const dbStr = toDDMMYYYY(db);
    const dbPlus1 = toDDMMYYYY(addMonthsLocal(db, 1));

    setFormaPagamento("AVISTA");
    setAvistaVenc(dbStr);

    setParcelasQtd("3");
    setParcelasPrimeiroVenc(dbStr);

    setEntradaValorDigits("");
    setEntradaVenc(dbStr);
    setEntradaParcelasQtd("3");
    setEntradaParcelasPrimeiroVenc(dbPlus1);

    setObservacoes("");
    setModalError("");
  }

  function openRenegModal() {
    resetRenegForm();
    setOpenReneg(true);
  }

  function validateReneg() {
    if (!saldoPendenteDigits) return "Não há saldo pendente para renegociar.";

    if (formaPagamento === "AVISTA") {
      if (!parseDateDDMMYYYY(avistaVenc)) return "Informe um vencimento válido (DD/MM/AAAA) para o à vista.";
    }

    if (formaPagamento === "PARCELADO") {
      const n = Number(parcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas.";
      if (!parseDateDDMMYYYY(parcelasPrimeiroVenc)) return "Informe o vencimento da 1ª parcela (DD/MM/AAAA).";
    }

    if (formaPagamento === "ENTRADA_PARCELAS") {
      const entrada = BigInt(onlyDigits(entradaValorDigits) || "0");
      const total = BigInt(onlyDigits(saldoPendenteDigits) || "0");
      if (entrada <= 0n) return "Informe o valor da entrada.";
      if (!parseDateDDMMYYYY(entradaVenc)) return "Informe o vencimento da entrada (DD/MM/AAAA).";
      const n = Number(entradaParcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas após a entrada.";
      if (!parseDateDDMMYYYY(entradaParcelasPrimeiroVenc)) return "Informe o vencimento da 1ª parcela (DD/MM/AAAA).";
      if (entrada >= total) return "A entrada deve ser menor que o saldo pendente.";
    }

    return null;
  }

  async function salvarRenegociacao() {
    const msg = validateReneg();
    if (msg) {
      setModalError(msg);
      return;
    }
    setModalError("");
    setSaving(true);
    setError("");

    try {
      const payload = {
        formaPagamento,
        observacoes: observacoes ? String(observacoes).trim() : null,
      };

      if (formaPagamento === "AVISTA") {
        payload.avista = { vencimento: avistaVenc };
      }

      if (formaPagamento === "PARCELADO") {
        payload.parcelas = { quantidade: Number(parcelasQtd), primeiroVencimento: parcelasPrimeiroVenc };
      }

      if (formaPagamento === "ENTRADA_PARCELAS") {
        payload.entrada = { valor: onlyDigits(entradaValorDigits), vencimento: entradaVenc };
        payload.parcelas = { quantidade: Number(entradaParcelasQtd), primeiroVencimento: entradaParcelasPrimeiroVenc };
      }

      const resp = await apiFetch(`/contratos/${contrato.id}/renegociar`, { method: "POST", body: payload });

      const novoId = resp?.contratoNovo?.id ?? resp?.contratoNovoId ?? resp?.id;
      if (!novoId) {
        setOpenReneg(false);
        await loadContrato();
        navigate("/pagamentos");
        return;
      }

      setOpenReneg(false);
      navigate(`/contratos/${novoId}`);
    } catch (e) {
      setModalError(e?.message || "Falha ao criar renegociação.");
    } finally {
      setSaving(false);
    }
  }

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

  const status = contrato ? statusBadgeData() : { label: "—", tone: "slate" };

  return (
    <div className="p-6">
      <Card
        title={contrato ? `Contrato ${contrato.numeroContrato}` : "Contrato"}
        right={
          <div className="flex items-center gap-2">
            {podeRenegociar ? (
              <button
                type="button"
                onClick={openRenegModal}
                className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-70"
                disabled={loading}
              >
                Renegociar Saldo
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
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
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
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              </div>

              <div>
                <div className="text-slate-500">Valor total</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(contrato.valorTotal)}</div>
              </div>

              <div>
                <div className="text-slate-500">Saldo pendente</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(saldoPendente)}</div>
              </div>

              <div>
                <div className="text-slate-500">Criado em</div>
                <div className="font-semibold text-slate-900">{toDDMMYYYY(contrato.createdAt)}</div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parcelas.map((p) => {
                    const overdue = isParcelaAtrasada(p);
                    const label =
                      p.status === "RECEBIDA" ? "Recebida" : p.status === "CANCELADA" ? "Cancelada" : overdue ? "Atrasada" : "Prevista";
                    const tone =
                      p.status === "RECEBIDA" ? "green" : p.status === "CANCELADA" ? "slate" : overdue ? "red" : "blue";
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{p.numero}</td>
                        <td className="px-4 py-3 text-slate-800">{toDDMMYYYY(p.vencimento)}</td>
                        <td className="px-4 py-3 text-slate-800">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={tone}>{label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {p.valorRecebido ? `R$ ${formatBRLFromDecimal(p.valorRecebido)}` : "—"}
                          {p.dataRecebimento ? <div className="text-xs text-slate-500 mt-1">{toDDMMYYYY(p.dataRecebimento)}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.meioRecebimento || "—"}</td>
                      </tr>
                    );
                  })}

                  {!parcelas.length ? (
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

      {/* -------- Modal Renegociação (mesmo padrão do Novo Contrato) -------- */}
      <Modal
        open={openReneg}
        title={`Renegociar Saldo — Contrato ${contrato?.numeroContrato || ""}`}
        onClose={() => (!saving ? setOpenReneg(false) : null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenReneg(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarRenegociacao}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Criar Renegociação"}
            </button>
          </div>
        }
      >
        {modalError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cliente" value={contrato?.cliente?.nomeRazaoSocial || "—"} onChange={() => {}} disabled />
          <label className="block">
            <div className="text-sm font-medium text-slate-700">Saldo a renegociar</div>
            <div className="mt-1 relative">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none disabled:bg-slate-50"
                value={maskBRLFromDigits(saldoPendenteDigits)}
                disabled
                readOnly
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
            </div>
          </label>

          <Select label="Forma de pagamento" value={formaPagamento} onChange={setFormaPagamento} disabled={saving}>
            <option value="AVISTA">À vista</option>
            <option value="PARCELADO">Parcelado</option>
            <option value="ENTRADA_PARCELAS">Entrada + Parcelas</option>
          </Select>
        </div>

        {formaPagamento === "AVISTA" ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateInput label="Vencimento (à vista)" value={avistaVenc} onChange={setAvistaVenc} disabled={saving} />
          </div>
        ) : null}

        {formaPagamento === "PARCELADO" ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Quantidade de parcelas"
              value={parcelasQtd}
              onChange={(v) => setParcelasQtd(onlyDigits(v))}
              placeholder="Ex.: 6"
              disabled={saving}
              inputMode="numeric"
            />
            <DateInput label="Vencimento 1ª Parcela" value={parcelasPrimeiroVenc} onChange={setParcelasPrimeiroVenc} disabled={saving} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
              O backend divide o valor automaticamente e ajusta os centavos.
            </div>
          </div>
        ) : null}

        {formaPagamento === "ENTRADA_PARCELAS" ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <div className="text-sm font-medium text-slate-700">Valor Entrada</div>
                <div className="mt-1 relative">
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                    value={maskBRLFromDigits(entradaValorDigits)}
                    onChange={(e) => setEntradaValorDigits(onlyDigits(e.target.value))}
                    placeholder="0,00"
                    disabled={saving}
                    inputMode="numeric"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
                </div>
              </label>

              <DateInput label="Vencimento Entrada" value={entradaVenc} onChange={setEntradaVenc} disabled={saving} />

              <DateInput
                label="Vencimento 1ª Parcela"
                value={entradaParcelasPrimeiroVenc}
                onChange={setEntradaParcelasPrimeiroVenc}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Qtd. parcelas (após entrada)"
                value={entradaParcelasQtd}
                onChange={(v) => setEntradaParcelasQtd(onlyDigits(v))}
                placeholder="Ex.: 5"
                disabled={saving}
                inputMode="numeric"
              />

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
                A entrada fica como parcela nº 1. O backend divide o restante automaticamente e ajusta os centavos.
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Textarea label="Observações" value={observacoes} onChange={setObservacoes} placeholder="Notas internas…" disabled={saving} />
        </div>
      </Modal>
    </div>
  );
}
