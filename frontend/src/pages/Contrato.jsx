// src/pages/Contrato.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

/* helpers (copiados do padrão das telas) */
function formatBRLFromDecimal(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDDMMYYYY(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isDateBeforeToday(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return false;
  const now = new Date();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d0 < n0;
}

function normalizeForma(fp) {
  const v = String(fp || "").toUpperCase();
  if (v === "AVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA_PARCELAS") return "Entrada + Parcelas";
  return fp || "—";
}


function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

// Máscara padrão adotada (digitando: 1→0,01; 12→0,12; 123→1,23; 1234→12,34; ...)
function maskBRLFromDigits(digits) {
  const d = onlyDigits(digits);
  if (!d) return "0,00";
  const i = d.length > 2 ? d.slice(0, -2) : "0";
  const c = d.slice(-2).padStart(2, "0");
  const iNum = Number(i || 0);
  const iFmt = iNum.toLocaleString("pt-BR");
  return `${iFmt},${c}`;
}


function computeStatusContrato(contrato) {
  if (!contrato?.ativo) return { label: "Inativo", tone: "red" };

  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return { label: "Sem parcelas", tone: "amber" };

  const now = new Date();
  const isOverdue = (p) => {
    if (!p) return false;
    if (p.status !== "PREVISTA") return false;
    const v = new Date(p.vencimento);
    if (!Number.isFinite(v.getTime())) return false;
    // compara por dia
    const v0 = new Date(v.getFullYear(), v.getMonth(), v.getDate());
    const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return v0 < n0;
  };


function openRetificar(parcela) {
  setRetError("");
  setRetParcela(parcela);

  // preenche com o valor previsto atual
  const v = Number(parcela?.valorPrevisto || 0);
  const digits = String(Math.round(v * 100)); // 1234.56 -> "123456"
  setRetValorDigits(digits);

  // default: ratear entre as demais parcelas
  setRetRatear(true);

  // prepara campos das demais parcelas PREVISTAS (para modo manual)
  const outrasPrev = (contrato?.parcelas || [])
    .filter((x) => x.status === "PREVISTA" && x.id !== parcela?.id)
    .sort((a, b) => (a.numero || 0) - (b.numero || 0));

  const map = {};
  for (const o of outrasPrev) {
    const ov = Number(o?.valorPrevisto || 0);
    map[o.id] = String(Math.round(ov * 100));
  }
  setRetOutrosDigits(map);

  setRetMotivo("");
  setRetAdminPassword("");
  setRetOpen(true);
}

async function salvarRetificacao() {
  if (!retParcela?.id) return;
  setRetError("");

  const motivo = String(retMotivo || "").trim();
  if (!motivo) return setRetError("Informe o motivo da retificação.");

  const valorPrevisto = Number(retValorDigits || 0) / 100;
  if (!valorPrevisto || valorPrevisto <= 0) return setRetError("Valor previsto inválido.");

  if (!retAdminPassword) return setRetError("Confirme a senha do admin.");

  // Se NÃO estiver rateando, exige que os valores das demais parcelas fechem exatamente o total das PREVISTAS
  if (!retRatear) {
    const previstas = (contrato?.parcelas || []).filter((x) => x.status === "PREVISTA");
    if (previstas.length < 2) {
      return setRetError("Retificação bloqueada: é necessário ter pelo menos 2 parcelas PREVISTAS.");
    }

    const totalAntes = previstas.reduce((acc, it) => acc + BigInt(Math.round(Number(it?.valorPrevisto || 0) * 100)), 0n);

    const outrasIds = previstas
      .filter((x) => x.id !== retParcela?.id)
      .map((x) => x.id);

    for (const oid of outrasIds) {
      const dig = retOutrosDigits?.[oid];
      const cents = BigInt(Number(dig || 0));
      if (cents <= 0n) {
        return setRetError("No modo manual, informe valores válidos para todas as demais parcelas PREVISTAS.");
      }
    }

    const totalDepois =
      BigInt(Number(retValorDigits || 0)) +
      outrasIds.reduce((acc, oid) => acc + BigInt(Number(retOutrosDigits?.[oid] || 0)), 0n);

    if (totalDepois !== totalAntes) {
      return setRetError("Os valores informados alteram o total do contrato. Ajuste para fechar o total ou use Renegociar (Rx).");
    }
  }

  setRetSaving(true);
  try {
    await apiFetch(`/parcelas/${retParcela.id}/retificar`, {
      method: "POST",
      body: {
        adminPassword: retAdminPassword,
        motivo,
        ratear: retRatear,
        ajustes: retRatear
          ? undefined
          : Object.entries(retOutrosDigits).map(([id, digits]) => ({
              id: Number(id),
              valorPrevisto: Number(digits || 0) / 100,
            })),
        patch: { valorPrevisto }, // ✅ number em REAIS
      },
    });

    // recarrega contrato
    await loadContrato();
    setRetOpen(false);
  } catch (e) {
    setRetError(e?.message || "Falha ao retificar.");
  } finally {
    setRetSaving(false);
  }
}


  const todasCanceladas = parcelas.every((p) => p.status === "CANCELADA");
  if (todasCanceladas) return { label: "Cancelado", tone: "slate" };

  const todasQuitadas = parcelas.every((p) => p.status === "RECEBIDA" || p.status === "CANCELADA");
  if (todasQuitadas) return { label: "Quitado", tone: "green" };

  const hasOverdue = parcelas.some((p) => isOverdue(p));
  return hasOverdue ? { label: "Atrasado", tone: "red" } : { label: "Em dia", tone: "blue" };
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

function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="text-xl font-semibold text-slate-900">{title}</div>
        {right ? <div className="pt-0.5">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ContratoPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [error, setError] = useState("");

// Retificar parcela (admin-only)
const [retOpen, setRetOpen] = useState(false);
const [retSaving, setRetSaving] = useState(false);
const [retError, setRetError] = useState("");
const [retParcela, setRetParcela] = useState(null);

const [retValorDigits, setRetValorDigits] = useState(""); // máscara moeda padrão
const [retRatear, setRetRatear] = useState(true);
const [retOutrosDigits, setRetOutrosDigits] = useState({}); // { parcelaId: "digits" }

const [retMotivo, setRetMotivo] = useState("");
const [retAdminPassword, setRetAdminPassword] = useState("");


  async function loadContrato() {
    setError("");
    setLoading(true);
    try {
      // Preferência: endpoint dedicado
      const c = await apiFetch(`/contratos/${id}`);
      setContrato(c || null);
    } catch (e1) {
      // Fallback: se não existir rota GET /contratos/:id ainda,
      // busca lista e localiza.
      try {
        const all = await apiFetch(`/contratos`);
        const found = (Array.isArray(all) ? all : []).find((x) => String(x.id) === String(id));
        if (!found) throw new Error("Contrato não encontrado.");
        setContrato(found);
      } catch (e2) {
        setError(e2?.message || e1?.message || "Falha ao carregar contrato.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const parcelas = contrato?.parcelas || [];
  const qtdPrevistas = parcelas.filter((x) => x.status === "PREVISTA").length;

  const totals = useMemo(() => {
    // CANCELADAS não entram no previsto/pendente
    const ativas = parcelas.filter((p) => p?.status !== "CANCELADA");
    const totalPrevisto = ativas.reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);
    const totalRecebido = ativas.reduce((sum, p) => sum + Number(p?.valorRecebido || 0), 0);
    const diferenca = totalRecebido - totalPrevisto;
    return { totalPrevisto, totalRecebido, diferenca };
  }, [parcelas]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xl font-semibold text-slate-900">Contrato</div>
          <div className="mt-2 text-sm text-slate-600">Acesso restrito a administradores.</div>
        </div>
      </div>
    );
  }

  const status = contrato ? computeStatusContrato(contrato) : { label: "—", tone: "slate" };

  return (
    <div className="p-6">
      <Card
        title={contrato ? `Contrato ${contrato.numeroContrato}` : "Contrato"}
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              ← Voltar
            </button>

            <Link
              to="/pagamentos"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Pagamentos
            </Link>
          </div>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        ) : null}

        {!contrato ? (
          <div className="text-sm text-slate-600">{loading ? "Carregando..." : "Contrato não encontrado."}</div>
        ) : (
          <div className="space-y-5">
            {/* Bloco “como foi lançado” */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-500">Cliente</div>
                <div className="font-semibold text-slate-900">{contrato?.cliente?.nomeRazaoSocial || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Forma</div>
                <div className="font-semibold text-slate-900">{normalizeForma(contrato.formaPagamento)}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-slate-500">Status</div>
                  <div className="mt-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-500">Valor total</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(contrato.valorTotal)}</div>
              </div>
              <div>
                <div className="text-slate-500">Criado em</div>
                <div className="font-semibold text-slate-900">{toDDMMYYYY(contrato.createdAt)}</div>
              </div>
              <div>
                <div className="text-slate-500">Ativo</div>
                <div className="font-semibold text-slate-900">{contrato.ativo ? "Sim" : "Não"}</div>
              </div>

              {contrato.observacoes ? (
                <div className="md:col-span-3">
                  <div className="text-slate-500">Observações</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-800">{contrato.observacoes}</div>
                </div>
              ) : null}
            </div>

            {/* Parcelas (read-only) */}
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">#</th>
                    <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-3 font-semibold">Previsto</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Recebido</th>
                    <th className="text-left px-4 py-3 font-semibold">Meio</th>
                    <th className="text-right px-4 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parcelas.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{p.numero}</td>
                      <td className="px-4 py-3 text-slate-800">{toDDMMYYYY(p.vencimento)}</td>
                      <td className="px-4 py-3 text-slate-800">R$ {formatBRLFromDecimal(p.valorPrevisto)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const isOverdue = p.status === "PREVISTA" && isDateBeforeToday(p.vencimento);
                          const label = p.status === "RECEBIDA" ? "Recebida" : p.status === "CANCELADA" ? "Cancelada" : isOverdue ? "Atrasada" : "Prevista";
                          const tone = p.status === "RECEBIDA" ? "green" : p.status === "CANCELADA" ? "slate" : isOverdue ? "red" : "blue";

                          const motivo =
                            p.cancelMotivo ||
                            p.motivoCancelamento ||
                            p.motivo ||
                            "";

                          return (
                            <div className="flex flex-col gap-1">
                              <span title={p.status === "CANCELADA" && motivo ? `Motivo: ${motivo}` : undefined}>
                                <Badge tone={tone}>{label}</Badge>
                              </span>
                              {p.status === "CANCELADA" && motivo ? (
                                <div className="text-xs text-slate-500 line-clamp-1" title={motivo}>
                                  Motivo: {motivo}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {p.valorRecebido ? `R$ ${formatBRLFromDecimal(p.valorRecebido)}` : "—"}
                        {p.dataRecebimento ? (
                          <div className="text-xs text-slate-500 mt-1">{toDDMMYYYY(p.dataRecebimento)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.meioRecebimento || "—"}</td>
<td className="px-4 py-3 text-right">
  {p.status === "PREVISTA" && qtdPrevistas >= 2 ? (
    <button
      type="button"
      onClick={() => openRetificar(p)}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
    >
      Retificar
    </button>
  ) : null}
</td>
                    </tr>
                  ))}

                  {!parcelas.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                        Nenhuma parcela cadastrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Totais (read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-slate-500">Total previsto</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(totals.totalPrevisto)}</div>
              </div>
              <div>
                <div className="text-slate-500">Total recebido</div>
                <div className="font-semibold text-slate-900">R$ {formatBRLFromDecimal(totals.totalRecebido)}</div>
              </div>
              <div>
                <div className="text-slate-500">Diferença</div>
                <div
                  className={`font-semibold ${
                    totals.diferenca < 0 ? "text-red-600" : totals.diferenca > 0 ? "text-blue-600" : "text-slate-900"
                  }`}
                >
                  R$ {formatBRLFromDecimal(totals.diferenca)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    {retOpen ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="text-lg font-extrabold text-slate-900">
          Retificar Parcela #{retParcela?.numero ?? "—"}
        </div>
        <button
          type="button"
          onClick={() => setRetOpen(false)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          Fechar
        </button>
      </div>

      <div className="px-5 py-4">
        {retError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {retError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Valor previsto (R$)</label>
            <input
              value={maskBRLFromDigits(retValorDigits)}
              onChange={(e) => setRetValorDigits(onlyDigits(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="0,00"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Senha do admin</label>
            <input
              value={retAdminPassword}
              onChange={(e) => setRetAdminPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="••••••••"
              type="password"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Motivo *</label>
            <input
              value={retMotivo}
              onChange={(e) => setRetMotivo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Ex.: Valor previsto lançado errado"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 pt-1">
            <input
              id="ret-ratear"
              type="checkbox"
              checked={retRatear}
              onChange={(e) => setRetRatear(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="ret-ratear" className="text-sm text-slate-800">
              Ratear entre as demais parcelas
            </label>
          </div>

          {!retRatear ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800 mb-2">
                Defina os valores das demais parcelas PREVISTAS (o total deve permanecer igual)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(contrato?.parcelas || [])
                  .filter((x) => x.status === "PREVISTA" && x.id !== retParcela?.id)
                  .sort((a, b) => (a.numero || 0) - (b.numero || 0))
                  .map((p) => (
                    <div key={p.id}>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">Parcela #{p.numero}</label>
                      <input
                        value={maskBRLFromDigits(retOutrosDigits?.[p.id] ?? "")}
                        onChange={(e) =>
                          setRetOutrosDigits((cur) => ({
                            ...(cur || {}),
                            [p.id]: onlyDigits(e.target.value),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="0,00"
                        inputMode="numeric"
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
        <button
          type="button"
          onClick={() => setRetOpen(false)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          disabled={retSaving}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvarRetificacao}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-black disabled:opacity-60"
          disabled={retSaving}
        >
          {retSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  </div>
) : null}
</div>
  );
}
