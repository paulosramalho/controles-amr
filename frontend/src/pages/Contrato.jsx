// src/pages/Contrato.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import AdminOnly from "../components/AdminOnly";
import Can from "../components/Can";

/* =========================
   Helpers (padrão do projeto)
========================= */
function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

// Máscara R$ (digitando: 1→0,01; 12→0,12; 123→1,23; 1234→12,34; ...)
function maskBRLFromDigits(digits) {
  const s = onlyDigits(digits);
  if (!s) return "";
  const n = Number(s) / 100;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBRLFromDecimal(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Evita D-1 quando o backend manda DateTime em UTC 00:00:00Z
function toDDMMYYYY(dateLike) {
  if (!dateLike) return "—";
  const s = String(dateLike);
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";

  const pad = (n) => String(n).padStart(2, "0");

  const useUTC = /T\d{2}:\d{2}:\d{2}/.test(s) || s.endsWith("Z");
  const dd = useUTC ? d.getUTCDate() : d.getDate();
  const mm = useUTC ? d.getUTCMonth() + 1 : d.getMonth() + 1;
  const yyyy = useUTC ? d.getUTCFullYear() : d.getFullYear();

  return `${pad(dd)}/${pad(mm)}/${yyyy}`;
}

function todayAtNoonLocal() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function computeStatusContrato(c) {
  if (!c) return "EM_DIA";
  if (c.status === "CANCELADO") return "CANCELADO";
  if (c.status === "RENEGOCIADO") return "RENEGOCIADO";
  if (c.status === "QUITADO") return "QUITADO";

  const parcelas = c.parcelas || [];
  const pendentes = parcelas.filter((p) => p.status === "PREVISTA");
  if (!pendentes.length) return "QUITADO";

  const ref = todayAtNoonLocal().getTime();
  const atrasada = pendentes.some((p) => {
    const v = p.vencimento ? new Date(p.vencimento) : null;
    if (!v || Number.isNaN(v.getTime())) return false;
    return v.getTime() < ref;
  });

  return atrasada ? "ATRASADO" : "EM_DIA";
}

function statusToBadge(st) {
  const s = st || "EM_DIA";
  if (s === "ATRASADO") return { label: "Atrasado", tone: "red" };
  if (s === "QUITADO") return { label: "Quitado", tone: "green" };
  if (s === "CANCELADO") return { label: "Cancelado", tone: "slate" };
  if (s === "RENEGOCIADO") return { label: "Renegociado", tone: "purple" };
  return { label: "Em dia", tone: "blue" };
}

function toneClass(tone) {
  // Mesmo padrão visual do Badge em Pagamentos (sólido, texto branco)
  if (tone === "red") return "bg-red-600 text-white";
  if (tone === "green") return "bg-emerald-600 text-white";
  if (tone === "purple") return "bg-purple-600 text-white";
  if (tone === "slate") return "bg-slate-700 text-white";
  return "bg-blue-600 text-white";
}

function Badge({ tone = "blue", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div>{right}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* =========================
   Page
========================= */
export default function ContratoPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";


  const [contrato, setContrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // Receber
  const [receberOpen, setReceberOpen] = useState(false);
  const [receberParcela, setReceberParcela] = useState(null);
  const [recValorDigits, setRecValorDigits] = useState("");
  const [recData, setRecData] = useState("");
  const [recMeio, setRecMeio] = useState("PIX");
  const [recSenha, setRecSenha] = useState("");

  // Retificar
  const [retOpen, setRetOpen] = useState(false);
  const [retParcela, setRetParcela] = useState(null);
  const [retValorDigits, setRetValorDigits] = useState("");
  const [retVenc, setRetVenc] = useState("");
  const [retMotivo, setRetMotivo] = useState("");
  const [retSenha, setRetSenha] = useState("");
  const [ratear, setRatear] = useState(true);
  const [manualOutros, setManualOutros] = useState({}); // {parcelaId: digits}

  async function load() {
    try {
      setLoading(true);
      setErrMsg("");
      const data = await apiFetch(`/api/contratos/${id}`);
      setContrato(data);
    } catch (e) {
      setErrMsg(e?.message || "Erro ao carregar contrato.");
    } finally {
      setLoading(false);
    }
  }

if (!isAdmin) {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-xl font-semibold text-slate-900">Contrato</div>
        <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>

        <div className="mt-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const parcelas = contrato?.parcelas || [];
  const previstas = useMemo(() => parcelas.filter((p) => p.status === "PREVISTA"), [parcelas]);
  const podeRetificarAlguma = previstas.length >= 2;

  const stContrato = useMemo(() => computeStatusContrato(contrato), [contrato]);
  const stBadge = useMemo(() => statusToBadge(stContrato), [stContrato]);

  function openReceber(p) {
    setReceberParcela(p);
    const n = Number(p?.valorPrevisto);
    setRecValorDigits(Number.isFinite(n) ? String(Math.round(n * 100)) : "");
    setRecData(toDDMMYYYY(new Date()));
    setRecMeio("PIX");
    setRecSenha("");
    setReceberOpen(true);
  }

  function openRetificar(p) {
    setRetParcela(p);
    const n = Number(p?.valorPrevisto);
    setRetValorDigits(Number.isFinite(n) ? String(Math.round(n * 100)) : "");
    setRetVenc(p?.vencimento ? toDDMMYYYY(p.vencimento) : "");
    setRetMotivo("");
    setRetSenha("");
    setRatear(true);

    const others = {};
    for (const op of previstas.filter((x) => x.id !== p.id)) {
      const nn = Number(op?.valorPrevisto);
      others[op.id] = Number.isFinite(nn) ? String(Math.round(nn * 100)) : "";
    }
    setManualOutros(others);

    setRetOpen(true);
  }

  async function submitReceber() {
    if (!receberParcela) return;
    try {
      setErrMsg("");

      const previsto = Number(receberParcela.valorPrevisto);
      const recebido = Number(onlyDigits(recValorDigits || "0")) / 100;
      if (Number.isFinite(previsto) && Number.isFinite(recebido)) {
        if (recebido < previsto) {
          return setErrMsg("Não é permitido receber valor menor que o previsto. Para diferença, use renegociação.");
        }
      }

      await apiFetch(`/api/parcelas/${receberParcela.id}/confirmar`, {
        method: "PATCH",
        body: {
          valorRecebido: onlyDigits(recValorDigits || ""), // centavos (padrão)
          dataRecebimento: recData,
          meioRecebimento: recMeio,
          adminPassword: recSenha,
        },
      });

      setReceberOpen(false);
      setReceberParcela(null);
      await load();
    } catch (e) {
      setErrMsg(e?.message || "Erro ao confirmar recebimento.");
    }
  }

  function sumDigitsMap(mapObj) {
    let total = 0;
    for (const k of Object.keys(mapObj || {})) {
      const d = Number(onlyDigits(mapObj[k] || "0"));
      total += Number.isFinite(d) ? d : 0;
    }
    return total; // centavos (number)
  }

  async function submitRetificar() {
    if (!retParcela) return;
    try {
      setErrMsg("");

      const motivo = String(retMotivo || "").trim();
      if (!motivo) return setErrMsg("Informe o motivo da retificação.");

      const patch = {};
      if (retVenc) patch.vencimento = retVenc;
      if (retValorDigits) patch.valorPrevisto = onlyDigits(retValorDigits);

      if (!Object.keys(patch).length) return setErrMsg("Nada para retificar.");

      // Validação local (manual): soma deve fechar o total
      if (!ratear && patch.valorPrevisto !== undefined) {
        const alvoNovo = Number(onlyDigits(retValorDigits || "0"));
        const alvoAtual = Number.isFinite(Number(retParcela.valorPrevisto)) ? Math.round(Number(retParcela.valorPrevisto) * 100) : 0;

        const delta = alvoNovo - alvoAtual; // centavos
        const somaAtualOutros = previstas
          .filter((x) => x.id !== retParcela.id)
          .reduce((acc, x) => acc + (Number.isFinite(Number(x.valorPrevisto)) ? Math.round(Number(x.valorPrevisto) * 100) : 0), 0);

        const somaEsperada = somaAtualOutros - delta;
        const somaManual = sumDigitsMap(manualOutros);

        if (somaManual !== somaEsperada) {
          return setErrMsg("Soma dos valores das demais parcelas não fecha com o total do contrato. Ajuste os valores ou renegocie.");
        }
      }

      await apiFetch(`/api/parcelas/${retParcela.id}/retificar`, {
        method: "POST",
        body: {
          adminPassword: retSenha,
          motivo,
          patch,
          ratearEntreDemais: ratear,
          valoresOutrasParcelas: ratear ? undefined : manualOutros,
        },
      });

      setRetOpen(false);
      setRetParcela(null);
      await load();
    } catch (e) {
      setErrMsg(e?.message || "Erro ao salvar retificação.");
    }
  }

  function closeModals() {
    setReceberOpen(false);
    setReceberParcela(null);
    setRetOpen(false);
    setRetParcela(null);
  }

  if (loading) {
    return <div className="p-6 text-slate-600">Carregando…</div>;
  }

  if (errMsg && !contrato) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errMsg}</div>
        <button onClick={() => navigate(-1)} className="mt-4 rounded-xl border px-4 py-2 text-sm">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AdminOnly user={user}>
        <button
          onClick={() => navigate(`/pagamentos?renegociar=${contrato?.id}`)}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
          title="Renegociar saldo do contrato"
        >
          Renegociar Saldo
        </button>
      </AdminOnly>

      <Badge tone={stBadge.tone}>{stBadge.label}</Badge>
    </div>


      {errMsg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{errMsg}</div>
      )}

      <Card
        title={`Contrato #${contrato?.numero || ""}`}
        right={
          <div className="text-xs text-slate-500">
            Criado em: <span className="font-medium text-slate-700">{toDDMMYYYY(contrato?.createdAt)}</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Cliente</div>
            <div className="text-sm font-semibold text-slate-900">{contrato?.cliente?.nome || "—"}</div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Valor Total</div>
            <div className="text-sm font-semibold text-slate-900">R$ {formatBRLFromDecimal(contrato?.valorTotal)}</div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Forma de pagamento</div>
            <div className="text-sm font-semibold text-slate-900">{contrato?.formaPagamento || "—"}</div>
          </div>
        </div>
      </Card>

      <Card
        title="Parcelas"
        right={
          <div className="text-xs text-slate-500">
            PREVISTAS: <span className="font-semibold text-slate-700">{previstas.length}</span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="border-b">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3">Valor previsto</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p) => {
                const st = p.status;
                const badge = st === "RECEBIDA"
                  ? { label: "Recebida", tone: "green" }
                  : st === "CANCELADA"
                    ? { label: "Cancelada", tone: "slate" }
                    : { label: "Prevista", tone: "blue" };

                const podeRetificar = st === "PREVISTA" && podeRetificarAlguma;

                return (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 font-semibold text-slate-900">{p.numero}</td>
                    <td className="py-3 pr-3">{toDDMMYYYY(p.vencimento)}</td>
                    <td className="py-3 pr-3">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <Can when={isAdmin && st === "PREVISTA"}>
                          <button
                            onClick={() => openReceber(p)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                          >
                            Receber Parcela
                          </button>
                        </Can>

                        <Can when={isAdmin && podeRetificar}>
                          <button
                            onClick={() => openRetificar(p)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                          >
                            Retificar
                          </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!parcelas.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    Nenhuma parcela.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Receber */}
      {receberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={closeModals}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Receber parcela #{receberParcela?.numero}</div>
              <button className="text-slate-500" onClick={closeModals}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-xs text-slate-600">
                Valor recebido (R$)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={maskBRLFromDigits(recValorDigits)}
                  onChange={(e) => setRecValorDigits(onlyDigits(e.target.value))}
                  placeholder="0,00"
                />
              </label>

              <label className="text-xs text-slate-600">
                Data de recebimento (DD/MM/AAAA)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={recData}
                  onChange={(e) => setRecData(e.target.value)}
                  placeholder="DD/MM/AAAA"
                />
              </label>

              <label className="text-xs text-slate-600">
                Meio
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={recMeio}
                  onChange={(e) => setRecMeio(e.target.value)}
                >
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">BOLETO</option>
                  <option value="TED">TED</option>
                  <option value="DINHEIRO">DINHEIRO</option>
                  <option value="CARTAO">CARTÃO</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Confirme senha do admin
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={recSenha}
                  onChange={(e) => setRecSenha(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm" onClick={closeModals}>
                Cancelar
              </button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={submitReceber}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retificar */}
      {retOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={closeModals}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Retificar parcela #{retParcela?.numero}</div>
              <button className="text-slate-500" onClick={closeModals}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                Valor previsto (R$)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={maskBRLFromDigits(retValorDigits)}
                  onChange={(e) => setRetValorDigits(onlyDigits(e.target.value))}
                  placeholder="0,00"
                />
              </label>

              <label className="text-xs text-slate-600">
                Vencimento (DD/MM/AAAA)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={retVenc}
                  onChange={(e) => setRetVenc(e.target.value)}
                  placeholder="DD/MM/AAAA"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ratear} onChange={(e) => setRatear(e.target.checked)} />
                <span className="font-semibold">Ratear entre as demais parcelas PREVISTAS</span>
              </label>

              {!ratear && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-slate-600">
                    Ajuste manual (a soma deve manter o valor total do contrato/renegociação).
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {previstas
                      .filter((x) => x.id !== retParcela?.id)
                      .map((op) => (
                        <label key={op.id} className="text-xs text-slate-600">
                          Parcela #{op.numero} (R$)
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            value={maskBRLFromDigits(manualOutros[op.id] || "")}
                            onChange={(e) => setManualOutros((prev) => ({ ...prev, [op.id]: onlyDigits(e.target.value) }))}
                            placeholder="0,00"
                          />
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-xs text-slate-600">
                Motivo (obrigatório)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={retMotivo}
                  onChange={(e) => setRetMotivo(e.target.value)}
                  placeholder="Ex.: Valor digitado errado"
                />
              </label>

              <label className="text-xs text-slate-600">
                Confirme senha do admin
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={retSenha}
                  onChange={(e) => setRetSenha(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm" onClick={closeModals}>
                Cancelar
              </button>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={submitRetificar}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
