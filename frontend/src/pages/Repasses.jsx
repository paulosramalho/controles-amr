// src/pages/Repasses.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

function monthOptions() {
  return [
    { v: 1, t: "Jan" }, { v: 2, t: "Fev" }, { v: 3, t: "Mar" }, { v: 4, t: "Abr" },
    { v: 5, t: "Mai" }, { v: 6, t: "Jun" }, { v: 7, t: "Jul" }, { v: 8, t: "Ago" },
    { v: 9, t: "Set" }, { v: 10, t: "Out" }, { v: 11, t: "Nov" }, { v: 12, t: "Dez" },
  ];
}

export default function RepassesPage({ user }) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1); // competência (M+1)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Debug visual (produção): ative com ?dbg=1 na URL
  const dbgEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("dbg");

  const [dbgOpen, setDbgOpen] = useState(false);
  const [dbgInfo, setDbgInfo] = useState(null);


  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch(`/repasses/previa?ano=${ano}&mes=${mes}`);
      setData(res);
    } catch (e) {
      setErr(e?.message || "Erro ao carregar prévia.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ano, mes]);

  const advogadoCols = useMemo(() => {
    if (!data?.linhas?.length) return [];
    const map = new Map();
    for (const l of data.linhas) {
      for (const a of l.advogados || []) map.set(a.advogadoId, a.nome);
    }
    return [...map.entries()].map(([id, nome]) => ({ id, nome }));
  }, [data]);

  const totalsRow = useMemo(() => {
    if (!data?.totais) return null;

    const advTot = new Map((data.totais.advogados || []).map((a) => [a.advogadoId, a.valor]));
    return {
      valor: data.totais.valor,
      imposto: data.totais.imposto,
      liquido: data.totais.liquido,
      escritorio: data.totais.escritorio,
      fundoReserva: data.totais.fundoReserva,
      advTot,
    };
  }, [data]);

  return (
    <div style={{ padding: 16 }}>
      <div style={card}>

        {/* HEADER */}
        <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: "22px" }}>Repasses</h2>

          {/* Direita: Competência + Alíquota (badge) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {/* Competência (select + ano) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ opacity: 0.8 }}>Competência:</span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#f8fafc",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ border: "none", background: "transparent" }}>
                  {monthOptions().map((m) => (
                    <option key={m.v} value={m.v}>{m.t}</option>
                  ))}
                </select>

                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  style={{ width: 84, border: "none", background: "transparent", fontWeight: 600 }}
                />
              </span>
            </div>

            {/* Alíquota (badge) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.8, fontWeight: 600 }}>Alíquota</span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#f1f5f9",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {(() => {
                  const compMes = mes;
                  const compAno = ano;
                  const mesBase = compMes === 1 ? 12 : compMes - 1;
                  const anoBase = compMes === 1 ? compAno - 1 : compAno;
    
                  const aliqBp = data?.aliquotaUsada?.percentualBp;
                  const aliqTxt = (Number(aliqBp || 0) / 100).toFixed(2) + "%";

                  const mRef = data?.aliquotaUsada?.mes ?? mesBase;
                  const aRef = data?.aliquotaUsada?.ano ?? anoBase;

                  return `${aliqTxt} — ${mRef}/${aRef}`;
                })()}
              </span>
            </div>
          </div>

        </div>

        {/* erro dentro do card */}
        {err && (
          <div style={{ margin: "0 12px 12px", padding: 10, background: "#fee", border: "1px solid #f99", borderRadius: 8 }}>
            {err}
          </div>
        )}
        <div style={{ padding: "0 12px 12px" }}>
        {loading && <div>Carregando…</div>}

        {!loading && data?.linhas && (
          <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
              <thead>
                <tr style={{ background: "#f6f6f6" }}>
                  <th style={th}>Contrato</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Valor</th>
                  <th style={th}>Alíquota</th>
                  <th style={th}>Imposto</th>
                  <th style={th}>Líquido</th>
                  {advogadoCols.map((c) => (
                    <th key={c.id} style={th}>{c.nome}</th>
                  ))}
                  <th style={th}>Escritório</th>
                  <th style={th}>Fundo Reserva</th>
                  <th style={th}>Pendências</th>
                </tr>
              </thead>

              <tbody>
                {data.linhas.map((l) => {
  const statusRaw = l.parcelaStatus || l.status;
  const vencRaw = l.vencimento || l.parcelaVencimento || l.dataVencimento || l.vencimentoFmt;

  // ANTES (dados que entram na comparação)
  const s = String(statusRaw || "").trim().toUpperCase();
  const dt = parseBRDate(vencRaw);

  let today = null;
  let vencLTtoday = null;
  if (dt) {
    today = new Date();
    today.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    vencLTtoday = dt < today;
  }

  // DEPOIS (resultado da comparação)
  const bg = rowBgByStatus(statusRaw, vencRaw);

  const dbgPayload = {
    antes: {
      parcelaId: l.parcelaId,
      statusRaw,
      statusNorm: s,
      vencRaw,
      vencParsed: dt ? dt.toISOString().slice(0, 10) : null,
      today: today ? today.toISOString().slice(0, 10) : null,
      vencMenorQueHoje: vencLTtoday,
    },
    depois: {
      bg,
      regraAplicada:
        ["PAGA", "RECEBIDA", "PAGO", "RECEBIDO"].includes(s) ? "PAGA/RECEBIDA => 🟩" :
        s === "CANCELADA" ? "CANCELADA => neutro" :
        ["ATRASADA", "VENCIDA", "OVERDUE"].includes(s) ? "ATRASADA => 🟥" :
        ["PREVISTA", "PENDENTE", "ABERTA"].includes(s)
          ? (vencLTtoday ? "PREVISTA/PENDENTE vencida => 🟥" : "PREVISTA/PENDENTE não venceu => 🟦")
          : "FALLBACK => 🟦",
    },
  };

  const advMap = new Map((l.advogados || []).map((a) => [a.advogadoId, a.valor]));
  const pend = [];
  if (l.pendencias?.modeloAusente) pend.push("Modelo");
  if (l.pendencias?.splitAusenteComSocio) pend.push("Split");
  if (l.pendencias?.splitExcedido) pend.push("Split>Socio");


                return (
                  return (
  <tr
    key={l.parcelaId}
    style={{ background: bg, cursor: dbgEnabled ? "pointer" : "default" }}
    onClick={() => {
      if (!dbgEnabled) return;
      setDbgInfo(dbgPayload);
      setDbgOpen(true);
    }}
    title={dbgEnabled ? "DBG: clique para ver Antes/Depois" : undefined}
  >

                  <td style={td}>{l.numeroContrato || `#${l.contratoId}`}</td>
                  <td style={td}>{l.clienteNome || `#${l.clienteId}`}</td>
                  <td style={tdNum}>{money(l.valorBruto)}</td>
                  <td style={tdNum}>{(l.aliquotaBp / 100).toFixed(2)}%</td>
                  <td style={tdNum}>{money(l.imposto)}</td>
                  <td style={tdNum}>{money(l.liquido)}</td>

                  {advogadoCols.map((c) => (
                    <td key={c.id} style={tdNum}>{money(advMap.get(c.id) || 0)}</td>
                  ))}

                  <td style={tdNum}>{money(l.escritorio)}</td>
                  <td style={tdNum}>{money(l.fundoReserva)}</td>
                  <td style={td}>{pend.length ? pend.join(", ") : "-"}</td>
                </tr>
              );

                })}

                {totalsRow && (
                  <tr style={{ background: "#fafafa", fontWeight: 700 }}>
                    <td style={td}>Totais</td>
                    <td style={td} />
                    <td style={tdNum}>{money(totalsRow.valor)}</td>
                    <td style={td} />
                    <td style={tdNum}>{money(totalsRow.imposto)}</td>
                    <td style={tdNum}>{money(totalsRow.liquido)}</td>

                    {advogadoCols.map((c) => (
                      <td key={c.id} style={tdNum}>{money(totalsRow.advTot.get(c.id) || 0)}</td>
                    ))}

                    <td style={tdNum}>{money(totalsRow.escritorio)}</td>
                    <td style={tdNum}>{money(totalsRow.fundoReserva)}</td>
                    <td style={td} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data?.linhas && data.linhas.length === 0 && (
          <div style={{ marginTop: 12, opacity: 0.8 }}>
            Nenhuma parcela no mês considerado.
          </div>
        )}
      </div>   
    </div>   
        {/* DEBUG MODAL (produção) */}
        {dbgOpen && dbgInfo && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
            onClick={() => setDbgOpen(false)}
          >
            <div
              style={{
                width: "min(920px, 96vw)",
                maxHeight: "86vh",
                overflow: "auto",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #ddd",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                padding: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  Debug BG — Parcela {dbgInfo?.antes?.parcelaId}
                </div>
                <button
                  onClick={() => setDbgOpen(false)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fafafa", cursor: "pointer" }}
                >
                  Fechar
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Antes</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
{JSON.stringify(dbgInfo.antes, null, 2)}
                  </pre>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Depois</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700 }}>BG:</span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: dbgInfo.depois.bg, border: "1px solid #ddd" }} />
                      {dbgInfo.depois.bg}
                    </span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
{JSON.stringify(dbgInfo.depois, null, 2)}
                  </pre>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Dica: abra Repasses com <b>?dbg=1</b> e clique na linha.
              </div>
            </div>
          </div>
        )}
  
  </div>       
);
}


const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff",
};

