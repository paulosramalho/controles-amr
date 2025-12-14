import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/logo.png";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

/* =========================
   DIRETRIZES — HELPERS
========================= */

function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

/** CPF/CNPJ máscara */
function formatCpfCnpj(value = "") {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
      .slice(0, 14);
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
    .slice(0, 18);
}

/** CPF validação */
function isValidCPF(cpf) {
  const c = onlyDigits(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1+$/.test(c)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

/** CNPJ validação */
function isValidCNPJ(cnpj) {
  const c = onlyDigits(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1+$/.test(c)) return false;

  const calc = (base) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c === c.slice(0, 12) + String(d1) + String(d2);
}

function validateCpfCnpj(value = "") {
  const d = onlyDigits(value);
  if (!d) return { ok: false, msg: "Informe CPF/CNPJ" };
  if (d.length <= 11) return isValidCPF(d) ? { ok: true, msg: "" } : { ok: false, msg: "CPF inválido" };
  if (d.length === 14) return isValidCNPJ(d) ? { ok: true, msg: "" } : { ok: false, msg: "CNPJ inválido" };
  return { ok: false, msg: "CPF/CNPJ incompleto" };
}

/** Telefone (BR) — (99) 9 9999-9999 */
function formatTelefoneBR(value = "") {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function validateTelefoneBR(value = "") {
  const d = onlyDigits(value);
  if (!d) return { ok: true, msg: "" }; // opcional por enquanto
  if (d.length !== 11) return { ok: false, msg: "Telefone incompleto" };
  return { ok: true, msg: "" };
}

/** Valores (R$) digitando: 1 -> 0,01 ... */
function formatMoneyTyping(value = "") {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseMoneyBR(value = "") {
  if (!value) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Relógio sidebar: DD/MM/AAAA e HH:MM:SS */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

/* =========================
   UI helpers
========================= */

function Input({ label, hint, error, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        {...props}
        className={[
          "w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none",
          "focus:ring-2 focus:ring-slate-300",
          error ? "border-red-400" : "border-slate-200",
        ].join(" ")}
      />
      {hint && !error && <div className="text-[11px] text-slate-500">{hint}</div>}
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* =========================
   APP
========================= */

export default function App() {
  const clock = useClock();

  // módulo selecionado (por enquanto fixo — depois vira router)
  const moduleName = "Cadastro rápido";

  // form
  const [form, setForm] = useState({
    cpfCnpj: "",
    telefone: "",
    valorTotalPrevisto: "",
  });

  // touched
  const [docTouched, setDocTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const docValidation = useMemo(() => validateCpfCnpj(form.cpfCnpj), [form.cpfCnpj]);
  const docError = docTouched && !docValidation.ok ? docValidation.msg : "";

  const phoneValidation = useMemo(() => validateTelefoneBR(form.telefone), [form.telefone]);
  const phoneError = phoneTouched && !phoneValidation.ok ? phoneValidation.msg : "";

  // backend status
  const [backend, setBackend] = useState({ loading: true, ok: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error("HTTP error");
        await res.json();
        if (alive) setBackend({ loading: false, ok: true });
      } catch {
        if (alive) setBackend({ loading: false, ok: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleSave = async () => {
    setDocTouched(true);
    setPhoneTouched(true);
    setStatusMsg(null);

    if (!docValidation.ok) {
      setStatusMsg({ type: "error", text: "CPF/CNPJ inválido. Corrija para salvar." });
      return;
    }
    if (!phoneValidation.ok) {
      setStatusMsg({ type: "error", text: "Telefone inválido. Corrija para salvar." });
      return;
    }

    const payload = {
      client: {
        cpfCnpj: onlyDigits(form.cpfCnpj),
        telefone: onlyDigits(form.telefone),
      },
      order: {
        valorTotalPrevisto: parseMoneyBR(form.valorTotalPrevisto),
      },
    };

    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao salvar no backend");
      setStatusMsg({ type: "ok", text: "Salvo com sucesso (protótipo)." });
    } catch (e) {
      setStatusMsg({ type: "error", text: e?.message || "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR (fixa e encostada) */}
      <aside className="w-[320px] border-r border-slate-200 bg-white px-6 py-6 flex flex-col">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="AMR Advogados" className="h-12 w-auto object-contain" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">AMR Advogados</div>
            <div className="text-xs text-slate-500">Controles internos</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Operacional
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="font-semibold text-slate-900">• Cadastro rápido</li>
            <li className="text-slate-600">• Listagem (Clientes & Ordens)</li>
            <li className="text-slate-600">• Dashboard financeiro</li>
          </ul>
        </div>

        <div className="mt-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Administrativo
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="text-slate-600">• Modelos de cálculo</li>
            <li className="text-slate-600">• Controle de acesso</li>
            <li className="text-slate-600">• Relatórios (PDF)</li>
          </ul>
        </div>

        {/* Footer sidebar */}
        <div className="mt-auto pt-6 space-y-3">
          <div className="text-xs flex justify-between text-slate-600 font-mono">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

          <div className="text-xs flex justify-between items-center text-slate-700">
            <span>Usuário</span>
            <span className="bg-slate-100 px-2 py-1 rounded-lg">Em desenvolvimento</span>
          </div>

          <button
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
            disabled
          >
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 px-10 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{moduleName}</h1>
            <p className="text-sm text-slate-500">
              Controle de recebimentos, repasses e obrigações internas — AMR Advogados
            </p>
          </div>

          <div className="text-sm">
            <span className="text-slate-600 mr-2">Backend:</span>
            {backend.loading ? (
              <span className="text-slate-500">verificando...</span>
            ) : backend.ok ? (
              <span className="text-emerald-700 font-semibold">ok</span>
            ) : (
              <span className="text-red-700 font-semibold">erro</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl">
          <Card title="Cadastro rápido" subtitle="Cliente + Ordem (base para evolução do módulo)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="CPF / CNPJ"
                placeholder="Digite apenas números"
                value={form.cpfCnpj}
                onChange={(e) => setForm((p) => ({ ...p, cpfCnpj: formatCpfCnpj(e.target.value) }))}
                onBlur={() => setDocTouched(true)}
                error={docError}
                hint={!docError ? "Máscara automática + validação" : undefined}
              />

              <Input
                label="Telefone"
                placeholder="(99) 9 9999-9999"
                value={form.telefone}
                onChange={(e) => setForm((p) => ({ ...p, telefone: formatTelefoneBR(e.target.value) }))}
                onBlur={() => setPhoneTouched(true)}
                error={phoneError}
                hint={!phoneError ? "Máscara automática (11 dígitos)" : undefined}
              />

              <div className="md:col-span-2">
                <Input
                  label="Valor total previsto (R$)"
                  placeholder="0,00"
                  value={form.valorTotalPrevisto}
                  onChange={(e) => setForm((p) => ({ ...p, valorTotalPrevisto: formatMoneyTyping(e.target.value) }))}
                  hint="Digitando: 1→0,01 • 123456→1.234,56"
                />
                <div className="mt-2 text-xs text-slate-500">
                  Valor numérico enviado ao backend:{" "}
                  <span className="font-mono text-slate-700">
                    {parseMoneyBR(form.valorTotalPrevisto) ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={saving}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold",
                  "bg-slate-900 text-white hover:bg-slate-800",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>

              {statusMsg && (
                <div
                  className={[
                    "text-sm",
                    statusMsg.type === "ok" ? "text-emerald-700" : "text-red-700",
                  ].join(" ")}
                >
                  {statusMsg.text}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
