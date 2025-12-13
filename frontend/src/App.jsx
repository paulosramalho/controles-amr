// ==== ARQUIVO COMPLETO COM DIRETRIZES APLICADAS ====
// (CPF/CNPJ, Datas, Horas, Valores)

import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/logo.png";

/* ================== HELPERS PADRÃO DO PROJETO ================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- CPF / CNPJ ---------- */
function onlyDigits(v = "") {
  return v.replace(/\D/g, "");
}

function formatCpfCnpj(value = "") {
  const d = onlyDigits(value);

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

/* ---------- VALORES (R$) ---------- */
function formatMoneyInput(value = "") {
  const digits = onlyDigits(value);
  const number = Number(digits) / 100;

  if (!digits) return "";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyBRL(value = "") {
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function moneyBRL(value) {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ---------- DATA ---------- */
function formatDateBR(date) {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

/* ---------- HORA ---------- */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    date: now.toLocaleDateString("pt-BR"),
    time: now.toLocaleTimeString("pt-BR"),
  };
}

/* ================== COMPONENTES ================== */

function Input({ label, hint, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700">{label}</span>}
      <input
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
          props.className
        )}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

/* ================== APP ================== */

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const clock = useClock();

  const [form, setForm] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "",
    modeloPagamento: "AVISTA",
    dataInicio: "",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-4 flex items-center gap-3">
        <img src={logoSrc} alt="AMR Advogados" className="h-10 w-auto" />
        <strong>AMR Advogados</strong>
      </header>

      <main className="p-6 max-w-4xl">
        <Input
          label="CPF / CNPJ"
          value={form.cpfCnpj}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              cpfCnpj: formatCpfCnpj(e.target.value),
            }))
          }
          hint="Digite apenas números"
        />

        <Input
          label="Valor total previsto (R$)"
          value={form.valorTotalPrevisto}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              valorTotalPrevisto: formatMoneyInput(e.target.value),
            }))
          }
        />

        <div className="mt-4 text-sm">
          <p>Valor numérico enviado ao backend:</p>
          <strong>{parseMoneyBRL(form.valorTotalPrevisto)}</strong>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          {clock.date} • {clock.time}
        </div>
      </main>
    </div>
  );
}