const th = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const td = {
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const tdNum = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

function rowBgByStatus(status, vencimento) {
  const s = String(status || "").trim().toUpperCase();

  // 🟩 PAGA / RECEBIDA
  if (["PAGA", "RECEBIDA", "PAGO", "RECEBIDO"].includes(s)) return "#E9F8EE";

  // neutro
  if (s === "CANCELADA") return "#F3F4F6";

  // 🟥 ATRASADA / VENCIDA
  if (["ATRASADA", "VENCIDA", "OVERDUE"].includes(s)) return "#FDECEC";

  // 🟦 PREVISTA / PENDENTE (vira 🟥 se venceu pelo vencimento)
  if (["PREVISTA", "PENDENTE", "ABERTA"].includes(s)) {
    const dt = parseBRDate(vencimento);
    if (dt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dt.setHours(0, 0, 0, 0);
      if (dt < today) return "#FDECEC"; // venceu
    }
    return "#EAF2FF"; // não venceu
  }

  // fallback (tratamos como pendente)
  return "#EAF2FF";
}

function parseBRDate(v) {
  if (!v) return null;

  // já é Date?
  if (v instanceof Date && !isNaN(v)) return v;

  const s = String(v).trim();

  // DD/MM/AAAA
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yy = Number(m[3]);
    const dt = new Date(yy, mm - 1, dd);
    return isNaN(dt) ? null : dt;
  }

  // ISO (ou algo que Date entenda)
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
