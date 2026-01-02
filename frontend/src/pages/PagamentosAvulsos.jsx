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

// percentual do SÓCIO (em bp) do modelo selecionado
const socioBp = useMemo(() => {
  if (!form.modeloDistribuicaoId) return 0;
  const m = modelos.find((x) => String(x.id) === String(form.modeloDistribuicaoId));
  if (!m || !Array.isArray(m.itens)) return 0;

  const itemSocio = m.itens.find((it) => it.destinatario === "SOCIO");
  const bp = itemSocio ? Number(itemSocio.percentualBp) : 0;
  return Number.isFinite(bp) ? bp : 0;
}, [form.modeloDistribuicaoId, modelos]);

// soma dos splits (em bp)
const somaSplitsBp = useMemo(() => {
  if (!form.usaSplitSocio) return 0;

  return (form.splits || []).reduce((acc, s) => {
    if (!s || !s.percentual) return acc;
    const raw = String(s.percentual).replace("%", "").trim().replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    if (!Number.isFinite(n)) return acc;
    return acc + Math.round(n * 100); // % -> bp
  }, 0);
}, [form.splits, form.usaSplitSocio]);

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

  const isoToBR = (iso) => {
    // "2025-12-31" -> "31/12/2025"
    if (!iso || typeof iso !== "string") return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  };

  const brToISO = (br) => {
    // "31/12/2025" -> "2025-12-31"
    if (!br || typeof br !== "string") return "";
    const [d, m, y] = br.split("/");
    if (!y || !m || !d) return "";
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [m, a, c] = await Promise.all([
          apiFetch("/modelo-distribuicao"),
          apiFetch("/advogados"),
          apiFetch("/clients"),
        ]);

        setModelos(m || []);
        setAdvogados(a || []);
        setClientes(c || []);

      } catch (e) {
        console.error(e);
        alert("Erro ao carregar dados de Pagamentos Avulsos.");
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

      if (!form.clienteId) {
        alert("Selecione o Cliente.");
        return;
      }

      const payload = {
        clienteId: Number(form.clienteId),
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

      // (removido) não exibimos "Últimos lançamentos" nesta tela

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
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Pagamentos Avulsos</div>
            <button style={btnSec} type="button" onClick={() => navigate("/pagamentos")}>
              Voltar
            </button>
          </div>
        
          <div style={{ height: 1, background: "#eee", margin: "12px 0" }} />

        <div style={grid}>
          <div>
            <label>Cliente</label>
            <select style={input} value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}>
              <option value="">— Selecione —</option>
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
            <label>Data do recebimento</label>
            <input
              type="date"
              style={input}
              value={brToISO(form.dataRecebimento)}
              onChange={(e) => setForm((f) => ({ ...f, dataRecebimento: isoToBR(e.target.value) }))}
            />
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
                <option key={m.id} value={m.id}>
                 {m.codigo ? `${m.codigo} — ${m.descricao || ""}` : (m.descricao || `Modelo #${m.id}`)}
               </option>
             ))}
            </select>
          </div>

          <div>
            <label>Advogado</label>
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
            <span>split</span>
          </div>
        </div>

        {form.usaSplitSocio && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Splits</strong>
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
        {form.usaSplitSocio && somaSplitsBp > socioBp && (
          <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
            A soma dos splits ({(somaSplitsBp / 100).toFixed(2)}%)
            excede o percentual definido no modelo aplicado({(socioBp / 100).toFixed(2)}%).
          </div>
        )}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            style={{
              ...btn,
              opacity: form.usaSplitSocio && somaSplitsBp > socioBp ? 0.5 : 1,
              cursor: form.usaSplitSocio && somaSplitsBp > socioBp ? "not-allowed" : "pointer",
            }}
            disabled={form.usaSplitSocio && somaSplitsBp > socioBp}
            onClick={onSave}
          >
            Salvar
          </button>

        </div>
      </div>
    </div>
  )
}
