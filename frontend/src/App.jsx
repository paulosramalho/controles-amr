// ⚠️ ARQUIVO COMPLETO – SUBSTITUIR INTEGRALMENTE

import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/logo.png";

/* =========================
   HELPERS — DIRETRIZES
========================= */

const onlyDigits = (v = "") => String(v).replace(/\D/g, "");

function formatTelefone(value = "") {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/* === CPF / CNPJ === */

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

/* === Datas === */

function formatDateBR(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/* === Valores === */

function formatMoneyTyping(value = "") {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyBRL(v = "") {
  if (!v) return null;
  return Number(v.replace(/\./g, "").replace(",", "."));
}

/* === Hora === */

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

/* =========================
   APP
========================= */

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const clock = useClock();

  const [form, setForm] = useState({
    cpfCnpj: "",
    telefone: "",
    valor: "",
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR */}
      <aside className="w-[300px] bg-white border-r p-4 flex flex-col">
        <img src={logoSrc} alt="AMR Advogados" className="h-10 mb-6 object-contain" />

        <div className="mt-auto text-xs text-slate-600 font-mono flex justify-between">
          <span>{clock.date}</span>
          <span>{clock.time}</span>
        </div>

        <div className="mt-3 text-xs flex justify-between items-center">
          <span>Usuário</span>
          <span className="bg-slate-100 px-2 py-1 rounded">Em desenvolvimento</span>
        </div>

        <button
          disabled
          className="mt-3 w-full border rounded px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
        >
          Sair
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-6">
        <h1 className="text-xl font-semibold mb-4">Cadastro rápido</h1>

        <div className="max-w-xl space-y-4 bg-white p-6 rounded-xl border">
          <div>
            <label className="text-xs font-medium">CPF / CNPJ</label>
            <input
              value={form.cpfCnpj}
              onChange={(e) =>
                setForm((p) => ({ ...p, cpfCnpj: formatCpfCnpj(e.target.value) }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) =>
                setForm((p) => ({ ...p, telefone: formatTelefone(e.target.value) }))
              }
              placeholder="(99) 9 9999-9999"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Valor (R$)</label>
            <input
              value={form.valor}
              onChange={(e) =>
                setForm((p) => ({ ...p, valor: formatMoneyTyping(e.target.value) }))
              }
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs mt-1 text-slate-500">
              Valor enviado ao backend: {parseMoneyBRL(form.valor) ?? "—"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
