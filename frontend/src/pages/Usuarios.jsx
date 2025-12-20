// src/pages/Usuarios.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { isValidEmail, isValidPhoneBR, maskPhoneBR } from "../lib/validators";

/* ---------- CPF helpers (front) ---------- */
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

/* ---------- UI helpers ---------- */
function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
        {right}
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

function Input({ label, value, onChange, type = "text", placeholder, disabled, hint, error }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <input
        className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:bg-slate-50
          ${error ? "border-red-300 focus:ring-red-100" : "border-slate-300 focus:ring-slate-200"}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error ? (
        <div className="mt-1 text-xs text-red-700">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-slate-500">{hint}</div>
      ) : null}
    </label>
  );
}

function Select({ label, value, onChange, options, disabled, hint }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <select
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </label>
  );
}

export default function UsuariosPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-lg font-semibold text-slate-900">Usuários</div>
          <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // busca + atualizar
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState("USUARIO");
  const [role, setRole] = useState("USER");
  const [advogadoId, setAdvogadoId] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");

  // validação “na hora”
  const [cpfLiveError, setCpfLiveError] = useState("");
  const [cpfTouched, setCpfTouched] = useState(false);

  const tipoOptions = useMemo(
    () => [
      { value: "ADVOGADO", label: "Advogado" },
      { value: "USUARIO", label: "Usuário" },
      { value: "ESTAGIARIO", label: "Estagiário" },
    ],
    []
  );

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/usuarios");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar usuários.");
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

    const termDigits = onlyDigits(term);

    return rows.filter((u) => {
      const nomeL = String(u?.nome || "").toLowerCase();
      const emailL = String(u?.email || "").toLowerCase();
      const cpfD = onlyDigits(u?.cpf || "");
      const telD = onlyDigits(u?.telefone || "");
      const tipoL = String(u?.tipoUsuario || "").toLowerCase();

      return (
        nomeL.includes(term) ||
        emailL.includes(term) ||
        tipoL.includes(term) ||
        (termDigits && (cpfD.includes(termDigits) || telD.includes(termDigits)))
      );
    });
  }, [rows, q]);

  function resetForm() {
    setNome("");
    setEmail("");
    setTelefone("");
    setCpf("");
    setTipoUsuario("USUARIO");
    setRole("USER");
    setAdvogadoId("");
    setSenha("");
    setSenhaConfirmacao("");
    setCpfLiveError("");
    setCpfTouched(false);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setNome(u?.nome || "");
    setEmail(u?.email || "");
    setTelefone(u?.telefone ? maskPhoneBR(u.telefone) : "");
    setCpf(u?.cpf ? maskCPF(u.cpf) : "");
    setTipoUsuario(u?.tipoUsuario || "USUARIO");
    setRole(u?.role || "USER");
    setAdvogadoId(u?.advogadoId ? String(u.advogadoId) : "");
    setSenha("");
    setSenhaConfirmacao("");
    setCpfLiveError("");
    setCpfTouched(false);
    setOpen(true);
  }

  function validate() {
    const emailNorm = String(email || "").trim().toLowerCase();
    if (!nome.trim()) return "Informe o nome.";
    if (!isValidEmail(emailNorm)) return "E-mail inválido.";
    if (telefone && !isValidPhoneBR(telefone)) return "Telefone inválido.";

    if (tipoUsuario === "USUARIO" || tipoUsuario === "ESTAGIARIO") {
      if (!cpf) return "CPF é obrigatório para Usuário/Estagiário.";
      if (!isValidCPF(cpf)) return "CPF inválido.";
    } else {
      if (cpf && !isValidCPF(cpf)) return "CPF inválido.";
    }

    if (tipoUsuario === "ADVOGADO") {
      if (!advogadoId) return "Para tipo Advogado, informe o ID do Advogado (vinculação).";
    }

    if (!editing) {
      if (!senha || senha.length < 8) return "Senha obrigatória (mínimo 8 caracteres).";
      if (senha !== senhaConfirmacao) return "As senhas não conferem.";
    } else {
      if (senha || senhaConfirmacao) {
        if (!senha || senha.length < 8) return "Nova senha deve ter no mínimo 8 caracteres.";
        if (senha !== senhaConfirmacao) return "As senhas não conferem.";
      }
    }

    return null;
  }

  function handleCpfChange(v) {
    const masked = maskCPF(v);
    setCpf(masked);

    const d = onlyDigits(masked);
    if (!d) {
      setCpfLiveError("");
      return;
    }
    if (d.length === 11 && !isValidCPF(masked)) setCpfLiveError("CPF inválido.");
    else setCpfLiveError("");
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
      nome: nome.trim(),
      email: String(email).trim().toLowerCase(),
      telefone: telefone ? onlyDigits(telefone) : null,
      cpf: cpf ? onlyDigits(cpf) : null,
      tipoUsuario,
      role,
      advogadoId: advogadoId ? Number(advogadoId) : null,
      ...(senha ? { senha, senhaConfirmacao } : {}),
    };

    try {
      if (!editing) {
        await apiFetch("/usuarios", { method: "POST", body: payload });
      } else {
        await apiFetch(`/usuarios/${editing.id}`, { method: "PUT", body: payload });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(u) {
    setError("");
    setLoading(true);
    try {
      await apiFetch(`/usuarios/${u.id}/ativo`, {
        method: "PATCH",
        body: { ativo: !u.ativo },
      });
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao alterar status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <Card
        title="Usuários"
        subtitle={null}
        right={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-70"
            disabled={loading}
          >
            + Novo usuário
          </button>
        }
      >
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* ✅ buscar + atualizar no topo (igual Advogados) */}
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail, CPF ou telefone…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
          <button
            onClick={load}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition disabled:opacity-70"
            disabled={loading}
            title="Atualizar"
          >
            Atualizar
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {/* ✅ ordem pedida */}
                <th className="text-left font-semibold px-4 py-3">Nome</th>
                <th className="text-left font-semibold px-4 py-3">CPF</th>
                <th className="text-left font-semibold px-4 py-3">Telefone</th>
                <th className="text-left font-semibold px-4 py-3">E-mail</th>
                <th className="text-left font-semibold px-4 py-3">Tipo</th>
                <th className="text-left font-semibold px-4 py-3">Perfil</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={8}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={8}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.nome}</td>
                    <td className="px-4 py-3 text-slate-700">{u.cpf ? maskCPF(u.cpf) : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{u.telefone ? maskPhoneBR(u.telefone) : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.tipoUsuario === "ADVOGADO" ? "blue" : u.tipoUsuario === "ESTAGIARIO" ? "amber" : "slate"}>
                        {u.tipoUsuario || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "ADMIN" ? "blue" : "slate"}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">{u.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAtivo(u)}
                          className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                            u.ativo
                              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {u.ativo ? "Inativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        title={editing ? "Editar usuário" : "Novo usuário"}
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
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-70"
              disabled={loading}
            >
              Salvar
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome completo" value={nome} onChange={setNome} />
          <Input label="E-mail (login)" value={email} onChange={setEmail} />

          <Input
            label="Telefone/WhatsApp"
            value={telefone}
            onChange={(v) => setTelefone(maskPhoneBR(v))}
            placeholder="(99) 9 9999-9999"
          />

          <Input
            label="CPF (obrigatório p/ Usuário/Estagiário)"
            value={cpf}
            onChange={handleCpfChange}
            placeholder="999.999.999-99"
            error={
              cpfLiveError ||
              (cpfTouched && (tipoUsuario === "USUARIO" || tipoUsuario === "ESTAGIARIO") && !cpf ? "CPF é obrigatório." : "")
            }
            hint="O sistema valida o CPF automaticamente ao completar 11 dígitos."
          />

          <Select
            label="Tipo de usuário"
            value={tipoUsuario}
            onChange={(v) => {
              setTipoUsuario(v);
              const d = onlyDigits(cpf);
              if ((v === "USUARIO" || v === "ESTAGIARIO") && d.length === 11 && !isValidCPF(cpf)) setCpfLiveError("CPF inválido.");
              else setCpfLiveError("");
            }}
            options={tipoOptions}
          />

          <Select
            label="Perfil (role)"
            value={role}
            onChange={setRole}
            options={[
              { value: "USER", label: "USER" },
              { value: "ADMIN", label: "ADMIN" },
            ]}
          />

          <Input
            label="Advogado ID (se tipo = Advogado)"
            value={advogadoId}
            onChange={(v) => setAdvogadoId(onlyDigits(v))}
            placeholder="Ex.: 12"
            disabled={tipoUsuario !== "ADVOGADO"}
            hint={tipoUsuario === "ADVOGADO" ? "Vincule ao registro existente em Advogados." : ""}
          />

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <b>Regras:</b> CPF é obrigatório para <b>Usuário</b> e <b>Estagiário</b>. Para <b>Advogado</b>, informe o <b>ID do Advogado</b> para vincular.
          </div>

          <Input label={editing ? "Nova senha (opcional)" : "Senha"} value={senha} onChange={setSenha} type="password" />
          <Input
            label={editing ? "Confirmar nova senha" : "Confirmar senha"}
            value={senhaConfirmacao}
            onChange={setSenhaConfirmacao}
            type="password"
          />
        </div>

        <div className="mt-4">
          <button type="button" onClick={() => setCpfTouched(true)} className="hidden" aria-hidden="true">
            _
          </button>
        </div>
      </Modal>
    </div>
  );
}
