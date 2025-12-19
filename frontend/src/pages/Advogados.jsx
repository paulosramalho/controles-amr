// src/pages/Advogados.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { isValidEmail, isValidPhoneBR, maskPhoneBR } from "../lib/validators";

/* ---------- logo (se existir) ---------- */
let logoSrc = null;
try {
  logoSrc = new URL("../assets/logo.png", import.meta.url).href;
} catch {
  logoSrc = null;
}

/* ---------- helpers CPF (máscara + validação) ---------- */
function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

function maskCPF(v = "") {
  const d = onlyDigits(v).slice(0, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 11);
  if (d.length <= 3) return a;
  if (d.length <= 6) return `${a}.${b}`;
  if (d.length <= 9) return `${a}.${b}.${c}`;
  return `${a}.${b}.${c}-${e}`;
}

function isValidCPF(v = "") {
  const cpf = onlyDigits(v);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/* ---------- UI helpers simples ---------- */
function Card({ title, subtitle, children, right, titleClassName = "" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className={"font-semibold text-slate-900 " + titleClassName}>{title}</div>
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

/* ---------- PDF (print-friendly) ---------- */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openPdfWindow({ advogado }) {
  const nomeAdv = advogado?.nome ? String(advogado.nome).trim() : "Advogado";
  const cpf = advogado?.cpf ? maskCPF(advogado.cpf) : "—";
  const chavePix = advogado?.chavePix || "—";

  // título/“nome sugerido” do PDF
  const titulo = `Dados para Pix - ${nomeAdv}`;

  const html = `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    *{ box-sizing:border-box; font-family: Arial, Helvetica, sans-serif; }
    body{ margin:0; padding:32px; color:#0f172a; background:#fff; }
    .wrap{ max-width:720px; margin:0 auto; }

    /* header centralizado */
    .header{ text-align:center; padding-bottom:18px; border-bottom:1px solid #e2e8f0; margin-bottom:20px; }
    .brandRow{
      display:flex; align-items:center; justify-content:center; gap:14px;
      margin-bottom:10px;
    }
    .logo{ width:58px; height:58px; object-fit:contain; }
    .brandNameTop{ font-size:18px; font-weight:800; letter-spacing:.2px; }

    .line1{ font-size:16px; font-weight:800; margin:0; }
    .line2{ font-size:12px; color:#475569; margin:6px 0 0; font-weight:700; }

    /* box */
    .box{ border:1px solid #e2e8f0; border-radius:14px; padding:16px; background:#f8fafc; }
    .row{ display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #e2e8f0; }
    .row:last-child{ border-bottom:none; }
    .k{ width:150px; font-size:12px; color:#475569; font-weight:800; }
    .v{ flex:1; font-size:13px; color:#0f172a; word-break:break-word; }

    /* actions */
    .actions{ margin-top:18px; display:flex; justify-content:center; gap:10px; }
    .btn{
      border:1px solid #cbd5e1; background:#0f172a; color:#fff;
      padding:10px 14px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;
    }
    .btn.secondary{ background:#fff; color:#0f172a; }
    .foot{ margin-top:14px; font-size:11px; color:#64748b; text-align:center; }

    @media print {
      body{ padding:18px; }
      .actions{ display:none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brandRow">
  ${
    logoSrc
      ? `<img class="logo" src="${logoSrc}" alt="Logo" />`
      : `<div style="width:158px;height:158px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:900;">AMR</div>`
  }
</div>

      <p class="line1">Amanda Maia Ramalho Advogados</p>
      <p class="line2">OAB: 1025/17</p>
    </div>

    <div class="box">
      <div class="row">
        <div class="k">Nome completo</div>
        <div class="v">${escapeHtml(nomeAdv)}</div>
      </div>
      <div class="row">
        <div class="k">CPF</div>
        <div class="v">${escapeHtml(cpf)}</div>
      </div>
      <div class="row">
        <div class="k">Chave Pix</div>
        <div class="v">${escapeHtml(chavePix)}</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn" onclick="window.print()">Salvar como PDF</button>
      <button class="btn secondary" onclick="window.close()">Fechar</button>
    </div>

    <div class="foot">Documento gerado pelo sistema Controles-AMR.</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ---------- USER: Meu Perfil Profissional ---------- */
function MeuPerfilProfissional({ user }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [perfil, setPerfil] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    chavePix: "",
    senha: "",
    confirmarSenha: "",
  });

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const a = await apiFetch("/advogados/me", { method: "GET" });
      setPerfil(a);
      setForm({
        nome: a?.nome || "",
        email: a?.email || "",
        telefone: a?.telefone ? maskPhoneBR(a.telefone) : "",
        chavePix: a?.chavePix || "",
        senha: "",
        confirmarSenha: "",
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

    if (String(form.senha || "").trim()) {
      if (String(form.senha).trim().length < 8) return "Nova senha deve ter no mínimo 8 caracteres.";
      if (String(form.confirmarSenha || "") !== String(form.senha || "")) return "As senhas não conferem.";
    }
    return "";
  }

  async function salvar() {
    if (saving) return;
    setErr("");
    setOk("");
    const v = validate();
    if (v) return setErr(v);

    setSaving(true);
    try {
      const payload = {
        nome: String(form.nome).trim(),
        email: String(form.email).trim(),
        telefone: form.telefone,
        chavePix: String(form.chavePix || "").trim() || null,
      };

      if (String(form.senha || "").trim()) {
        payload.senha = form.senha;
        payload.confirmarSenha = form.confirmarSenha;
      }

      await apiFetch("/advogados/me", { method: "PUT", body: payload });
      setOk("Atualizado com sucesso.");
      await load();
    } catch (e) {
      setErr(e?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card
        title="Meu Perfil Profissional"
        subtitle="Atualize seus dados (nome, e-mail, telefone, chave Pix e senha)."
        right={<Badge tone="slate">{String(user?.role || "").toUpperCase()}</Badge>}
        titleClassName="text-xl"
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

              <Field label="Confirmar senha">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmarSenha}
                  onChange={(e) => setForm((p) => ({ ...p, confirmarSenha: e.target.value }))}
                />
              </Field>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <div>
                    <b>CPF:</b> {perfil?.cpf ? maskCPF(perfil.cpf) : "—"}
                  </div>
                  <div>
                    <b>OAB:</b> {perfil?.oab || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <b>Status:</b> {perfil?.ativo ? <Badge tone="green">ATIVO</Badge> : <Badge tone="red">INATIVO</Badge>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={load}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition disabled:opacity-70"
              >
                Recarregar
              </button>
              <button
                onClick={salvar}
                disabled={saving}
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-70"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------- ADMIN: lista + create + edit + status + view ---------- */
function AdvogadosAdmin() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [openView, setOpenView] = useState(false);
  const [viewing, setViewing] = useState(null);

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
      const data = await apiFetch("/advogados", { method: "GET" }); // admin only
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
      cpf: row.cpf ? maskCPF(row.cpf) : "",
      oab: row.oab || "",
      email: row.email || "",
      telefone: row.telefone ? maskPhoneBR(row.telefone) : "",
      senha: "",
      confirmarSenha: "",
      chavePix: row.chavePix || "",
    });
    setFormErr("");
    setOpenForm(true);
  }

  function openDetails(row) {
    setViewing(row);
    setOpenView(true);
  }

  function validate(isCreate) {
    if (!String(form.nome).trim()) return "Informe o nome.";
    if (!isValidEmail(form.email)) return "Informe um e-mail válido.";
    if (!isValidPhoneBR(form.telefone)) return "Telefone inválido (use 11 dígitos).";

    if (isCreate) {
      if (!onlyDigits(form.cpf)) return "Informe o CPF.";
      if (!isValidCPF(form.cpf)) return "CPF inválido.";
      if (!String(form.oab).trim()) return "Informe a OAB.";
      if (!String(form.senha).trim()) return "Informe a senha inicial.";
    }

    if (String(form.senha || "").trim()) {
      if (String(form.senha).trim().length < 8) return "Senha deve ter no mínimo 8 caracteres.";
      if (String(form.confirmarSenha || "") !== String(form.senha || "")) return "As senhas não conferem.";
    }

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
            cpf: form.cpf, // pode ir mascarado; backend limpa
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

        if (String(form.senha || "").trim()) {
          payload.senha = form.senha;
          payload.confirmarSenha = form.confirmarSenha;
        }

        await apiFetch(`/advogados/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
      }

      setOpenForm(false);
      setForm(empty);
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
        subtitle={null /* suprimido */}
        titleClassName="text-xl"
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
                <th className="text-left px-4 py-3 font-semibold">OAB</th>
                <th className="text-left px-4 py-3 font-semibold">Nome completo</th>
                <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                <th className="text-left px-4 py-3 font-semibold">E-mail</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={6}>
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{r.oab || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetails(r)}
                        className="font-semibold text-slate-900 hover:underline"
                        title="Ver detalhes"
                      >
                        {r.nome || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3">{r.telefone ? maskPhoneBR(r.telefone) : "—"}</td>
                    <td className="px-4 py-3">{r.email || "—"}</td>
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
                  <td className="px-4 py-4 text-slate-600" colSpan={6}>
                    Nenhum advogado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* modal simples (create/edit) */}
        {openForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => (saving ? null : setOpenForm(false))} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">{editing ? "Editar advogado" : "Novo advogado"}</div>
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

                  <Field label="CPF" hint="Obrigatório no cadastro">
                    <Input
                      value={form.cpf}
                      onChange={(e) => setForm((p) => ({ ...p, cpf: maskCPF(e.target.value) }))}
                      disabled={!!editing}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                    />
                  </Field>

                  <Field label="OAB" hint="Obrigatória no cadastro">
                    <Input value={form.oab} onChange={(e) => setForm((p) => ({ ...p, oab: e.target.value }))} disabled={!!editing} />
                  </Field>

                  <Field label="Senha" hint={editing ? "Preencha para trocar." : "Senha inicial (mín. 8)."}>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.senha}
                      onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                    />
                  </Field>

                  <Field label="Confirmar senha" hint={editing ? "Obrigatório se trocar a senha." : "Confirme a senha inicial."}>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.confirmarSenha}
                      onChange={(e) => setForm((p) => ({ ...p, confirmarSenha: e.target.value }))}
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

        {/* modal detalhes (view) */}
        {openView && viewing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpenView(false)} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-900 truncate">{viewing.nome}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {viewing.ativo ? <Badge tone="green">ATIVO</Badge> : <Badge tone="red">INATIVO</Badge>}
                    <span className="text-xs text-slate-500">OAB: {viewing.oab || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* PDF */}
                  <button
                    type="button"
                    onClick={() => openPdfWindow({ advogado: viewing })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
                    title="Gerar PDF"
                  >
                    📄 PDF
                  </button>
                  {/* Editar */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenView(false);
                      openEdit(viewing);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
                    title="Editar"
                  >
                    Editar
                  </button>
                  {/* Fechar */}
                  <button
                    onClick={() => setOpenView(false)}
                    className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Nome completo</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.nome || "—"}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">OAB</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.oab || "—"}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">CPF</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.cpf ? maskCPF(viewing.cpf) : "—"}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-600">Telefone</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.telefone ? maskPhoneBR(viewing.telefone) : "—"}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                    <div className="text-xs font-semibold text-slate-600">E-mail</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.email || "—"}</div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                    <div className="text-xs font-semibold text-slate-600">Chave Pix</div>
                    <div className="mt-1 text-sm text-slate-900 break-words">{viewing.chavePix || "—"}</div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setOpenView(false)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
                  >
                    Fechar
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
  return isAdmin ? <AdvogadosAdmin /> : <MeuPerfilProfissional user={user} />;
}
