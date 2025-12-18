// frontend/src/pages/Configuracoes/Advogados/AdvogadosPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import AdvogadoView from "./AdvogadoView";
import { formatCPF, formatPhoneBR, isValidCPF, isValidOAB } from "./validators";

/**
 * Configurações > Advogados
 * - ADMIN: cria, edita, ativa/desativa (soft delete), vê todos.
 * - USER: vê apenas o próprio registro (vinculado a Usuario.advogadoId) e edita campos permitidos:
 *   nome, email, telefone, chavePix e senha (senha via endpoint de troca, quando backend estiver pronto).
 *
 * IMPORTANTE: este componente assume que o backend terá endpoints:
 *  - GET    /advogados                  (ADMIN) lista
 *  - POST   /advogados                  (ADMIN) cria
 *  - PUT    /advogados/:id              (ADMIN) edita
 *  - PATCH  /advogados/:id/status       (ADMIN) { ativo: boolean }
 *  - GET    /advogados/me               (USER/ADMIN) meu cadastro (via req.user.advogadoId)
 *  - PUT    /advogados/me               (USER) edita campos permitidos
 *
 * Se algum endpoint ainda não existir, a tela acusa de forma amigável.
 */

const EMPTY_FORM = {
  id: null,
  nome: "",
  cpf: "",
  oab: "",
  email: "",
  telefone: "",
  chavePix: "",
  ativo: true,
};

