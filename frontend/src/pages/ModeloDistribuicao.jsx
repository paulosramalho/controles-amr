// src/pages/ModeloDistribuicao.jsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "rounded-xl px-3 py-2 text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 " +
        className
      }
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "rounded-xl px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 " +
        className
      }
    >
      {children}
    </button>
  );
}

function DangerButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "rounded-xl px-3 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-60 " +
        className
      }
    >
      {children}
    </button>
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

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function ModeloDistribuicao() {
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // item ou null
  const [form, setForm] = useState({ cod: "", descricao: "", ativo: true });

  async function load() {
    setError("");
    setLoading(true);
    try {
      // Ajuste aqui se seu backend exigir prefixo /api
      const data = await apiFetch(`/modelo-distribuicao`);
      setItens(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar Modelos de Distribuição.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return itens;
    return itens.filter((x) => {
      const cod = String(x.cod || "").toLowerCase();
      const desc = String(x.descricao || "").toLowerCase();
      return cod.includes(term) || desc.includes(term);
    });
  }, [itens, q]);

  function openCreate() {
    setEditing(null);
    setForm({ cod: "", descricao: "", ativo: true });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      cod: item.cod ?? "",
      descricao: item.descricao ?? "",
      ativo: !!item.ativo,
    });
    setModalOpen(true);
  }

  async function save() {
    setError("");
    const cod = String(form.cod || "").trim();
    const descricao = String(form.descricao || "").trim();

    if (!cod) return setError("Informe o código.");
    if (cod.length > 50) return setError("Código muito longo (máx. 50).");

    setLoading(true);
    try {
      if (editing?.id) {
        await apiFetch(`/modelo-distribuicao/${editing.id}`, {
          method: "PUT",
          body: { cod, descricao, ativo: !!form.ativo },
        });
      } else {
        await apiFetch(`/modelo-distribuicao`, {
          method: "POST",
          body: { cod, descricao, ativo: !!form.ativo },
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(item) {
    setError("");
    setLoading(true);
    try {
      await apiFetch(`/modelo-distribuicao/${item.id}`, {
        method: "PUT",
        body: { ativo: !item.ativo },
      });
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao ativar/desativar.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(item) {
    const ok = window.confirm(`Excluir o modelo "${item.cod}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    setError("");
    setLoading(true);
    try {
      await apiFetch(`/modelo-distribuicao/${item.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e?.message || "Falha ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="p-5 border-b border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold text-slate-900">Modelos de Distribuição</div>
            <div className="text-sm text-slate-600">Cadastro para uso interno (Configurações).</div>
          </div>
          <div className="flex items-center gap-2">
            <PrimaryButton type="button" onClick={openCreate}>
              + Novo
            </PrimaryButton>
            <Button type="button" onClick={load} disabled={loading}>
              Atualizar
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código ou descrição…"
              className="w-full md:max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <div className="text-sm text-slate-600">
              {loading ? "Carregando…" : `${filtered.length} item(ns)`}
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-white text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Código</th>
                  <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filtered.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{x.cod}</td>
                    <td className="px-4 py-3 text-slate-800">{x.descricao || "—"}</td>
                    <td className="px-4 py-3">
                      {x.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="slate">Inativo</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" onClick={() => openEdit(x)}>
                          Editar
                        </Button>
                        <Button type="button" onClick={() => toggleAtivo(x)} disabled={loading}>
                          {x.ativo ? "Desativar" : "Ativar"}
                        </Button>
                        <DangerButton type="button" onClick={() => remove(x)} disabled={loading}>
                          Excluir
                        </DangerButton>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filtered.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Editar Modelo (${editing.cod})` : "Novo Modelo de Distribuição"}
        onClose={() => setModalOpen(false)}
      >
        {error ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Código *</label>
            <input
              value={form.cod}
              onChange={(e) => setForm((s) => ({ ...s, cod: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: MD-001"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Descrição do modelo…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={!!form.ativo}
              onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
            />
            Ativo
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <PrimaryButton type="button" onClick={save} disabled={loading}>
              Salvar
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
