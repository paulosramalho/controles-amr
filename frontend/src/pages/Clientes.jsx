// src/pages/Clientes.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { isValidEmail, isValidPhoneBR, maskPhoneBR } from "../lib/validators";

/* ---------- helpers CPF/CNPJ ---------- */
function onlyDigits(v = "") {
  return String(v || "").replace(/\D/g, "");
}

function maskCPF(v = "") {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function maskCNPJ(v = "") {
  const d = onlyDigits(v).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  if (d.length <= 2) return p1;
  if (d.length <= 5) return `${p1}.${p2}`;
  if (d.length <= 8) return `${p1}.${p2}.${p3}`;
  if (d.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
}

function isValidCPF(cpf) {
  const s = onlyDigits(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(s.slice(0, 9), 10);
  const d2 = calc(s.slice(0, 10), 11);
  return d1 === Number(s[9]) && d2 === Number(s[10]);
}

function isValidCNPJ(cnpj) {
  const s = onlyDigits(cnpj);
  if (s.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;

  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(s.slice(0, 12), w1);
  const d2 = calc(s.slice(0, 12) + String(d1), w2);

  return d1 === Number(s[12]) && d2 === Number(s[13]);
}

function maskCpfCnpj(v = "") {
  const d = onlyDigits(v);
  return d.length <= 11 ? maskCPF(d) : maskCNPJ(d);
}

function isValidCpfCnpj(v = "") {
  const d = onlyDigits(v);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

function truncateEnd(text, max = 26) {
  const s = String(text || "");
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)) + "...";
}

/* ---------- UI helpers ---------- */
function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
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
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200">
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

function Input({ label, value, onChange, type = "text", placeholder, disabled }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, disabled, readOnly }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <textarea
        className="mt-1 w-full min-h-[120px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
      />
    </label>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="flex flex-col">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}

/* ---------- Popover (Observações) ---------- */
function Popover({ open, anchorEl, onClose, children }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 360 });

  useEffect(() => {
    if (!open || !anchorEl) return;

    const r = anchorEl.getBoundingClientRect();
    const margin = 8;
    const width = 380;

    let left = r.left;
    let top = r.bottom + margin;

    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;

    // Se estiver perto do rodapé, abre para cima
    const estimatedHeight = 220;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = r.top - margin - estimatedHeight;
      if (top < margin) top = margin;
    }

    setPos({ top, left, width });
  }, [open, anchorEl]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* overlay invisível (fecha clicando fora) */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">{children}</div>
      </div>
    </>
  );
}

