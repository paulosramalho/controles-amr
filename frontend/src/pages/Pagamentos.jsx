/* /mnt/data/Pagamentos.jsx.updated62.jsx */
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api"; // mantém o seu import original
import Modal from "../components/Modal"; // mantém o seu import original

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-200 text-slate-800",
    blue: "bg-blue-600 text-white",
    green: "bg-emerald-600 text-white",
    red: "bg-red-600 text-white",
    amber: "bg-amber-500 text-white",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tones[tone] || tones.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function isParcelaAtrasada(p) {
  if (!p) return false;
  if (p.status !== "PREVISTA") return false;
  const now = new Date();
  const v = new Date(p.vencimento);
  return Number.isFinite(v.getTime()) && v < now;
}

function hasParcelaAtrasada(contrato) {
  const parcelas = contrato?.parcelas || [];
  return parcelas.some((p) => isParcelaAtrasada(p));
}

function computeStatusContrato(contrato) {
  if (!contrato?.ativo) return { label: "Inativo", tone: "red" };

  const parcelas = contrato?.parcelas || [];
  if (!parcelas.length) return { label: "Sem parcelas", tone: "amber" };

  const qtdCanceladas = parcelas.filter((p) => p.status === "CANCELADA").length;
  const qtdRecebidas = parcelas.filter((p) => p.status === "RECEBIDA").length;

  // ✅ contrato totalmente cancelado
  if (qtdCanceladas === parcelas.length) return { label: "Cancelado", tone: "slate" };

  // ✅ quitado = tudo recebido OU recebido + cancelado
  if (qtdRecebidas + qtdCanceladas === parcelas.length) return { label: "Quitado", tone: "green" };

  // ✅ atrasado = existe parcela prevista cujo vencimento já passou (ignorando canceladas/recebidas)
  const hasOverdue = hasParcelaAtrasada(contrato);

  return hasOverdue ? { label: "Atrasado", tone: "red" } : { label: "Em dia", tone: "blue" };
}

