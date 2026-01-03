// src/pages/Repasses.jsx - 02/01/26
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
                    const bg = rowBgByStatus(statusRaw, vencRaw);
                    const advMap = new Map((l.advogados || []).map((a) => [a.advogadoId, a.valor]));
                    const pend = [];
                  }

                  if (l.pendencias?.modeloAusente) pend.push("Modelo");
                  if (l.pendencias?.splitAusenteComSocio) pend.push("Split");
                  if (l.pendencias?.splitExcedido) pend.push("Split>Socio");

                  return (
                    <tr key={l.parcelaId} style={{ background: bg }}>
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
  if (["PAGA", "RECEBIDA", "PAGO", "RECEBIDO"].includes(s)) return "#DDEBFF";

  // neutro
  if (s === "CANCELADA") return "#F3F4F6";

  // 🟥 ATRASADA / VENCIDA
  if (["ATRASADA", "VENCIDA", "OVERDUE"].includes(s)) return "#FFD9D9";

  // 🟦 PREVISTA / PENDENTE (vira 🟥 se venceu pelo vencimento)
  if (["PREVISTA", "PENDENTE", "ABERTA"].includes(s)) {
    const dt = parseBRDate(vencimento);
    if (dt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dt.setHours(0, 0, 0, 0);
      if (dt < today) return "#FFD9D9"; // venceu
    }
    return "#FFF1CC"; // não venceu
  }

  // fallback (tratamos como pendente)
  return "#FFF1CC";
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