export default function ClientesPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xl font-semibold text-slate-900">Clientes</div>
          <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");

  // modal criar/editar
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // modal detalhes (somente leitura)
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  // popover obs
  const [obsOpenId, setObsOpenId] = useState(null);
  const obsBtnRefs = useRef({});

  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/clients");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((c) => {
      const doc = String(c?.cpfCnpj || "");
      const nome = String(c?.nomeRazaoSocial || "");
      const em = String(c?.email || "");
      const tel = String(c?.telefone || "");
      const obs = String(c?.observacoes || "");
      return (
        doc.toLowerCase().includes(term) ||
        maskCpfCnpj(doc).toLowerCase().includes(term) ||
        nome.toLowerCase().includes(term) ||
        em.toLowerCase().includes(term) ||
        maskPhoneBR(tel).toLowerCase().includes(term) ||
        obs.toLowerCase().includes(term)
      );
    });
  }, [rows, q]);

  function resetForm() {
    setCpfCnpj("");
    setNomeRazaoSocial("");
    setEmail("");
    setTelefone("");
    setObservacoes("");
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setCpfCnpj(maskCpfCnpj(c?.cpfCnpj || ""));
    setNomeRazaoSocial(c?.nomeRazaoSocial || "");
    setEmail(c?.email || "");
    setTelefone(c?.telefone ? maskPhoneBR(c.telefone) : "");
    setObservacoes(c?.observacoes || "");
    setOpen(true);
  }

  function openView(c) {
    setViewing(c);
    setViewOpen(true);
  }

  function validate() {
    if (!cpfCnpj) return "Informe CPF ou CNPJ.";
    if (!isValidCpfCnpj(cpfCnpj)) return "CPF/CNPJ inválido.";

    if (!nomeRazaoSocial.trim()) return "Informe Nome/Razão Social.";

    if (email && !isValidEmail(String(email).trim().toLowerCase())) return "E-mail inválido.";
    if (telefone && !isValidPhoneBR(telefone)) return "Telefone inválido.";

    return null;
  }

  async function save() {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setError("");
    setLoading(true);

    const payload = {
      cpfCnpj: onlyDigits(cpfCnpj),
      nomeRazaoSocial: nomeRazaoSocial.trim(),
      email: email ? String(email).trim().toLowerCase() : null,
      telefone: telefone ? onlyDigits(telefone) : null,
      observacoes: observacoes ? String(observacoes).trim() : null,
    };

    try {
      if (!editing) {
        await apiFetch("/clients", { method: "POST", body: payload });
      } else {
        await apiFetch(`/clients/${editing.id}`, { method: "PUT", body: payload });
      }

      setOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao salvar cliente.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(c) {
    setError("");
    setLoading(true);
    try {
      await apiFetch(`/clients/${c.id}/toggle`, { method: "PATCH" });
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao ativar/inativar.");
    } finally {
      setLoading(false);
    }
  }

  const searchRow = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail, CPF/CNPJ" />
          <button
            onClick={load}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            Atualizar
          </button>
        </div>
  );

  return (
    <div className="p-6">
      <Card
        title="Clientes"
        right={
          // ✅ "+ Novo Cliente" no header
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-70"
            disabled={loading}
          >
            + Novo Cliente
          </button>
        }
      >
        {/* ✅ Buscar + Atualizar no topo do corpo */}
        {searchRow}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
  <tr>
    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">CPF/CNPJ</th>

    {/* ✅ Nome ganha largura */}
    <th className="text-left px-4 py-3 font-semibold min-w-[420px]">Nome/Razão Social</th>

    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Telefone</th>
    <th className="text-left px-4 py-3 font-semibold">E-mail</th>

    {/* ✅ Obs. mínima */}
    <th className="text-center px-2 py-3 font-semibold w-[64px]">Obs.</th>

    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Status</th>
    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Ações</th>
  </tr>
</thead>

            <tbody className="divide-y divide-slate-200">
              {filtered.map((c) => {
                const obs = String(c?.observacoes || "").trim();
                const hasObs = Boolean(obs);
                const isObsOpen = obsOpenId === c.id;

                return (
                  <tr key={c.id} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {maskCpfCnpj(c?.cpfCnpj || "") || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
  <button
    type="button"
    onClick={() => openView(c)}
    className="text-left font-semibold text-slate-900 hover:underline"
    title="Ver detalhes"
  >
    {c?.nomeRazaoSocial || "—"}
  </button>
</td>

                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {c?.telefone ? maskPhoneBR(c.telefone) : "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">{c?.email || "—"}</td>

                    {/* ✅ Observações com popover */}
                    <td className="px-2 py-3 text-center">
  {hasObs ? (
    <>
      <button
        type="button"
        ref={(el) => (obsBtnRefs.current[c.id] = el)}
        onClick={() => setObsOpenId((id) => (id === c.id ? null : c.id))}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white w-9 h-8 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        title="Ver observações"
      >
        📝
      </button>

      <Popover
        open={isObsOpen}
        anchorEl={obsBtnRefs.current[c.id]}
        onClose={() => setObsOpenId(null)}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Observações</div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            onClick={() => setObsOpenId(null)}
            title="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap text-left">{obs}</div>
      </Popover>
    </>
  ) : (
    <span className="text-slate-400">—</span>
  )}
</td>

                    <td className="px-4 py-3">
                      {c?.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                          disabled={loading}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAtivo(c)}
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
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>
                    {loading ? "Carregando..." : "Nenhum cliente encontrado."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal criar/editar */}
      <Modal
        open={open}
        title={editing ? "Editar Cliente" : "Novo Cliente"}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              disabled={loading}
            >
              Salvar
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="CPF/CNPJ"
            value={cpfCnpj}
            onChange={(v) => setCpfCnpj(maskCpfCnpj(v))}
            placeholder="CPF (11) ou CNPJ (14)"
            disabled={loading}
          />
          <Input
            label="Nome/Razão Social"
            value={nomeRazaoSocial}
            onChange={setNomeRazaoSocial}
            placeholder="Ex.: Fulano de Tal / Empresa X Ltda."
            disabled={loading}
          />
          <Input
            label="Telefone"
            value={telefone}
            onChange={(v) => setTelefone(maskPhoneBR(v))}
            placeholder="(99) 9 9999-9999"
            disabled={loading}
          />
          <Input
            label="E-mail"
            value={email}
            onChange={setEmail}
            placeholder="ex.: cliente@empresa.com"
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <Textarea
            label="Observações"
            value={observacoes}
            onChange={setObservacoes}
            placeholder="Notas internas…"
            disabled={loading}
          />
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {cpfCnpj
            ? isValidCpfCnpj(cpfCnpj)
              ? "Documento OK."
              : "Documento inválido (verifique CPF/CNPJ)."
            : "Informe CPF/CNPJ para validar."}
        </div>
      </Modal>

      {/* Modal detalhes (somente leitura) */}
      <Modal
        open={viewOpen}
        title="Detalhes do Cliente"
        onClose={() => setViewOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setViewOpen(false);
                if (viewing) openEdit(viewing);
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setViewOpen(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoLine label="CPF/CNPJ" value={maskCpfCnpj(viewing?.cpfCnpj || "")} />
          <InfoLine label="Status" value={viewing?.ativo ? "Ativo" : "Inativo"} />
          <InfoLine label="Nome/Razão Social" value={viewing?.nomeRazaoSocial || "—"} />
          <InfoLine label="E-mail" value={viewing?.email || "—"} />
          <InfoLine label="Telefone" value={viewing?.telefone ? maskPhoneBR(viewing.telefone) : "—"} />
          <InfoLine label="ID" value={viewing?.id ? String(viewing.id) : "—"} />
        </div>

        <div className="mt-4">
          <Textarea
            label="Observações"
            value={String(viewing?.observacoes || "")}
            onChange={() => {}}
            readOnly
            placeholder="—"
          />
        </div>
      </Modal>
    </div>
  );
}