function moneyBR(v) {
  const n = Number(v ?? 0) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PagamentosPage({ user }) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const [openParcelas, setOpenParcelas] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parcelaToConfirm, setParcelaToConfirm] = useState(null);

  const [confData, setConfData] = useState("");
  const [confValor, setConfValor] = useState("");
  const [confMeio, setConfMeio] = useState("PIX");
  const [confObs, setConfObs] = useState("");

  // modal premium de cancelamento
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [parcelaToCancel, setParcelaToCancel] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/pagamentos");
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return items;

    return (items || []).filter((c) => {
      const contrato = String(c?.numeroContrato || "").toLowerCase();
      const cliente = String(c?.cliente?.nomeRazaoSocial || c?.clienteNome || "").toLowerCase();
      const email = String(c?.cliente?.email || c?.clienteEmail || "").toLowerCase();
      const doc = String(c?.cliente?.cpfCnpj || c?.cpfCnpj || "").toLowerCase();
      return contrato.includes(term) || cliente.includes(term) || email.includes(term) || doc.includes(term);
    });
  }, [items, q]);

  // ======== Totais dentro do modal (selectedContrato)
  const parcelasDoContrato = selectedContrato?.parcelas || [];

  // Totais do contrato (canceladas não entram no previsto/pendente)
  const totalPrevisto = parcelasDoContrato
    .filter((p) => p.status !== "CANCELADA")
    .reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0);

  const totalRecebido = parcelasDoContrato
    .filter((p) => p.status === "RECEBIDA")
    .reduce((sum, p) => sum + Number(p?.valorRecebido || 0), 0);

  const diferenca = totalRecebido - totalPrevisto;

  function openParcelasModal(contrato) {
    setSelectedContrato(contrato);
    setOpenParcelas(true);
  }

  function closeParcelasModal() {
    setOpenParcelas(false);
    setSelectedContrato(null);
  }

  function openConfirmModal(parcela) {
    setParcelaToConfirm(parcela);
    setConfData("");
    setConfValor("");
    setConfMeio("PIX");
    setConfObs("");
    setConfirmOpen(true);
  }

  function closeConfirmModal() {
    setConfirmOpen(false);
    setParcelaToConfirm(null);
  }

  async function confirmarRecebimento() {
    if (!parcelaToConfirm) return;
    setConfirming(true);
    try {
      const payload = {
        dataRecebimento: confData || undefined,
        valorRecebido: confValor || undefined,
        meioRecebimento: confMeio || undefined,
        observacoes: confObs || undefined,
      };

      const resp = await apiFetch(`/api/parcelas/${parcelaToConfirm.id}/confirmar`, {
        method: "PATCH",
        body: payload,
      });

      // ✅ atualiza o modal imediatamente
      setSelectedContrato((prev) => {
        if (!prev) return prev;
        const parcelas = (prev.parcelas || []).map((p) =>
          p.id === parcelaToConfirm.id ? { ...p, ...(resp?.parcela || {}), status: "RECEBIDA" } : p
        );
        return { ...prev, parcelas };
      });

      // ✅ atualiza lista principal
      await load();

      closeConfirmModal();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao receber parcela.");
    } finally {
      setConfirming(false);
    }
  }

  function openCancelModal(parcela) {
    setParcelaToCancel(parcela);
    setCancelMotivo("");
    setCancelOpen(true);
  }

  function closeCancelModal() {
    setCancelOpen(false);
    setParcelaToCancel(null);
    setCancelMotivo("");
  }

  async function cancelarParcela() {
    if (!parcelaToCancel) return;
    const motivo = String(cancelMotivo || "").trim();
    if (!motivo) {
      alert("Informe o motivo do cancelamento.");
      return;
    }

    setCanceling(true);
    try {
      const resp = await apiFetch(`/api/parcelas/${parcelaToCancel.id}/cancelar`, {
        method: "PATCH",
        body: { motivo },
      });

      // ✅ atualiza o modal imediatamente
      setSelectedContrato((prev) => {
        if (!prev) return prev;
        const parcelas = (prev.parcelas || []).map((p) =>
          p.id === parcelaToCancel.id
            ? { ...p, ...(resp?.parcela || {}), status: "CANCELADA", motivoCancelamento: motivo }
            : p
        );
        return { ...prev, parcelas };
      });

      // ✅ atualiza lista principal
      await load();

      closeCancelModal();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao cancelar parcela.");
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pagamentos</h1>
          <div className="text-sm text-slate-500">Admin: cadastro, edição e controle de parcelas.</div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => alert("Em desenvolvimento")}
            >
              + Incluir Pagamentos
            </button>
          ) : null}
        </div>
      </div>

      {/* Buscar + Atualizar */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex-1 max-w-xl">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Buscar por contrato, cliente, e-mail, CPF/CNPJ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={load}
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Contrato</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-right font-semibold">Valor total</th>
              <th className="px-4 py-3 text-right font-semibold">Valor recebido</th>
              <th className="px-4 py-3 text-right font-semibold">Valor pendente</th>
              <th className="px-4 py-3 text-left font-semibold">Forma</th>
              <th className="px-4 py-3 text-center font-semibold">Parcelas</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={9}>
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={9}>
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const st = computeStatusContrato(c);

                const totalRecebidoLinha =
                  Number(
                    c?.resumo?.totalRecebido ??
                      (c?.parcelas || []).reduce((sum, p) => sum + Number(p?.valorRecebido || 0), 0)
                  ) || 0;

                const valorTotalLinha = Number(c?.valorTotal || 0) || 0;

                // Pendente: total previsto (ignorando parcelas canceladas) - total recebido (clamp em 0)
                const totalPrevistoLinha =
                  Number(
                    c?.resumo?.totalPrevisto ??
                      (c?.parcelas || [])
                        .filter((p) => p.status !== "CANCELADA")
                        .reduce((sum, p) => sum + Number(p?.valorPrevisto || 0), 0)
                  ) || valorTotalLinha;

                const pendenteLinha = Math.max(0, totalPrevistoLinha - totalRecebidoLinha);

                const clienteNome = c?.cliente?.nomeRazaoSocial || c?.clienteNome || "—";

                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.numeroContrato}</td>
                    <td className="px-4 py-3 text-slate-800">{clienteNome}</td>
                    <td className="px-4 py-3 text-right">{moneyBR(c.valorTotal)}</td>
                    <td className="px-4 py-3 text-right">{moneyBR(totalRecebidoLinha)}</td>
                    <td className="px-4 py-3 text-right">{moneyBR(pendenteLinha)}</td>
                    <td className="px-4 py-3">{c.formaPagamento}</td>
                    <td className="px-4 py-3 text-center">
                      {c?.parcelasRecebidas}/{c?.parcelasTotal}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => openParcelasModal(c)}
                      >
                        Parcelas
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Controle de Parcelas */}
      <Modal
        open={openParcelas}
        onClose={closeParcelasModal}
        title={
          selectedContrato
            ? `Controle de Parcelas do Contrato ${selectedContrato.numeroContrato} - ${
                selectedContrato?.cliente?.nomeRazaoSocial || "Cliente"
              }`
            : "Controle de Parcelas"
        }
        size="xl"
      >
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-right font-semibold">Valor previsto</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Valor recebido</th>
                <th className="px-4 py-3 text-left font-semibold">Data recebimento</th>
                <th className="px-4 py-3 text-left font-semibold">Meio</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(selectedContrato?.parcelas || []).map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3">{p.vencimento}</td>
                  <td className="px-4 py-3 text-right">{moneyBR(p.valorPrevisto)}</td>

                  {/** STATUS + motivo (se cancelada) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                        {p.status === "RECEBIDA" ? (
                          <Badge tone="green">Recebida</Badge>
                        ) : p.status === "CANCELADA" ? (
                          <Badge tone="slate">Cancelada</Badge>
                        ) : isParcelaAtrasada(p) ? (
                          <Badge tone="red">Atrasada</Badge>
                        ) : (
                          <Badge tone="blue">Prevista</Badge>
                        )}

                        {p.status === "CANCELADA" && p.motivoCancelamento ? (
                          <div
                            className="mt-1 text-xs text-slate-500 max-w-[220px] truncate"
                            title={p.motivoCancelamento}
                          >
                            Motivo: {p.motivoCancelamento}
                          </div>
                        ) : null}
                      </td>

                  <td className="px-4 py-3 text-right">{p.status === "RECEBIDA" ? moneyBR(p.valorRecebido) : "—"}</td>
                  <td className="px-4 py-3">{p.status === "RECEBIDA" ? (p.dataRecebimento || "—") : "—"}</td>
                  <td className="px-4 py-3">{p.status === "RECEBIDA" ? (p.meioRecebimento || "—") : "—"}</td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {p.status === "PREVISTA" ? (
                        <button
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => openConfirmModal(p)}
                        >
                          Receber Parcela
                        </button>
                      ) : null}

                      {isAdmin && p.status !== "RECEBIDA" && p.status !== "CANCELADA" ? (
                        <button
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                          onClick={() => openCancelModal(p)}
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {/* Totais (abaixo da última parcela) */}
              <tr>
                <td className="px-4 py-3" colSpan={8}>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Total previsto</div>
                      <div className="text-base font-semibold text-slate-900">{moneyBR(totalPrevisto)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Total recebido</div>
                      <div className="text-base font-semibold text-slate-900">{moneyBR(totalRecebido)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Diferença</div>
                      <div className="text-base font-semibold">
                        <span className={diferenca >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {moneyBR(diferenca)}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={closeParcelasModal}
          >
            Fechar
          </button>
        </div>
      </Modal>

      {/* Modal: Receber Parcela */}
      <Modal open={confirmOpen} onClose={closeConfirmModal} title="Receber parcela" size="md">
        <div className="space-y-3">
          <label className="block">
            <div className="text-sm font-medium text-slate-700">Data do recebimento (DD/MM/AAAA)</div>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={confData}
              onChange={(e) => setConfData(e.target.value)}
              placeholder="DD/MM/AAAA"
              disabled={confirming}
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Valor recebido (R$)</div>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={confValor}
              onChange={(e) => setConfValor(e.target.value)}
              placeholder="Ex.: 1.234,56"
              disabled={confirming}
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Meio</div>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={confMeio}
              onChange={(e) => setConfMeio(e.target.value)}
              disabled={confirming}
            >
              <option value="PIX">PIX</option>
              <option value="TED">TED</option>
              <option value="BOLETO">BOLETO</option>
              <option value="CARTAO">CARTAO</option>
              <option value="DINHEIRO">DINHEIRO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Observações</div>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              rows={3}
              value={confObs}
              onChange={(e) => setConfObs(e.target.value)}
              disabled={confirming}
            />
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={closeConfirmModal}
              disabled={confirming}
            >
              Fechar
            </button>
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={confirmarRecebimento}
              disabled={confirming}
            >
              {confirming ? "Recebendo…" : "Receber Parcela"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Cancelar Parcela (premium) */}
      <Modal open={cancelOpen} onClose={closeCancelModal} title="Cancelar parcela" size="md">
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            Informe o motivo (obrigatório). Parcela recebida não pode ser cancelada.
          </div>

          <label className="block">
            <div className="text-sm font-medium text-slate-700">Motivo</div>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Ex.: renegociação / isenção / erro de lançamento…"
              disabled={canceling}
            />
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={closeCancelModal}
              disabled={canceling}
            >
              Fechar
            </button>
            <button
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              onClick={cancelarParcela}
              disabled={canceling}
            >
              {canceling ? "Cancelando…" : "Cancelar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
