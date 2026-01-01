import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import Can from "../components/Can";
export default function PagamentosAvulsos() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modelos, setModelos] = useState([]);
  const [advogados, setAdvogados] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [lista, setLista] = useState([]);

  const [form, setForm] = useState({
    clienteId: "",
    descricao: "",
    dataRecebimento: "", // DD/MM/AAAA
    valorRecebido: "", // máscara R$
    meioRecebimento: "PIX",
    modeloDistribuicaoId: "",
    advogadoPrincipalId: "",
    usaSplitSocio: false,
    splits: [], // { advogadoId, percentual } em %
  });

  // helpers simples (mantém sua regra de máscara em um único lugar depois)
  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const moneyMask = (value) => {
    const d = onlyDigits(value);
    if (!d) return "";
    const n = Number(d);
    const cents = n / 100;
    return cents.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const percentMask = (value) => {
    // recebe "2000" => "20,00"
    const d = onlyDigits(value);
    if (!d) return "";
    const n = Number(d) / 100;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [m, a, c, l] = await Promise.all([
          apiFetch("/modelos-distribuicao"),
          apiFetch("/advogados"),
          apiFetch("/clientes"),
          apiFetch("/pagamentos-avulsos"),
        ]);
        setModelos(m || []);
        setAdvogados(a || []);
        setClientes(c || []);
        setLista(l || []);
      } catch (e) {
        console.error(e);
        alert("Erro ao carregar Pagamentos Avulsos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const btn = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  };

  const btnSec = {
    ...btn,
    background: "#fff",
    color: "#111",
  };

  const card = {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
  };

  const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
  };

  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

  const addSplit = () => {
    setForm((f) => ({
      ...f,
      splits: [...(f.splits || []), { advogadoId: "", percentual: "" }],
    }));
  };

  const removeSplit = (idx) => {
    setForm((f) => ({
      ...f,
      splits: (f.splits || []).filter((_, i) => i !== idx),
    }));
  };

  const onSave = async () => {
    try {
      setSaving(true);

      const payload = {
        clienteId: form.clienteId ? Number(form.clienteId) : null,
        descricao: String(form.descricao || "").trim(),
        dataRecebimento: form.dataRecebimento, // backend valida DD/MM/AAAA
        valorRecebido: form.valorRecebido, // backend converte
        meioRecebimento: form.meioRecebimento,
        modeloDistribuicaoId: form.modeloDistribuicaoId ? Number(form.modeloDistribuicaoId) : null,
        advogadoPrincipalId: form.advogadoPrincipalId ? Number(form.advogadoPrincipalId) : null,
        usaSplitSocio: !!form.usaSplitSocio,
        splits: (form.splits || []).map((s) => ({
          advogadoId: s.advogadoId ? Number(s.advogadoId) : null,
          percentual: s.percentual, // "20,00"
        })),
      };

      const resp = await apiFetch("/pagamentos-avulsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload, // objeto puro
      });

      setLista((old) => [resp, ...old]);

      // limpa
      setForm({
        clienteId: "",
        descricao: "",
        dataRecebimento: "",
        valorRecebido: "",
        meioRecebimento: "PIX",
        modeloDistribuicaoId: "",
        advogadoPrincipalId: "",
        usaSplitSocio: false,
        splits: [],
      });

      alert("Pagamento avulso salvo.");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao salvar pagamento avulso.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pagamentos Avulsos (sem contrato)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnSec} onClick={() => navigate("/pagamentos")}>Voltar</button>
        </div>
      </div>

      <div style={card}>
        <div style={grid}>
          <div>
            <label>Cliente (opcional)</label>
            <select style={input} value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}>
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nomeRazaoSocial}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Meio</label>
            <select style={input} value={form.meioRecebimento} onChange={(e) => setForm((f) => ({ ...f, meioRecebimento: e.target.value }))}>
              <option value="PIX">PIX</option>
              <option value="TED">TED</option>
              <option value="BOLETO">BOLETO</option>
              <option value="CARTAO">CARTÃO</option>
              <option value="DINHEIRO">DINHEIRO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </div>

          <div>
            <label>Data do recebimento (DD/MM/AAAA)</label>
            <input style={input} value={form.dataRecebimento} onChange={(e) => setForm((f) => ({ ...f, dataRecebimento: e.target.value }))} placeholder="31/12/2025" />
          </div>

          <div>
            <label>Valor recebido (R$)</label>
            <input
              style={input}
              value={form.valorRecebido}
              onChange={(e) => setForm((f) => ({ ...f, valorRecebido: moneyMask(e.target.value) }))}
              placeholder="R$ 0,00"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Descrição</label>
            <input style={input} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Diligência, audiência, parecer, etc." />
          </div>

          <div>
            <label>Modelo de Distribuição</label>
            <select style={input} value={form.modeloDistribuicaoId} onChange={(e) => setForm((f) => ({ ...f, modeloDistribuicaoId: e.target.value }))}>
              <option value="">—</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Advogado Principal</label>
            <select style={input} value={form.advogadoPrincipalId} onChange={(e) => setForm((f) => ({ ...f, advogadoPrincipalId: e.target.value }))}>
              <option value="">—</option>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.usaSplitSocio}
              onChange={(e) => setForm((f) => ({ ...f, usaSplitSocio: e.target.checked }))}
            />
            <span>Usar split do SÓCIO</span>
          </div>
        </div>

        {form.usaSplitSocio && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Splits (sobre a cota do SÓCIO)</strong>
              <button style={btnSec} onClick={addSplit}>+ Adicionar advogado</button>
            </div>

            {(form.splits || []).map((s, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "center" }}>
                <select
                  style={input}
                  value={s.advogadoId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      splits: f.splits.map((x, i) => (i === idx ? { ...x, advogadoId: v } : x)),
                    }));
                  }}
                >
                  <option value="">— advogado —</option>
                  {advogados.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>

                <input
                  style={input}
                  value={s.percentual}
                  onChange={(e) => {
                    const v = percentMask(e.target.value);
                    setForm((f) => ({
                      ...f,
                      splits: f.splits.map((x, i) => (i === idx ? { ...x, percentual: v } : x)),
                    }));
                  }}
                  placeholder="20,00"
                />

                <button style={btnSec} onClick={() => removeSplit(idx)}>Remover</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button style={btn} onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      <div style={card}>
        <strong>Últimos lançamentos</strong>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((p) => (
            <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div><strong>{p.descricao || "—"}</strong></div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {p.dataRecebimento || "—"} • {p.meioRecebimento || "—"}
                  </div>
                </div>
                <div><strong>{p.valorRecebidoFmt || p.valorRecebido || "—"}</strong></div>
              </div>
            </div>
          ))}
          {!lista.length && <div style={{ opacity: 0.7 }}>Sem lançamentos ainda.</div>}
        </div>
      </div>
    </div>
  );
}
