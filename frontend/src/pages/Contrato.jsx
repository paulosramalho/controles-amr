// src/pages/Contrato.jsx  03/01
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

function parseBRLValueToNumber(v) {
  if (v === null || v === undefined || v === "") return 0;

  // number já em reais
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const s = String(v).trim();
  if (!s) return 0;

  // só dígitos => centavos
  if (/^\d+$/.test(s)) {
    const cents = Number(s);
    return Number.isFinite(cents) ? cents / 100 : 0;
  }

  // "1.500,00" (pt-BR)
  if (s.includes(",") && s.match(/^\d{1,3}(\.\d{3})*,\d{2}$/)) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  // fallback: "1500.00" ou "1500"
  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

function parseBRLHeuristic(recebido, previsto) {
  if (recebido === null || recebido === undefined || recebido === "") return 0;

  // number assume reais
  if (typeof recebido === "number") return Number.isFinite(recebido) ? recebido : 0;

  const s = String(recebido).trim();
  if (!s) return 0;

  // se for "1.500,00" etc (pt-BR)
  if (s.includes(",") && s.match(/^\d{1,3}(\.\d{3})*,\d{2}$/)) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  // se for "1500.00" ou "1500"
  if (!/^\d+$/.test(s)) {
    const num = Number(s);
    return Number.isFinite(num) ? num : 0;
  }

  // só dígitos: pode ser reais OU centavos
  const raw = Number(s);
  if (!Number.isFinite(raw)) return 0;

  const asReais = raw;       // 20000 -> 20000.00
  const asCentavos = raw/100; // 20000 -> 200.00

  // se tiver previsto, escolhe o mais próximo dele
  const vp = (typeof previsto === "number" && Number.isFinite(previsto)) ? previsto : null;
  if (vp !== null) {
    const dReais = Math.abs(asReais - vp);
    const dCent = Math.abs(asCentavos - vp);
    return dReais <= dCent ? asReais : asCentavos;
  }

  // sem previsto: preferir reais (evita o seu caso 20.000 virar 200)
  return asReais;
}

function normalizeForma(fp) {
  const raw = String(fp || "").trim();
  if (!raw) return "—";
  const v = raw.toUpperCase().replace(/\s+/g, "");

  // aceita variações comuns
  if (v === "AVISTA" || v === "A_VISTA" || v === "ÀVISTA") return "À vista";
  if (v === "PARCELADO") return "Parcelado";
  if (v === "ENTRADA+PARCELAS" || v === "ENTRADA_PARCELAS" || v === "ENTRADAPARCELAS") return "Entrada + Parcelas";

  // se já vier humanizado, só capitaliza padrão
  const h = raw.toLowerCase();
  if (h.includes("vista")) return "À vista";
  if (h.includes("entrada") && h.includes("parc")) return "Entrada + Parcelas";
  if (h.includes("parc")) return "Parcelado";

  return raw;
}

function getContratoNumeroRef(c) {
  if (!c) return "";
  return c?.numeroContrato ?? c?.numero ?? c?.numero_ref ?? c?.id ?? "";
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

// Normaliza datas para evitar efeito D-1 quando o backend manda DateTime em UTC (ex.: 2025-12-27T00:00:00.000Z)
// - Se vier "DD/MM/AAAA" -> parse local
// - Se vier "YYYY-MM-DD" (ou começar assim) -> trata como data-only local
// - Caso geral -> Date() e normaliza para 12:00 local
function toDateOnlyNoonLocal(v) {
  if (!v) return null;

  // DD/MM/AAAA
  const s = String(v).trim();
  const mBR = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mBR) {
    const dd = Number(mBR[1]);
    const mm = Number(mBR[2]);
    const yyyy = Number(mBR[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (!Number.isFinite(d.getTime())) return null;
    return d;
  }

  // YYYY-MM-DD (ou prefixo)
  const mISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mISO) {
    const yyyy = Number(mISO[1]);
    const mm = Number(mISO[2]);
    const dd = Number(mISO[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    if (!Number.isFinite(d.getTime())) return null;
    return d;
  }

  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function computeStatusContrato(c) {
  if (!c) return "EM_DIA";

  // PRIORIDADE (regra de negócio):
  // 1) Renegociado prevalece sobre Cancelado (quando todas as parcelas foram canceladas por renegociação)
  if (c.renegociadoParaId || c?.renegociadoPara?.id) return "RENEGOCIADO";

  const parcelas = c.parcelas || [];
  if (!parcelas.length) return "EM_DIA";

  const allCanceladas = parcelas.every((p) => p.status === "CANCELADA");
  if (allCanceladas) return "CANCELADO";

  const allEncerradas = parcelas.every((p) => p.status === "RECEBIDA" || p.status === "CANCELADA");
  if (allEncerradas) return "QUITADO";

  const pendentes = parcelas.filter((p) => p.status === "PREVISTA");
  const ref = todayAtNoonLocal().getTime();
  const atrasada = pendentes.some((p) => {
    const v = toDateOnlyNoonLocal(p.vencimento);
    if (!v) return false;
    return v.getTime() < ref;
  });

  return atrasada ? "ATRASADO" : "EM_DIA";
}

function statusToBadge(st) {
  const s = st || "EM_DIA";
  if (s === "ATRASADO") return { label: "Atrasado", tone: "red" };
  if (s === "QUITADO") return { label: "Quitado", tone: "green" };
  if (s === "CANCELADO") return { label: "Cancelado", tone: "slate" };
  if (s === "RENEGOCIADO") return { label: "Renegociado", tone: "amber" };
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

function bpToPercentString(bp) {
  const v = Number(bp || 0) / 100;
  // 1000 bp => "10,00"
  return v.toFixed(2).replace(".", ",");
}

function percentStringToBp(s) {
  const raw = String(s ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100); // 10.00 => 1000
}

// Máscara de % igual à usada em Pagamentos Avulsos:
// recebe "2000" => "20,00"
function percentMask(value) {
  const d = onlyDigits(value);
  if (!d) return "";
  const n = Number(d) / 100;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* =========================
   Page
========================= */
function labelDestino(tipo) {
  const t = String(tipo || "").toUpperCase();

  if (t === "INDICACAO") return "Indicação";
  if (t === "SOCIO") return "Advogado";
  if (t === "FUNDO_RESERVA") return "Fundo de Reserva";
  if (t === "ESCRITORIO") return "Escritório";

  return tipo || "—";
}

export default function ContratoPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [contrato, setContrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  
  const [paiNumeroReal, setPaiNumeroReal] = useState("");
  const [filhoNumeroReal, setFilhoNumeroReal] = useState("");

  const [renegChain, setRenegChain] = useState([]); // [{ id, numero }]
  const [ultimoFilhoId, setUltimoFilhoId] = useState(null);
  const [ultimoFilhoNumero, setUltimoFilhoNumero] = useState("");

  const [prevLink, setPrevLink] = useState(null); // { id, numero }
  const [nextLink, setNextLink] = useState(null); // { id, numero }

  const [repasseSplitDraft, setRepasseSplitDraft] = useState({}); 
  // { [idx]: "20,00" } — guarda o texto enquanto o usuário digita    

  // Receber
  const [receberOpen, setReceberOpen] = useState(false);
  const [receberParcela, setReceberParcela] = useState(null);
  const [recValorDigits, setRecValorDigits] = useState("");
  const [recData, setRecData] = useState("");
  const [recDataISO, setRecDataISO] = useState("");
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
  const [retErrMsg, setRetErrMsg] = useState("");

  /* =========================
        REPASSE (states)
  ========================= */
  const [modelosDistribuicao, setModelosDistribuicao] = useState([]);
  const [advogadosDisponiveis, setAdvogadosDisponiveis] = useState([]);

  // cache de itens por modelo (porque /modelo-distribuicao pode vir sem itens)
  const [itensByModeloId, setItensByModeloId] = useState({});

  const [repasseModeloId, setRepasseModeloId] = useState(null);
  const [repasseUsaSplit, setRepasseUsaSplit] = useState(false);
  const [repasseAdvPrincipalId, setRepasseAdvPrincipalId] = useState(null);

  // ✅ indicação (modelo com destinoTipo INDICACAO)
  const [repasseIndicacaoAdvogadoId, setRepasseIndicacaoAdvogadoId] = useState(null);

  // splits: [{ advogadoId, percentualBp }]
  const [repasseSplits, setRepasseSplits] = useState([]);

  const [repasseSaving, setRepasseSaving] = useState(false);
  const [repasseError, setRepasseError] = useState(null);
  const [repasseOk, setRepasseOk] = useState(null);

  const [repasseEditMode, setRepasseEditMode] = useState(true); // começa editável; depois a gente ajusta no load

// %SOCIO do modelo selecionado (em bp)
const repasseSocioBp = useMemo(() => {
  if (!repasseModeloId) return 0;
  const idNum = Number(repasseModeloId);
  const itens = itensByModeloId[idNum] || [];
  if (!Array.isArray(itens) || !itens.length) return 0;

  // tenta nos 3 campos possíveis (mesma lógica do Avulso)
  const itemSocio = itens.find((it) => {
    const a = String(it.destinoTipo || "").toUpperCase();
    const b = String(it.destinatario || "").toUpperCase();
    const c = String(it.destino || "").toUpperCase();
    return a === "SOCIO" || b === "SOCIO" || c === "SOCIO";
  });

  const bp = itemSocio ? Number(itemSocio.percentualBp) : 0;
  return Number.isFinite(bp) ? bp : 0;
}, [repasseModeloId, itensByModeloId]);

// soma dos splits do repasse (em bp) — usa percentualBp já calculado
const repasseSomaSplitsBp = useMemo(() => {
  if (!repasseUsaSplit) return 0;
  return (repasseSplits || []).reduce((acc, r) => {
    const bp = Number(r?.percentualBp);
    if (!Number.isFinite(bp) || bp <= 0) return acc;
    return acc + bp;
  }, 0);
}, [repasseUsaSplit, repasseSplits]);

const repasseSplitExcede = repasseUsaSplit && repasseSomaSplitsBp > repasseSocioBp;

// itens do modelo selecionado (para regras além de SOCIO, ex.: INDICACAO)
const repasseModeloItens = useMemo(() => {
  const idNum = repasseModeloId ? Number(repasseModeloId) : null;
  if (!idNum) return [];
  return itensByModeloId[idNum] || [];
}, [repasseModeloId, itensByModeloId]);

const repasseExigeIndicacao = useMemo(() => {
  return (repasseModeloItens || []).some(
    (it) => String(it?.destinoTipo || "").toUpperCase() === "INDICACAO"
  );
}, [repasseModeloItens]);

  async function load() {
    try {
      setLoading(true);
      setErrMsg("");
      const data = await apiFetch(`/contratos/${id}`);
      setContrato(data);
    } catch (e) {
      setErrMsg(e?.message || "Erro ao carregar contrato.");
    } finally {
      setLoading(false);
    }
  }
function repasseAddSplitRow() {
  setRepasseSplits((prev) => [...prev, { advogadoId: "", percentualBp: 0 }]);
}

function repasseRemoveSplitRow(index) {
  setRepasseSplits((prev) => prev.filter((_, i) => i !== index));
  setRepasseSplitDraft((prev) => {
    const next = {};
    // reindexa porque os idx mudam quando remove
    Object.keys(prev).forEach((k) => {
      const i = Number(k);
      if (i < index) next[i] = prev[i];
      if (i > index) next[i - 1] = prev[i];
    });
    return next;
  });
}

function repasseUpdateSplit(index, patch) {
  setRepasseSplits((prev) =>
    prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
  );
}

async function salvarRepasseConfig() {
  setRepasseSaving(true);
  setRepasseError(null);
  setRepasseOk(null);

  try {
    // validações de UI (além das do backend)
    if (!repasseModeloId) {
      throw new Error("Selecione um Modelo de Distribuição.");
    }

    if (repasseExigeIndicacao && !repasseIndicacaoAdvogadoId) {
      throw new Error("Selecione o Advogado de Indicação (obrigatório para este modelo).");
    }

    if (!repasseUsaSplit) {
      if (!repasseAdvPrincipalId) {
        throw new Error("Sem split: selecione o Advogado Principal do repasse.");
      }
    } else {
      const norm = repasseSplits
        .map((r) => ({
          advogadoId: Number(r.advogadoId),
          percentualBp: Number(r.percentualBp),
        }))
        .filter((r) => Number.isFinite(r.advogadoId) && Number.isFinite(r.percentualBp) && r.percentualBp > 0);

      if (norm.length < 2) {
        throw new Error("Split ativado: informe ao menos 2 advogados com percentual (>0).");
      }
    }

    const body = {
      modeloDistribuicaoId: Number(repasseModeloId),
      usaSplitSocio: Boolean(repasseUsaSplit),
      advogadoPrincipalId: repasseUsaSplit ? null : Number(repasseAdvPrincipalId),
      indicacaoAdvogadoId: repasseIndicacaoAdvogadoId,
      splits: repasseUsaSplit
        ? repasseSplits.map((r) => ({
            advogadoId: Number(r.advogadoId),
            percentualBp: Number(r.percentualBp),
          }))
        : [],
    };

    await apiFetch(`/contratos/${contrato.id}/repasse-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body,
    });

    setRepasseOk("Configuração de repasse salva.");

    // 🧼 limpa estados temporários após salvar
    setRepasseError(null);
    setRepasseSplitDraft({});
    setRepasseEditMode(false);

    // limpa estados temporários e trava em modo leitura
    setRepasseError(null);
    setRepasseSplitDraft({});
    setRepasseEditMode(false);

    await load();
  } catch (e) {
    setRepasseError(e?.message || "Erro ao salvar configuração de repasse.");
  } finally {
    setRepasseSaving(false);
  }
}
  // vínculos pai/filho (renegociações)
  const paiId = 
     contrato?.renegociadoDeId ??
     contrato?.contratoOrigemId ??
     contrato?.origemContratoId ??
     contrato?.contratoOriginalId ??
     contrato?.contratoPai ??
     contrato?.contratoPai?.id ??
     contrato?.contratoPaiId ??
     contrato?.paiId ??
     contrato?.pai?.id ??
     contrato?.renegociadoDe?.id ??
     null;

  const paiNumero = getContratoNumeroRef(contrato?.renegociadoDe ?? contrato?.pai ?? contrato?.contratoPai) || (paiId ? String(paiId) : "");

  const filhoId = contrato?.renegociadoParaId ?? contrato?.contratoFilhoId ?? contrato?.filhoId ?? contrato?.filho?.id ?? contrato?.renegociadoPara?.id ?? null;
  const filhoNumero = getContratoNumeroRef(contrato?.renegociadoPara ?? contrato?.filho ?? contrato?.contratoFilho) || (filhoId ? String(filhoId) : "");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

useEffect(() => {
  let alive = true;

  async function buildChainAndNeighbors() {
    try {
      if (!contrato?.id) {
        setRenegChain([]);
        setPrevLink(null);
        setNextLink(null);
        return;
      }

      const visited = new Set();

      // 1) achar o ROOT (original): sobe pelo paiId até não ter mais
      let root = contrato;
      let guard = 0;

      while (true) {
        const pid =
          root?.renegociadoDeId ??
          root?.contratoOrigemId ??
          root?.origemContratoId ??
          root?.contratoOriginalId ??
          root?.contratoPaiId ??
          root?.paiId ??
          root?.pai?.id ??
          root?.renegociadoDe?.id ??
          null;

        if (!pid) break;
        if (visited.has(pid) || guard++ > 20) break;
        visited.add(pid);

        const p = await apiFetch(`/contratos/${pid}`);
        if (!alive) return;
        root = p;
      }

      // 2) descer: root -> renegociadoParaId -> ... até acabar
      const chain = [];
      let cur = root;
      let guard2 = 0;
      const visited2 = new Set();

      while (cur?.id && !visited2.has(cur.id) && guard2++ < 25) {
        visited2.add(cur.id);
        chain.push({ id: cur.id, numero: getContratoNumeroRef(cur) || String(cur.id), raw: cur });

        const nextId = cur?.renegociadoParaId ?? cur?.renegociadoPara?.id ?? null;
        if (!nextId) break;

        const nx = await apiFetch(`/contratos/${nextId}`);
        if (!alive) return;
        cur = nx;
      }

      if (!alive) return;

      setRenegChain(chain);

      // 3) vizinhos do contrato atual na cadeia
      const idx = chain.findIndex((x) => String(x.id) === String(contrato.id));
      const prev = idx > 0 ? chain[idx - 1] : null;
      const next = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;

      setPrevLink(prev ? { id: prev.id, numero: prev.numero } : null);
      setNextLink(next ? { id: next.id, numero: next.numero } : null);
    } catch {
      if (!alive) return;
      // fallback seguro: mantém o básico sem quebrar
      setRenegChain([]);
      setPrevLink(null);
      setNextLink(null);
    }
  }

  buildChainAndNeighbors();
  return () => {
    alive = false;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [contrato?.id]);

useEffect(() => {
  let alive = true;

  async function fetchRefs() {
    try {
      // pai
      if (paiId && !paiNumeroReal) {
        const p = await apiFetch(`/contratos/${paiId}`);
        if (!alive) return;
        setPaiNumeroReal(getContratoNumeroRef(p) || "");
      }

      // filho
      if (filhoId && !filhoNumeroReal) {
        const f = await apiFetch(`/contratos/${filhoId}`);
        if (!alive) return;
        setFilhoNumeroReal(getContratoNumeroRef(f) || "");
      }
    } catch {
      // silêncio: se não vier, segue mostrando id sem quebrar
    }
  }

  fetchRefs();
  return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [paiId, filhoId]);

// Carrega modelos + advogados (admin-only)
useEffect(() => {
  (async () => {
    try {
      const m = await apiFetch("/modelo-distribuicao");
      setModelosDistribuicao(Array.isArray(m) ? m : []);
    } catch (e) {
      console.error(e);
    }
    try {
      const a = await apiFetch("/advogados");
      // opcional: filtrar ativos, se houver campo "ativo"
      setAdvogadosDisponiveis(Array.isArray(a) ? a : []);
    } catch (e) {
      console.error(e);
    }
  })();
}, []);

async function ensureModeloItens(modeloId) {
  const idNum = Number(modeloId);
  if (!Number.isFinite(idNum)) return;
  if (itensByModeloId[idNum]) return; // cache

  try {
    const itens = await apiFetch(`/modelo-distribuicao/${idNum}/itens`);
    setItensByModeloId((prev) => ({ ...prev, [idNum]: Array.isArray(itens) ? itens : [] }));
  } catch (e) {
    console.error("Erro ao carregar itens do modelo", e);
    setItensByModeloId((prev) => ({ ...prev, [idNum]: [] }));
  }
}

// quando escolhe um modelo no REPASSE, busca os itens dele (1x) para calcular SOCIO corretamente
useEffect(() => {
  (async () => {
    try {
      const idNum = repasseModeloId ? Number(repasseModeloId) : null;
      if (!idNum) return;
      if (itensByModeloId[idNum]) return; // já cacheado

      const itens = await apiFetch(`/modelo-distribuicao/${idNum}/itens`);
      setItensByModeloId((m) => ({ ...m, [idNum]: Array.isArray(itens) ? itens : [] }));
    } catch (e) {
      console.error(e);
      // não quebra UI; deixa socioBp = 0 até conseguir carregar
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [repasseModeloId]);

// Quando o contrato carregar/atualizar, popula o card SOMENTE se já existir config/splits salvos.
// (evita abrir o card já “selecionado” sem o usuário ter configurado)
useEffect(() => {
  if (!contrato) return;

  const hasSplits = Array.isArray(contrato.repasseSplits) && contrato.repasseSplits.length > 0;
  const hasAdv = !!(contrato.repasseAdvogadoPrincipalId || contrato?.repasseAdvogadoPrincipal?.id);
  const hasModelo = !!(contrato.repasseConfig?.modeloDistribuicaoId || contrato.modeloDistribuicaoId);

  // Se não tem nada salvo/configurado, deixa o card “em branco”
  if (!hasSplits && !hasAdv && !hasModelo) {
    setRepasseModeloId(null);
    setRepasseUsaSplit(false);
    setRepasseAdvPrincipalId(null);
    setRepasseSplits([]);
    setRepasseSplitDraft({});
    return;
  }

  // se já existe alguma configuração, abre em modo leitura; se não existe, abre em edição
  setRepasseEditMode(!(hasSplits || hasAdv || hasModelo));

  // Se já existe algo, aí sim carrega para edição
  setRepasseModeloId(
    contrato.repasseConfig?.modeloDistribuicaoId ??
    contrato.modeloDistribuicaoId ??
    null
  );

  if (contrato.modeloDistribuicaoId) {
    ensureModeloItens(contrato.modeloDistribuicaoId);
  }
  setRepasseIndicacaoAdvogadoId(contrato.repasseIndicacaoAdvogadoId ?? null);

  setRepasseUsaSplit(Boolean(contrato.usaSplitSocio));

  setRepasseAdvPrincipalId(
    contrato.repasseAdvogadoPrincipalId ??
    contrato?.repasseAdvogadoPrincipal?.id ??
    null
  );

  const splitsRaw = Array.isArray(contrato.repasseSplits) ? contrato.repasseSplits : [];
  setRepasseSplits(
    splitsRaw.map((s) => ({
      advogadoId: s.advogadoId,
      percentualBp: s.percentualBp,
    }))
  );
}, [contrato]);

  const contratoNumero = useMemo(() => getContratoNumeroRef(contrato), [contrato]);

  const parcelas = contrato?.parcelas || [];
  const previstas = useMemo(() => parcelas.filter((p) => p.status === "PREVISTA"), [parcelas]);
  const podeRetificarAlguma = previstas.length >= 2;

  const stContrato = useMemo(() => computeStatusContrato(contrato), [contrato]);
  const stBadge = useMemo(() => statusToBadge(stContrato), [stContrato]);
  const contratoTravado = stContrato === "QUITADO" || stContrato === "RENEGOCIADO" || stContrato === "CANCELADO";

const totalRecebido = useMemo(() => {
  return (parcelas || [])
    .filter((p) => p.status === "RECEBIDA")
    .reduce((acc, p) => {
      const vr = p?.valorRecebido;
      const vp = p?.valorPrevisto;
      const usado = (vr !== null && vr !== undefined && vr !== "") ? vr : vp;
      return acc + parseBRLHeuristic(usado, vp);
    }, 0);
}, [parcelas]);

  const renegInfoObs = useMemo(() => {
    const base = String(contrato?.observacoes || "").trim();
    const parts = [];
    if (base) parts.push(base);

    // Se este contrato é FILHO (tem pai)
    if (paiId) {
      const txt = `Renegociação: Este contrato foi criado a partir do saldo pendente do contrato ${paiNumeroReal || paiNumero || paiId}. Cliente, número e valor total são calculados automaticamente.`;
      const already = base.toLowerCase().includes("renegocia") && base.includes(`${paiNumero || paiId}`);
      if (!already) parts.push(txt);
    }

    // Se este contrato é PAI (tem filho)
    if (filhoId) {
      const txt = `Renegociação: Este contrato originou o contrato ${filhoNumeroReal || filhoNumero || filhoId}.`;
      const already = base.toLowerCase().includes("originou") && base.includes(`${filhoNumero || filhoId}`);
      if (!already) parts.push(txt);
    }

    return parts.filter(Boolean).join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato?.observacoes, paiId, paiNumero, paiNumeroReal, filhoId, filhoNumero, filhoNumeroReal]);

  function openReceber(p) {
    setReceberParcela(p);
    const n = Number(p?.valorPrevisto);
    setRecValorDigits(Number.isFinite(n) ? String(Math.round(n * 100)) : "");
    setRecData(toDDMMYYYY(new Date()));
    setRecMeio("PIX");
    setRecSenha("");
    setReceberOpen(true);

    const todayISO = new Date().toISOString().slice(0, 10);
    setRecDataISO(todayISO);
    setRecData(todayISO.split("-").reverse().join("/"));

  }

  function openRetificar(p) {
  setRetParcela(p);
  const n = Number(p?.valorPrevisto);
  setRetValorDigits(Number.isFinite(n) ? String(Math.round(n * 100)) : "");
  setRetVenc(p?.vencimento ? toDDMMYYYY(p.vencimento) : "");
  setRetMotivo("");
  setRetSenha("");
  setRatear(false); // 🔴 DEFAULT: NÃO ratear
  setRetErrMsg("");

  const others = {};
  const previstasOrdenadas = previstas.filter((x) => x.id !== p.id);

  previstasOrdenadas.forEach((op) => {
    const nn = Number(op?.valorPrevisto);
    others[op.id] = Number.isFinite(nn) ? String(Math.round(nn * 100)) : "";  
  });

  setManualOutros(
    recomputeManualOutrosForDefaultCompensacao(
      String(Math.round(Number(p.valorPrevisto) * 100)),
      p,
      previstas,
      others
    )
  );
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

      await apiFetch(`/parcelas/${receberParcela.id}/confirmar`, {
        method: "PATCH",
        body: {
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
 function recomputeManualOutrosForDefaultCompensacao(nextRetValorDigits, alvoParcela, previstasList, prevManualOutros) {
  if (!alvoParcela) return prevManualOutros;

  const alvoAtual = Number.isFinite(Number(alvoParcela.valorPrevisto))
    ? Math.round(Number(alvoParcela.valorPrevisto) * 100)
    : 0;

  const alvoNovo = Number(onlyDigits(nextRetValorDigits || "0")); // centavos
  const delta = alvoNovo - alvoAtual; // centavos

  // outras previstas (exceto alvo)
  const outras = (previstasList || []).filter((p) => p.id !== alvoParcela.id);
  if (!outras.length) return prevManualOutros;

  const primeira = outras[0];

  // valores atuais em centavos
  const atualMap = {};
  for (const p of outras) {
    const vp = Number.isFinite(Number(p.valorPrevisto)) ? Math.round(Number(p.valorPrevisto) * 100) : 0;
    atualMap[p.id] = String(vp);
  }

  // aplica compensação toda na primeira: after = before - delta
  const beforePrimeira = Number(atualMap[primeira.id] || "0");
  const afterPrimeira = beforePrimeira - delta;

  // não deixa <= 0 (deixa o backend também travar, mas já evita UX ruim)
  if (afterPrimeira <= 0) {
    return {
      ...atualMap,
      [primeira.id]: String(Math.max(0, afterPrimeira)),
    };
  }

  return {
    ...atualMap,
    [primeira.id]: String(afterPrimeira),
  };
}
  async function submitRetificar() {
    if (!retParcela) return;
    try {
      setRetErrMsg("");

      const motivo = String(retMotivo || "").trim();
      if (!motivo) return setRetErrMsg("Informe o motivo da retificação.");

      const patch = {};
      if (retVenc) patch.vencimento = retVenc;
      if (retValorDigits) patch.valorPrevisto = onlyDigits(retValorDigits);

      if (!Object.keys(patch).length) return setRetErrMsg("Nada para retificar.");

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
          return setRetErrMsg("Soma dos valores das demais parcelas não fecha com o total do contrato. Ajuste os valores ou renegocie.");
        }
      }

      await apiFetch(`/parcelas/${retParcela.id}/retificar`, {
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
  setRetErrMsg(e?.message || "Erro ao salvar retificação.");
}
  }

  function closeModals() {
    setReceberOpen(false);
    setReceberParcela(null);
    setRetOpen(false);
    setRetParcela(null);
    setRetErrMsg("");
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
            Voltar
          </button>
          <Link to="/pagamentos" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
            Pagamentos
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {!contratoTravado && (
            <button
              onClick={() => navigate(`/pagamentos?renegociar=${contrato?.id}`)}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
              title="Renegociar contrato"
            >
              Renegociar Contrato
            </button>
          )}

          <Badge tone={stBadge.tone}>{stBadge.label}</Badge>
        </div>
      </div>

      {errMsg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{errMsg}</div>
      )}

      <Card
        title={`Contrato ${contratoNumero || ""}`}
        right={
          <div className="text-xs text-slate-500">
            Criado em: <span className="font-medium text-slate-700">{toDDMMYYYY(contrato?.createdAt)}</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Cliente</div>
            <div className="text-sm font-semibold text-slate-900">
              {contrato?.cliente?.nome ||
                contrato?.cliente?.nomeRazaoSocial ||
                contrato?.cliente?.nomeCompleto ||
                contrato?.cliente?.razaoSocial ||
                contrato?.clienteNome ||
                contrato?.nomeCliente ||
                "—"}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Valor Total</div>
                <div className="text-sm font-semibold text-slate-900">
                  R$ {formatBRLFromDecimal(contrato?.valorTotal)}
                </div>
              </div>

              <div className="min-w-0 text-right">
                <div className="text-xs text-slate-500">Valor recebido</div>
                <div className="text-sm font-semibold text-slate-900">
                  R$ {formatBRLFromDecimal(totalRecebido)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Forma de pagamento</div>
            <div className="text-sm font-semibold text-slate-900">{normalizeForma(contrato?.formaPagamento)}</div>
          </div>

        {(paiId || filhoId) ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-1">
            <div className="text-xs font-semibold text-slate-600">Vínculos de renegociação</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {prevLink ? (
  <Link
    to={`/contratos/${prevLink.id}`}
    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
    title="Voltar uma etapa"
  >
    ← {prevLink.numero}
  </Link>
) : null}

{nextLink ? (
  <Link
    to={`/contratos/${nextLink.id}`}
    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
    title="Avançar uma etapa"
  >
    {nextLink.numero} →
  </Link>
) : null}

{renegChain.length > 1 ? (
  <div className="w-full pt-2 text-xs text-slate-500">
    Histórico:&nbsp;
    {renegChain
      .filter((x) => String(x.id) !== String(contrato?.id))
      .map((x, idx, arr) => (
        <span key={x.id}>
          <Link to={`/contratos/${x.id}`} className="font-semibold hover:underline">
            {x.numero}
          </Link>
          {idx < arr.length - 1 ? " · " : ""}
        </span>
      ))}
  </div>
) : null}

            </div>
          </div>
        ) : null}

        {renegInfoObs ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
            <div className="text-xs font-semibold text-slate-600">Observações</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{renegInfoObs}</div>
          </div>
        ) : null}
        </div>
      </Card>

      {/* =========================
             CARD — REPASSE
      ========================= */}
      <Card title="Repasse">
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {/* ESQUERDA — form */}
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* linha Modelo + Split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label className="text-xs text-slate-600">Modelo de Distribuição</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={repasseModeloId ?? ""}
            disabled={!repasseEditMode}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setRepasseModeloId(v);

              // ao trocar modelo, zera splits/draft para evitar validação “fantasma”
              setRepasseSplits([]);
              setRepasseSplitDraft({});
              if (!repasseUsaSplit) setRepasseAdvPrincipalId(null);
              setRepasseIndicacaoAdvogadoId(null);
            }}
          >
            <option value="">— Selecione —</option>
            {modelosDistribuicao.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo
                  ? `${m.codigo} — ${m.descricao || ""}`
                  : m.descricao || `Modelo #${m.id}`}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 18 }}>
          <input
            type="checkbox"
            checked={repasseUsaSplit}
            disabled={!repasseEditMode}
            onChange={(e) => {
              const checked = e.target.checked;
              setRepasseUsaSplit(checked);

              // se ativar split, limpa advogado único; se desativar, limpa tabela de splits
              if (checked) {
                setRepasseAdvPrincipalId(null);
              } else {
                setRepasseSplits([]);
                setRepasseSplitDraft({});
              }
            }}
          />
          <span className="text-sm">Split</span>
        </div>
      </div>

      {/* Advogado (sem split) — tirar “Principal” */}
      {!repasseUsaSplit && (
        <div>
          <label className="text-xs text-slate-600">Advogado</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={repasseAdvPrincipalId ?? ""}
            disabled={!repasseEditMode}
            onChange={(e) => setRepasseAdvPrincipalId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Selecione —</option>
            {advogadosDisponiveis.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Splits (sobre a cota do SÓCIO) */}
      {repasseUsaSplit && (
        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Splits</div>

            {repasseEditMode && (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  setRepasseSplits((prev) => [
                    ...(prev || []),
                    { advogadoId: "", percentualBp: 0 },
                  ]);
                }}
              >
                + Adicionar advogado
              </button>
            )}
          </div>

          <div className="mt-2" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(repasseSplits || []).map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={row.advogadoId ?? ""}
                  disabled={!repasseEditMode}
                  onChange={(e) =>
                    repasseUpdateSplit(idx, {
                      advogadoId: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                >
                  <option value="">— advogado —</option>
                  {advogadosDisponiveis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>

                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  inputMode="numeric"
                  placeholder="20,00"
                  value={repasseSplitDraft[idx] ?? bpToPercentString(row.percentualBp)}
                  disabled={!repasseEditMode}
                  onChange={(e) => {
                    const masked = percentMask(e.target.value); // mesma máscara do Avulso
                    setRepasseSplitDraft((prev) => ({ ...prev, [idx]: masked }));

                    // atualiza bp em tempo real para validar/disable botão
                    repasseUpdateSplit(idx, { percentualBp: percentStringToBp(masked) });
                  }}
                  onBlur={() => {
                    const raw = repasseSplitDraft[idx];
                    if (raw == null) return;

                    repasseUpdateSplit(idx, { percentualBp: percentStringToBp(raw) });
                    setRepasseSplitDraft((prev) => {
                      const next = { ...prev };
                      delete next[idx];
                      return next;
                    });
                  }}
                />

                {repasseEditMode && (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => repasseRemoveSplitRow(idx)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}

            {/* validação igual Avulso (NÃO remover) */}
            {repasseSplitExcede && (
              <div className="text-sm" style={{ color: "#b91c1c" }}>
                A soma dos splits ({(repasseSomaSplitsBp / 100).toFixed(2).replace(".", ",")}%)
                excede o percentual definido no modelo aplicado ({(repasseSocioBp / 100).toFixed(2).replace(".", ",")}%).
              </div>
            )}
          </div>
        </div>
      )}

      {/* Indicação (quando o modelo exigir INDICACAO) */}
      {repasseExigeIndicacao && (
        <div>
          <label className="text-xs text-slate-600"><strong>Indicação</strong></label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={repasseIndicacaoAdvogadoId ?? ""}
            disabled={!repasseEditMode}
            onChange={(e) => setRepasseIndicacaoAdvogadoId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Selecione —</option>
            {advogadosDisponiveis.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <div className="mt-1 text-xs text-slate-500">
            Obrigatório para este modelo (destinoTipo = INDICACAO).
          </div>
        </div>
      )}

      {repasseError && <div style={{ color: "crimson" }}>{repasseError}</div>}
      {repasseOk && <div style={{ color: "green" }}>{repasseOk}</div>}

      {/* ações (Editar/Cancelar/Salvar) — garante que NÃO some */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {!repasseEditMode ? (
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            onClick={() => {
              setRepasseOk(null);
              setRepasseError(null);
              setRepasseEditMode(true);
            }}
          >
            Editar
          </button>
        ) : (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={async () => {
                setRepasseOk(null);
                setRepasseError(null);
                setRepasseSplitDraft({});
                setRepasseEditMode(false);
                await load(); // 🔁 volta exatamente ao estado do backend
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarRepasseConfig}
              disabled={repasseSaving || repasseSplitExcede || !repasseEditMode}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              title={
                repasseSplitExcede
                  ? "Ajuste os splits para não exceder o % do SÓCIO do modelo."
                  : ""
              }
            >
              {repasseSaving ? "Salvando..." : "Salvar"}
            </button>
          </>
        )}
      </div>
    </div>

    {/* DIREITA — modelo (read-only) */}
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-600">Modelo de Distribuição</div>

      <div className="mt-1 text-sm font-semibold text-slate-900">
        {(() => {
          const m = (modelosDistribuicao || []).find((x) => Number(x.id) === Number(repasseModeloId));
          return m ? `${m.codigo || m.cod || ""} — ${m.descricao || ""}` : "—";
        })()}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="border-b">
              <th className="py-2 px-3">Destino</th>
              <th className="py-2 px-3">%</th>
            </tr>
          </thead>
          <tbody>
            {(repasseModeloItens || []).map((it) => (
              <tr key={it.id} className="border-b last:border-b-0">
                <td className="py-2 px-3">                  
                  {labelDestino(it.destinoTipo || it.destinatario)}
                </td>
                <td className="py-2 px-3">
                  {((Number(it.percentualBp || 0) / 100).toFixed(2)).replace(".", ",")}
                </td>
              </tr>
            ))}
            {(!repasseModeloItens || repasseModeloItens.length === 0) && (
              <tr>
                <td colSpan={2} className="py-3 px-3 text-slate-500">
                  Selecione um modelo para ver os itens.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
                        {!contratoTravado && st === "PREVISTA" && (
                          <button
                            onClick={() => openReceber(p)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                          >
                            Receber Parcela
                          </button>
                        )}

                        {!contratoTravado && podeRetificar && (
                          <button
                            onClick={() => openRetificar(p)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                          >
                            Retificar
                          </button>
                        )}
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
              <div className="text-sm font-semibold">Receber parcela {receberParcela?.numero}</div>
              <button className="text-slate-500" onClick={closeModals}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-xs text-slate-600">
                Valor recebido (R$)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={Number(receberParcela?.valorPrevisto || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  disabled
                />
                <div className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Valor fixo (igual ao previsto). Para receber valor diferente, use <span className="font-semibold">Retificar</span> (Admin).
                </div>
              </label>

              <label className="text-xs text-slate-600">
                Data de recebimento
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={recDataISO || ""}
                  onChange={(e) => {
                    const iso = e.target.value; // YYYY-MM-DD
                    setRecDataISO(iso);
                    setRecData(iso ? iso.split("-").reverse().join("/") : "");
                  }}
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
              <div className="text-sm font-semibold">Retificar parcela {retParcela?.numero}</div>
              <button className="text-slate-500" onClick={closeModals}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                Valor previsto (R$)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={maskBRLFromDigits(retValorDigits)}
                  onChange={(e) => {
                    const next = onlyDigits(e.target.value);
                    setRetValorDigits(next);

                    // se estiver no modo manual (não-rateio), propõe automaticamente a compensação
                    if (!ratear) {
                      setManualOutros((prev) =>
                        recomputeManualOutrosForDefaultCompensacao(next, retParcela, previstas, prev)
                      );
                    }

                    // limpa erro do modal quando o usuário mexe
                    if (retErrMsg) setRetErrMsg("");
                  }}
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
                <input type="checkbox" checked={ratear} onChange={(e) => {
                  const checked = e.target.checked;
                      setRatear(checked);
                      setRetErrMsg("");

                      // ao voltar para manual, repropoe a compensação padrão
                      if (!checked) {
                        setManualOutros((prev) =>
                        recomputeManualOutrosForDefaultCompensacao(retValorDigits, retParcela, previstas, prev)
                      );
                    }
                  }}
                />
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
                          Parcela {op.numero} (R$)
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

            {retErrMsg && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {retErrMsg}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                onClick={closeModals}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={submitRetificar}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