export default function AdvogadosPage({ auth }) {
  const role = auth?.user?.role || "USER";
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [me, setMe] = useState(null);

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [openView, setOpenView] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await apiFetch("/advogados", { method: "GET" });
        setItems(Array.isArray(data) ? data : data.items || []);
      } else {
        const data = await apiFetch("/advogados/me", { method: "GET" });
        setMe(data);
      }
    } catch (e) {
      setErr(e?.message || "Erro ao carregar Advogados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const src = isAdmin ? items : (me ? [me] : []);
    const needle = q.trim().toLowerCase();
    return src.filter((it) => {
      if (!showInactive && it.ativo === false) return false;
      if (!needle) return true;
      return (
        String(it.nome || "").toLowerCase().includes(needle) ||
        String(it.email || "").toLowerCase().includes(needle) ||
        String(it.cpf || "").includes(needle) ||
        String(it.oab || "").toLowerCase().includes(needle)
      );
    });
  }, [items, me, q, showInactive, isAdmin]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormErr("");
    setModalOpen(true);
  }

  function openEdit(it) {
    setForm({
      id: it.id,
      nome: it.nome || "",
      cpf: it.cpf || "",
      oab: it.oab || "",
      email: it.email || "",
      telefone: it.telefone || "",
      chavePix: it.chavePix || "",
      ativo: it.ativo !== false,
    });
    setFormErr("");
    setModalOpen(true);
  }

  async function toggleAtivo(it) {
    if (!isAdmin) return;
    const novo = !(it.ativo !== false);
    const ok = window.confirm(novo ? "Reativar este advogado?" : "Desativar este advogado? (soft delete)");
    if (!ok) return;
    try {
      await apiFetch(`/advogados/${it.id}/status`, { method: "PATCH", body: { ativo: novo } });
      await load();
    } catch (e) {
      alert(e?.message || "Falha ao alterar status");
    }
  }

  function validateForm(payload) {
    const errors = [];
    if (!payload.nome || payload.nome.trim().length < 3) errors.push("Nome completo é obrigatório.");
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.push("E-mail inválido.");
    if (isAdmin) {
      if (!payload.cpf || !isValidCPF(payload.cpf)) errors.push("CPF inválido.");
      if (!payload.oab || !isValidOAB(payload.oab)) errors.push("OAB inválida.");
      if (!payload.telefone || payload.telefone.replace(/\D/g, "").length < 10) errors.push("Telefone/WhatsApp inválido.");
    } else {
      // USER não altera CPF/OAB
      if (payload.telefone && payload.telefone.replace(/\D/g, "").length > 0 && payload.telefone.replace(/\D/g, "").length < 10) {
        errors.push("Telefone/WhatsApp inválido.");
      }
    }
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    setFormErr("");
    setSaving(true);

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone,
      chavePix: form.chavePix?.trim() || null,
    };

    if (isAdmin) {
      payload.cpf = form.cpf;
      payload.oab = form.oab.trim().toUpperCase();
      payload.ativo = !!form.ativo;
    }

    const errors = validateForm(payload);
    if (errors.length) {
      setSaving(false);
      setFormErr(errors.join(" "));
      return;
    }

    try {
      if (isAdmin) {
        if (form.id) {
          await apiFetch(`/advogados/${form.id}`, { method: "PUT", body: payload });
        } else {
          // senha inicial opcional (se backend aceitar). Mantemos fora por segurança.
          await apiFetch(`/advogados`, { method: "POST", body: payload });
        }
      } else {
        await apiFetch(`/advogados/me`, { method: "PUT", body: payload });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setFormErr(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Configurações · Advogados</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isAdmin ? "Admin: gestão completa (criar, editar, ativar/desativar)." : "Usuário: seus dados e segurança."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, e-mail, CPF, OAB..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-300 sm:w-80"
            />
          </div>

          {isAdmin ? (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mostrar inativos
            </label>
          ) : null}

          {isAdmin ? (
            <button onClick={openCreate} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Novo advogado
            </button>
          ) : (
            <button onClick={() => openEdit(me)} disabled={!me} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              Editar meus dados
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando…</div>
      ) : err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <div className="font-semibold">Não foi possível carregar Advogados</div>
          <div className="mt-1 opacity-90">{err}</div>
          <div className="mt-3">
            <button className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600" onClick={load}>
              Tentar novamente
            </button>
          </div>
          <div className="mt-4 text-xs text-rose-900/70">
            Dica: se o backend ainda não tiver os endpoints /advogados, este erro é esperado.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-slate-600">
                  <Th>ID</Th>
                  <Th>Nome</Th>
                  <Th>CPF</Th>
                  <Th>OAB</Th>
                  <Th>E-mail</Th>
                  <Th>Telefone</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      Nenhum registro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <Td className="text-slate-500">{it.id}</Td>
                      <Td className="font-medium text-slate-900">{it.nome}</Td>
                      <Td className="font-mono text-slate-700">{it.cpf}</Td>
                      <Td className="font-mono text-slate-700">{it.oab}</Td>
                      <Td className="text-slate-700">{it.email}</Td>
                      <Td className="text-slate-700">{it.telefone || "—"}</Td>
                      <Td>
                        <StatusBadge ativo={it.ativo !== false} />
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => setOpenView(it)}
                          >
                            Ver
                          </button>

                          {isAdmin ? (
                            <>
                              <button
                                className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                onClick={() => openEdit(it)}
                              >
                                Editar
                              </button>
                              <button
                                className="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                                onClick={() => toggleAtivo(it)}
                              >
                                {it.ativo !== false ? "Desativar" : "Reativar"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen ? (
        <Modal title={isAdmin ? (form.id ? "Editar advogado" : "Novo advogado") : "Editar meus dados"} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            {formErr ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{formErr}</div> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
                <input
                  value={form.nome}
                  onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                  placeholder="Nome completo"
                />
              </Field>

              <Field label="E-mail (login)">
                <input
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                  placeholder="email@exemplo.com"
                  inputMode="email"
                />
              </Field>

              <Field label="Telefone/WhatsApp">
                <input
                  value={form.telefone}
                  onChange={(e) => setForm((s) => ({ ...s, telefone: formatPhoneBR(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                  placeholder="(99) 9 9999-9999"
                  inputMode="tel"
                />
              </Field>

              <Field label="Chave Pix">
                <input
                  value={form.chavePix}
                  onChange={(e) => setForm((s) => ({ ...s, chavePix: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                  placeholder="CPF / CNPJ / e-mail / telefone / aleatória"
                />
              </Field>

              {isAdmin ? (
                <>
                  <Field label="CPF">
                    <input
                      value={form.cpf}
                      onChange={(e) => setForm((s) => ({ ...s, cpf: formatCPF(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                    {form.cpf && !isValidCPF(form.cpf) ? <Hint>CPF inválido.</Hint> : null}
                  </Field>

                  <Field label="OAB">
                    <input
                      value={form.oab}
                      onChange={(e) => setForm((s) => ({ ...s, oab: e.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-300"
                      placeholder="12345/PA"
                    />
                    {form.oab && !isValidOAB(form.oab) ? <Hint>OAB inválida.</Hint> : null}
                  </Field>

                  <Field label="Ativo">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!form.ativo}
                        onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Ativo
                    </label>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="CPF">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{me?.cpf || "—"}</div>
                  </Field>
                  <Field label="OAB">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{me?.oab || "—"}</div>
                  </Field>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>

            {!isAdmin ? (
              <div className="pt-2 text-xs text-slate-500">
                Troca de senha: vamos ligar no backend no próximo passo (endpoint dedicado), para manter segurança.
              </div>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {openView ? <AdvogadoView item={openView} onClose={() => setOpenView(null)} /> : null}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</td>;
}

function StatusBadge({ ativo }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200",
      ].join(" ")}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Fechar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </label>
  );
}

function Hint({ children }) {
  return <div className="mt-1 text-xs text-rose-700">{children}</div>;
}
