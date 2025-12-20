// src/pages/Pagamentos.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

/* ---------------- helpers ---------------- */
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

function onlyDigits(v = "") {
  return String(v ?? "").replace(/\D/g, "");
}

// moeda (máscara tipo centavos):
// digitando: 1→0,01; 12→0,12; 123→1,23; 1234→12,34; 12345→123,45; 123456→1.234,56
function maskBRLFromDigits(digits = "") {
  const d = onlyDigits(digits);
  const n = d ? BigInt(d) : 0n;
  const intPart = n / 100n;
  const decPart = n % 100n;

  // formata intPart com separador de milhar "."
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
  // valida mês/dia real
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
    slate: "bg-slate-100 text-slate-800 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[tone]}`}>
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

function Input({ label, value, onChange, placeholder, disabled, type = "text" }) {
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

/* ---------------- Page ---------------- */
export default function PagamentosPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  // modal novo contrato
  const [openNovo, setOpenNovo] = useState(false);

  // modal parcelas
  const [openParcelas, setOpenParcelas] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);

  // clientes para select no modal
  const [clientes, setClientes] = useState([]);

  // form contrato
  const [clienteId, setClienteId] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [valorTotalDigits, setValorTotalDigits] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("AVISTA");

  // avista
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

  // confirmar parcela
  const [confirming, setConfirming] = useState(false);
  const [confOpen, setConfOpen] = useState(false);
  const [confParcela, setConfParcela] = useState(null);
  const [confData, setConfData] = useState("");
  const [confMeio, setConfMeio] = useState("PIX");
  const [confValorDigits, setConfValorDigits] = useState(""); // opcional: se vazio, backend assume previsto

  async function load() {
    setError("");
    setLoading(true);
    try {
      const query = q ? `?q=${encodeURIComponent(q)}` : "";
      const data = await apiFetch(`/contratos${query}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar contratos.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClientes() {
    try {
      // sua tela de Clientes usa "/clients". Aqui também.
      const data = await apiFetch("/clients");
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      // silencioso
      setClientes([]);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin]); // eslint-disable-line

useEffect(() => {
  if (!openParcelas || !selectedContrato) return;
  const fresh = rows.find((r) => r.id === selectedContrato.id);
  if (fresh) setSelectedContrato(fresh);
}, [rows, openParcelas, selectedContrato]);

  function resetNovo() {
    setClienteId("");
    setNumeroContrato("");
    setValorTotalDigits("");
    setFormaPagamento("AVISTA");
    setAvistaVenc("");
    setParcelasQtd("3");
    setParcelasPrimeiroVenc("");
    setEntradaValorDigits("");
    setEntradaVenc("");
    setEntradaParcelasQtd("3");
    setEntradaParcelasPrimeiroVenc("");
    setObservacoes("");
  }

  function openNovoContrato() {
    resetNovo();
    setOpenNovo(true);
    loadClientes();
  }

  function openParcelasModal(contrato) {
    setSelectedContrato(contrato);
    setOpenParcelas(true);
  }

  async function toggleContrato(contrato) {
    setError("");
    setLoading(true);
    try {
      await apiFetch(`/contratos/${contrato.id}/toggle`, { method: "PATCH" });
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao ativar/inativar contrato.");
    } finally {
      setLoading(false);
    }
  }

  function validateNovo() {
    if (!clienteId) return "Selecione o cliente.";
    if (!String(numeroContrato || "").trim()) return "Informe o número do contrato.";
    if (!valorTotalDigits) return "Informe o valor total.";

    const total = BigInt(onlyDigits(valorTotalDigits) || "0");
    if (total <= 0n) return "O valor total precisa ser maior que zero.";

    if (formaPagamento === "AVISTA") {
      if (!parseDateDDMMYYYY(avistaVenc)) return "Informe um vencimento válido (DD/MM/AAAA) para o à vista.";
    }

    if (formaPagamento === "PARCELADO") {
      const n = Number(parcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas.";
      if (!parseDateDDMMYYYY(parcelasPrimeiroVenc)) return "Informe o primeiro vencimento (DD/MM/AAAA).";
    }

    if (formaPagamento === "ENTRADA_PARCELAS") {
      const entrada = BigInt(onlyDigits(entradaValorDigits) || "0");
      if (entrada <= 0n) return "Informe o valor da entrada.";
      if (!parseDateDDMMYYYY(entradaVenc)) return "Informe o vencimento da entrada (DD/MM/AAAA).";

      const n = Number(entradaParcelasQtd || 0);
      if (!n || n < 1) return "Informe a quantidade de parcelas após a entrada.";
      if (!parseDateDDMMYYYY(entradaParcelasPrimeiroVenc)) return "Informe o primeiro vencimento das parcelas (DD/MM/AAAA).";

      if (entrada >= total) return "A entrada deve ser menor que o valor total.";
    }

    return null;
  }

  async function salvarContrato() {
    const msg = validateNovo();
    if (msg) {
      setError(msg);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const payload = {
        clienteId: Number(clienteId),
        numeroContrato: String(numeroContrato).trim(),
        valorTotal: onlyDigits(valorTotalDigits), // ✅ centavos (compatível com backend)
        formaPagamento,
        observacoes: observacoes ? String(observacoes).trim() : null,
      };

      if (formaPagamento === "AVISTA") {
        payload.avista = { vencimento: avistaVenc };
      }

      if (formaPagamento === "PARCELADO") {
        payload.parcelas = {
          quantidade: Number(parcelasQtd),
          primeiroVencimento: parcelasPrimeiroVenc,
        };
      }

      if (formaPagamento === "ENTRADA_PARCELAS") {
        payload.entrada = { valor: onlyDigits(entradaValorDigits), vencimento: entradaVenc };
        payload.parcelas = {
          quantidade: Number(entradaParcelasQtd),
          primeiroVencimento: entradaParcelasPrimeiroVenc,
        };
      }

      await apiFetch("/contratos", { method: "POST", body: payload });
      setOpenNovo(false);
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao salvar contrato.");
    } finally {
      setLoading(false);
    }
  }

  function openConfirmParcela(parcela) {
    setConfParcela(parcela);
    setConfData(toDDMMYYYY(new Date())); // default hoje
    setConfMeio("PIX");
    setConfValorDigits(""); // vazio => backend assume previsto
    setConfOpen(true);
  }

  async function confirmarRecebimento() {
    if (!confParcela) return;
    if (!parseDateDDMMYYYY(confData)) {
      setError("Data de recebimento inválida (DD/MM/AAAA).");
      return;
    }

    setError("");
    setConfirming(true);
    try {
      const body = {
        dataRecebimento: confData,
        meioRecebimento: confMeio,
      };
      if (onlyDigits(confValorDigits)) body.valorRecebido = onlyDigits(confValorDigits);

      await apiFetch(`/parcelas/${confParcela.id}/confirmar`, { method: "PATCH", body });
      setConfOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao confirmar recebimento.");
    } finally {
      setConfirming(false);
    }
  }

  const filtered = useMemo(() => {
    // backend já filtra via ?q, então aqui só retorna rows
    return rows;
  }, [rows]);

  // SearchRow padrão
  const searchRow = (
    <div className="flex items-center gap-3">
      <input
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        placeholder="Buscar por contrato, cliente, CPF/CNPJ…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button
        type="button"
        onClick={load}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
        disabled={loading}
      >
        Atualizar
      </button>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xl font-semibold text-slate-900">Pagamentos</div>
          <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title="Pagamentos"
        right={
          <button
            type="button"
            onClick={openNovoContrato}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-70"
            disabled={loading}
          >
            + Novo Contrato
          </button>
        }
      >
        {searchRow}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold min-w-[320px]">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Valor total</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Pendente</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Forma</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Parcelas</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filtered.map((c) => {
                const status = computeStatusContrato(c);
                const qtdParcelas = c?.resumo?.qtdParcelas ?? (c?.parcelas?.length || 0);
                const qtdRecebidas = c?.resumo?.qtdRecebidas ?? (c?.parcelas?.filter((p) => p.status === "RECEBIDA").length || 0);

                const recebidoTotal = (c?.parcelas || []).reduce((acc, p) => acc + (p.status === "RECEBIDA" ? Number(p.valorRecebido || 0) : 0), 0);
                const pendente = Math.max(0, Number(c.valorTotal || 0) - recebidoTotal);

                return (
                  <tr key={c.id} className="bg-white">
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.numeroContrato}</td>
                    <td className="px-4 py-3 text-slate-800">{c?.cliente?.nomeRazaoSocial || "—"}</td>
                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">R$ {formatBRLFromDecimal(c.valorTotal)}</td>
                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">R$ {formatBRLFromDecimal(pendente)}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{normalizeForma(c.formaPagamento)}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {qtdRecebidas}/{qtdParcelas}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openParcelasModal(c)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                          disabled={loading}
                        >
                          Parcelas
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleContrato(c)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                          disabled={loading}
                        >
                          {c?.ativo ? "Inativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={8}>
                    {loading ? "Carregando..." : "Nenhum contrato encontrado."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------- Modal: Novo Contrato ---------- */}
      <Modal
        open={openNovo}
        title="Novo Contrato de Pagamento"
        onClose={() => setOpenNovo(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenNovo(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarContrato}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              disabled={loading}
            >
              Salvar
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Cliente" value={clienteId} onChange={setClienteId} disabled={loading}>
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nomeRazaoSocial}
              </option>
            ))}
          </Select>

          <Input
            label="Número do contrato"
            value={numeroContrato}
            onChange={setNumeroContrato}
            placeholder="Ex.: 2025-000123"
            disabled={loading}
          />

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Valor total</div>
            <div className="mt-1 relative">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                value={maskBRLFromDigits(valorTotalDigits)}
                onChange={(e) => setValorTotalDigits(onlyDigits(e.target.value))}
                placeholder="0,00"
                disabled={loading}
                inputMode="numeric"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Digite normalmente: 1→0,01; 12→0,12; 123→1,23; 123456→1.234,56
            </div>
          </label>

          <Select label="Forma de pagamento" value={formaPagamento} onChange={setFormaPagamento} disabled={loading}>
            <option value="AVISTA">À vista</option>
            <option value="PARCELADO">Parcelado</option>
            <option value="ENTRADA_PARCELAS">Entrada + Parcelas</option>
          </Select>
        </div>

        {/* detalhamento conforme forma */}
        {formaPagamento === "AVISTA" ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateInput
  label="Vencimento (à vista)"
  value={avistaVenc}
  onChange={setAvistaVenc}
  disabled={loading}
/>
          </div>
        ) : null}

        {formaPagamento === "PARCELADO" ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Quantidade de parcelas"
              value={parcelasQtd}
              onChange={(v) => setParcelasQtd(onlyDigits(v))}
              placeholder="Ex.: 6"
              disabled={loading}
              inputMode="numeric"
            />
            <DateInput
  label="1º vencimento"
  value={parcelasPrimeiroVenc}
  onChange={setParcelasPrimeiroVenc}
  disabled={loading}
/>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
              O backend divide o valor automaticamente e ajusta os centavos.
            </div>
          </div>
        ) : null}

        {formaPagamento === "ENTRADA_PARCELAS" ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <div className="text-sm font-medium text-slate-700">Valor da entrada</div>
                <div className="mt-1 relative">
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                    value={maskBRLFromDigits(entradaValorDigits)}
                    onChange={(e) => setEntradaValorDigits(onlyDigits(e.target.value))}
                    placeholder="0,00"
                    disabled={loading}
                    inputMode="numeric"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
                </div>
              </label>

              <DateInput
  label="Vencimento da entrada"
  value={entradaVenc}
  onChange={setEntradaVenc}
  disabled={loading}
/>

<DateInput
  label="1º vencimento (parcelas)"
  value={entradaParcelasPrimeiroVenc}
  onChange={setEntradaParcelasPrimeiroVenc}
  disabled={loading}
/>


              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
                A entrada fica como parcela nº 1.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Qtd. parcelas (após entrada)"
                value={entradaParcelasQtd}
                onChange={(v) => setEntradaParcelasQtd(onlyDigits(v))}
                placeholder="Ex.: 5"
                disabled={loading}
                inputMode="numeric"
              />
              <Input
                label="1º vencimento (parcelas)"
                value={entradaParcelasPrimeiroVenc}
                onChange={setEntradaParcelasPrimeiroVenc}
                placeholder="DD/MM/AAAA"
                disabled={loading}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center">
                O backend divide o restante automaticamente e ajusta os centavos.
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Textarea label="Observações" value={observacoes} onChange={setObservacoes} placeholder="Notas internas…" disabled={loading} />
        </div>
      </Modal>

      {/* ---------- Modal: Parcelas ---------- */}
      <Modal
        open={openParcelas}
        title={
  selectedContrato
    ? `Controle de Parcelas do Contrato ${selectedContrato.numeroContrato} - ${selectedContrato?.cliente?.nomeRazaoSocial || ""}`
    : "Controle de Parcelas"
}
        onClose={() => setOpenParcelas(false)}
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpenParcelas(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        }
      >
        {!selectedContrato ? (
          <div className="text-sm text-slate-600">Selecione um contrato.</div>
        ) : (
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
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(selectedContrato.parcelas || []).map((p) => (
                  <tr key={p.id} className="bg-white">
                    <td className="px-4 py-3 font-semibold text-slate-900">{p.numero}</td>
                    <td className="px-4 py-3 text-slate-800">{toDDMMYYYY(p.vencimento)}</td>
                    <td className="px-4 py-3 text-slate-800">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                    <td className="px-4 py-3">
                      {p.status === "RECEBIDA" ? <Badge tone="green">Recebida</Badge> : p.status === "CANCELADA" ? <Badge tone="red">Cancelada</Badge> : <Badge tone="blue">Prevista</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {p.valorRecebido ? `R$ ${formatBRLFromDecimal(p.valorRecebido)}` : "—"}
                      {p.dataRecebimento ? (
                        <div className="text-xs text-slate-500 mt-1">{toDDMMYYYY(p.dataRecebimento)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.meioRecebimento || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {p.status === "PREVISTA" ? (
                          <button
                            type="button"
                            onClick={() => openConfirmParcela(p)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            Receber Parcela
                          </button>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!(selectedContrato.parcelas || []).length ? (
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
          {(() => {
            const ps = selectedContrato?.parcelas || [];
            const previsto = ps.reduce((acc, p) => acc + (p.status !== "CANCELADA" ? Number(p.valorPrevisto || 0) : 0), 0);
            const recebido = ps.reduce((acc, p) => acc + (p.status === "RECEBIDA" ? Number(p.valorRecebido || 0) : 0), 0);
            const diff = recebido - previsto;
            const diffTone = Math.abs(diff) < 0.005 ? "slate" : diff > 0 ? "blue" : "red";
            return (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600">Previsto</div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">R$ {formatBRLFromDecimal(previsto)}</div>
                  </div>
                  <div className="hidden md:block h-4 w-px bg-slate-300" />
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600">Recebido</div>
                    <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">R$ {formatBRLFromDecimal(recebido)}</div>
                  </div>
                  <div className="hidden md:block h-4 w-px bg-slate-300" />
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-600">Diferença</div>
                    <Badge tone={diffTone}>
                      {diff >= 0 ? "+" : "-"}R$ {formatBRLFromDecimal(Math.abs(diff))}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })()}

        )}
      </Modal>

      {/* ---------- Modal: Confirmar recebimento ---------- */}
      <Modal
        open={confOpen}
        title={confParcela ? `Confirmar recebimento — Parcela #${confParcela.numero}` : "Confirmar recebimento"}
        onClose={() => setConfOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={confirming}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarRecebimento}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
              disabled={confirming}
            >Receber Parcela</button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <DateInput
  label="Data do recebimento"
  value={confData}
  onChange={setConfData}
  disabled={confirming}
/>
          <Select label="Meio" value={confMeio} onChange={setConfMeio} disabled={confirming}>
            <option value="PIX">PIX</option>
            <option value="TED">TED</option>
            <option value="BOLETO">BOLETO</option>
            <option value="CARTAO">CARTÃO</option>
            <option value="DINHEIRO">DINHEIRO</option>
            <option value="OUTRO">OUTRO</option>
          </Select>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Valor recebido (opcional)</div>
            <div className="mt-1 relative">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                value={maskBRLFromDigits(confValorDigits)}
                onChange={(e) => setConfValorDigits(onlyDigits(e.target.value))}
                placeholder="(vazio = valor previsto)"
                disabled={confirming}
                inputMode="numeric"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Se deixar vazio, o sistema confirma pelo valor previsto.
            </div>
          </label>
        </div>
      </Modal>
    </div>
  );
}