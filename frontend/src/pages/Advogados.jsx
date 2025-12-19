// src/pages/Advogados.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  isValidEmail,
  isValidPhoneBR,
  maskPhoneBR,
} from "../lib/validators";

/* ---------- UI helpers simples ---------- */
function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children, hint, error }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500 " +
        (props.className || "")
      }
    />
  );
}

function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-800 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- USER: Meu Perfil Profissional ---------- */
function MeuPerfilProfissional({ user }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", chavePix: "", senha: "" });

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const a = await apiFetch("/advogados/me", { method: "GET" }); // ✅ backend
      setPerfil(a);
      setForm({
  nome: row.nome || "",
  cpf: row.cpf || "",
  oab: row.oab || "",
  email: row.email || "",
  telefone: row.telefone || "",
  senha: "",
  confirmarSenha: "",
  chavePix: row.chavePix || "",
});

    } catch (e) {
      setErr(e?.message || "Falha ao carregar seu perfil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    if (!String(form.nome).trim()) return "Informe seu nome.";
    if (!isValidEmail(form.email)) return "Informe um e-mail válido.";
    if (!isValidPhoneBR(form.telefone)) return "Telefone inválido (use 11 dígitos).";
    if (form.senha && String(form.senha).trim().length < 8) return "Nova senha deve ter no mínimo 8 caracteres.";
    return "";
  }

  async function salvar() {
    setErr("");
    setOk("");
    const v = validate();
    if (v) return setErr(v);

    try {
      await apiFetch("/advogados/me", {
        method: "PUT",
        body: {
          nome: String(form.nome).trim(),
          email: String(form.email).trim(),
          telefone: form.telefone,
          chavePix: String(form.chavePix || "").trim() || null,
          ...(form.senha ? { senha: form.senha } : {}),
        },
      });
      setOk("Atualizado com sucesso.");
      setForm((p) => ({ ...p, senha: "" }));
      await load();
    } catch (e) {
      setErr(e?.message || "Falha ao salvar.");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card
        title="Meu Perfil Profissional"
        subtitle="Atualize seus dados (nome, e-mail, telefone, chave Pix e senha)."
        right={
          <Badge tone="slate">
            {String(user?.role || "").toUpperCase()}
          </Badge>
        }
      >
        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{err}</div>
        ) : null}
        {ok ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 text-green-700 px-4 py-3 text-sm">{ok}</div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Carregando…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome completo">
                <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
              </Field>

              <Field label="E-mail (login)">
                <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </Field>

              <Field label="Telefone/WhatsApp" hint="Formato: (99) 9 9999-9999">
                <Input
                  value={form.telefone}
                  inputMode="numeric"
                  onChange={(e) => setForm((p) => ({ ...p, telefone: maskPhoneBR(e.target.value) }))}
                />
              </Field>

              <Field label="Chave Pix">
                <Input value={form.chavePix} onChange={(e) => setForm((p) => ({ ...p, chavePix: e.target.value }))} />
              </Field>

              <Field label="Trocar senha" hint="Deixe em branco para manter a senha atual. Mínimo 8 caracteres.">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.senha}
                  onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                />
              </Field>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <div><b>CPF:</b> {perfil?.cpf || "—"}</div>
                  <div><b>OAB:</b> {perfil?.oab || "—"}</div>
                  <div><b>Status:</b> {perfil?.ativo ? <Badge tone="green">ATIVO</Badge> : <Badge tone="red">INATIVO</Badge>}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={load}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
              >
                Recarregar
              </button>
              <button
                onClick={salvar}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition"
              >
                Salvar
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------- ADMIN: lista + create + edit + status ---------- */
function AdvogadosAdmin() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const empty = { nome: "", cpf: "", oab: "", email: "", telefone: "", senha: "", chavePix: "", confirmarSenha: "" };
  const [form, setForm] = useState(empty);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.nome} ${r.email} ${r.cpf} ${r.oab}`.toLowerCase().includes(s));
  }, [q, rows]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch("/advogados", { method: "GET" }); // ✅ admin only
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar advogados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setFormErr("");
    setOpenForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      nome: row.nome || "",
      cpf: row.cpf || "",
      oab: row.oab || "",
      email: row.email || "",
      telefone: row.telefone || "",
      senha: "",
      chavePix: row.chavePix || "",
    });
    setFormErr("");
    setOpenForm(true);
  }

  function validate(isCreate) {
    if (!String(form.nome).trim()) return "Informe o nome.";
    if (!String(form.email).trim()) return "Informe o e-mail.";
    if (isCreate && !String(form.senha).trim()) return "Informe a senha inicial.";
    if (form.senha && String(form.senha).trim().length < 8) return "Senha deve ter no mínimo 8 caracteres.";
    return "";
  }

  async function save() {
  if (saving) return;
  setFormErr("");
  const v = validate(!editing);
  if (v) return setFormErr(v);

  setSaving(true);
  try {
    if (!editing) {
      await apiFetch("/advogados", {
        method: "POST",
        body: {
          nome: String(form.nome).trim(),
          cpf: form.cpf,
          oab: form.oab,
          email: String(form.email).trim(),
          telefone: form.telefone || "",
          chavePix: String(form.chavePix || "").trim() || null,
          senha: form.senha,
        },
      });
    } else {
      const payload = {
        nome: String(form.nome).trim(),
        email: String(form.email).trim(),
        telefone: form.telefone || "",
        chavePix: String(form.chavePix || "").trim() || null,
      };

      // só manda senha se digitou (e manda confirmação)
      if (String(form.senha || "").trim()) {
        payload.senha = form.senha;
        payload.confirmarSenha = form.confirmarSenha;
      }

      await apiFetch(`/advogados/${editing.id}`, {
        method: "PUT",
        body: payload,
      });

      // limpa campos de senha após salvar edição
      setForm((p) => ({ ...p, senha: "", confirmarSenha: "" }));
    }

    setOpenForm(false);
    await load();
  } catch (e) {
    setFormErr(e?.message || "Falha ao salvar.");
  } finally {
    setSaving(false);
  }
}

  async function toggleAtivo(row) {
    const novo = !row.ativo;
    const ok = confirm(`${novo ? "Ativar" : "Inativar"} o advogado "${row.nome}"?`);
    if (!ok) return;

    try {
      await apiFetch(`/advogados/${row.id}/status`, {
        method: "PATCH",
        body: { ativo: novo },
      });
      await load();
    } catch (e) {
      alert(e?.message || "Falha ao atualizar status.");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card
        title="Advogados"
        subtitle="Admin: cadastro, edição e ativação/inativação."
        right={
          <button
            onClick={openCreate}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition"
          >
            + Novo advogado
          </button>
        }
      >
        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{err}</div>
        ) : null}

        <div className="flex items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail, CPF ou OAB…" />
          <button
            onClick={load}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            Atualizar
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">Nome</th>
                <th className="text-left px-4 py-3 font-semibold">CPF</th>
                <th className="text-left px-4 py-3 font-semibold">OAB</th>
                <th className="text-left px-4 py-3 font-semibold">E-mail</th>
                <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                <th className="text-left px-4 py-3 font-semibold">Chave Pix</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={9}>Carregando…</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{r.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.nome}</td>
                    <td className="px-4 py-3">{r.cpf || "—"}</td>
                    <td className="px-4 py-3">{r.oab || "—"}</td>
                    <td className="px-4 py-3">{r.email || "—"}</td>
                    <td className="px-4 py-3">{r.telefone || "—"}</td>
                    <td className="px-4 py-3">{r.chavePix || "—"}</td>
                    <td className="px-4 py-3">
                      {r.ativo ? <Badge tone="green">ATIVO</Badge> : <Badge tone="red">INATIVO</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleAtivo(r)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
                        >
                          {r.ativo ? "Inativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={9}>Nenhum advogado encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* modal simples */}
        {openForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => (saving ? null : setOpenForm(false))} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">
                  {editing ? "Editar advogado" : "Novo advogado"}
                </div>
                <button
                  onClick={() => (saving ? null : setOpenForm(false))}
                  className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <div className="p-5">
                {formErr ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                    {formErr}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome completo">
                    <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
                  </Field>

                  <Field label="E-mail (login)">
                    <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                  </Field>

                  <Field label="Telefone/WhatsApp">
                    <Input
                      value={form.telefone}
                      inputMode="numeric"
                      onChange={(e) => setForm((p) => ({ ...p, telefone: maskPhoneBR(e.target.value) }))}
                    />
                  </Field>

                  <Field label="Chave Pix">
                    <Input value={form.chavePix} onChange={(e) => setForm((p) => ({ ...p, chavePix: e.target.value }))} />
                  </Field>

                  <Field label="CPF" hint="Obrigatório no cadastro">
                    <Input
                      value={form.cpf}
                      onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
                      disabled={!!editing}
                    />
                  </Field>

                  <Field label="OAB" hint="Obrigatória no cadastro">
                    <Input
                      value={form.oab}
                      onChange={(e) => setForm((p) => ({ ...p, oab: e.target.value }))}
                      disabled={!!editing}
                    />
                  </Field>

                  <Field label="Senha" hint={editing ? "Preencha para trocar." : "Senha inicial (mín. 8)."}>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.senha}
                      onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                    />
                  </Field>

                  <Field label="Confirmar senha">
                    <Input
                      type="password"
                      value={form.confirmarSenha}
                      onChange={(e) =>
                      setForm((p) => ({ ...p, confirmarSenha: e.target.value }))
                     }
                    />
                  </Field>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setOpenForm(false)}
                    disabled={saving}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition disabled:opacity-70"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-70"
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/* ---------- EXPORT PRINCIPAL ---------- */
export default function AdvogadosPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  // ✅ User não vê tabela (evita 403 no GET /advogados)
  return isAdmin ? <AdvogadosAdmin /> : <MeuPerfilProfissional user={user} />;
}
