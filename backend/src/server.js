import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Prisma
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

/* =========================
   DIRETRIZES — HELPERS
========================= */

function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

// Datas sempre DD/MM/AAAA (quando exibidas)
function formatDateBR(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Hora sempre HH:MM:SS (quando exibida)
function formatTimeBR(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Aceita data em DD/MM/AAAA, YYYY-MM-DD ou ISO
function parseDateInput(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  const s = String(input).trim();
  if (!s) return null;

  // DD/MM/AAAA
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD (input date)
  const isoShort = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoShort) {
    const yyyy = Number(isoShort[1]);
    const mm = Number(isoShort[2]);
    const dd = Number(isoShort[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ISO / demais formatos
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Valores sempre numéricos limpos
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Exibição BRL opcional (não usar para cálculo!)
function formatBRL(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Serializa registros sem quebrar contrato:
 * - mantém datas originais
 * - adiciona campos *BR* (DD/MM/AAAA) + *TimeBR* (HH:MM:SS)
 * - normaliza Decimals para Number em campos conhecidos
 */
function serializeCliente(c) {
  return {
    ...c,
    createdAtBR: formatDateBR(c.createdAt),
    updatedAtBR: formatDateBR(c.updatedAt),
    // telefone e cpfCnpj ficam “crus” (numéricos) no backend; máscara é do frontend
    ordens: Array.isArray(c.ordens) ? c.ordens.map(serializeOrdem) : c.ordens,
  };
}

function serializeOrdem(o) {
  const valorNum = toNumberOrNull(o.valorTotalPrevisto);
  return {
    ...o,
    createdAtBR: formatDateBR(o.createdAt),
    updatedAtBR: formatDateBR(o.updatedAt),
    dataInicioBR: formatDateBR(o.dataInicio),
    dataFimPrevistaBR: formatDateBR(o.dataFimPrevista),
    // valores limpos (Number) + exibível opcional
    valorTotalPrevisto: valorNum,
    valorTotalPrevistoBR: valorNum === null ? null : formatBRL(valorNum),
  };
}

/* =========================
   ROTAS
========================= */

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", message: "Controles-AMR backend ativo", db: "ok" });
  } catch (err) {
    console.error("Erro ao checar DB:", err);
    res.status(500).json({ status: "erro", message: "Falha ao acessar o banco" });
  }
});

// LISTAR CLIENTES
app.get("/api/clients", async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nomeRazaoSocial: "asc" },
    });

    // Adiciona campos BR sem quebrar
    res.json(clientes.map((c) => serializeCliente({ ...c, ordens: [] })));
  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
});

// LISTAR ORDENS DE PAGAMENTO
app.get("/api/orders", async (req, res) => {
  try {
    const ordens = await prisma.ordemPagamento.findMany({
      include: { cliente: true },
      orderBy: [{ clienteId: "asc" }, { sequenciaCliente: "asc" }],
    });

    res.json(
      ordens.map((o) => ({
        ...serializeOrdem(o),
        cliente: o.cliente ? serializeCliente({ ...o.cliente, ordens: [] }) : o.cliente,
      }))
    );
  } catch (err) {
    console.error("Erro ao listar ordens de pagamento:", err);
    res.status(500).json({ message: "Erro ao listar ordens de pagamento" });
  }
});

// LISTAR MODELOS DE DISTRIBUIÇÃO (A–G)
app.get("/api/config/distribution-models", async (req, res) => {
  try {
    const modelos = await prisma.modeloDistribuicao.findMany({
      orderBy: [{ codigo: "asc" }, { id: "asc" }],
    });
    res.json(modelos);
  } catch (err) {
    console.error("Erro ao listar modelos de distribuição:", err);
    res.status(500).json({ message: "Erro ao listar modelos de distribuição" });
  }
});

// Login (placeholder)
app.post("/api/auth/login", (req, res) => {
  res.status(501).json({ message: "Login ainda não implementado." });
});

// CRIAR CLIENTE + ORDEM (num tiro só)
app.post("/api/clients-and-orders", async (req, res) => {
  const { client, order } = req.body;

  if (!client || !order) {
    return res.status(400).json({
      message: "Payload inválido. Envie { client: {...}, order: {...} }",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let cliente;

      // Se veio client.id, usamos cliente existente
      if (client.id) {
        cliente = await tx.cliente.findUnique({ where: { id: client.id } });
        if (!cliente) throw new Error("Cliente informado não existe.");
      } else {
        // Normalizações básicas (backend guarda limpo)
        const cpfCnpj = client.cpfCnpj ? onlyDigits(client.cpfCnpj) : "";
        const telefone = client.telefone ? onlyDigits(client.telefone) : null;

        cliente = await tx.cliente.create({
          data: {
            cpfCnpj,
            nomeRazaoSocial: client.nomeRazaoSocial,
            email: client.email ?? null,
            telefone,
            observacoes: client.observacoes ?? null,
            ativo: true,
          },
        });
      }

      // próxima sequência por cliente
      const ultimaOrdem = await tx.ordemPagamento.findFirst({
        where: { clienteId: cliente.id },
        orderBy: { sequenciaCliente: "desc" },
      });
      const proximaSequencia = (ultimaOrdem?.sequenciaCliente ?? 0) + 1;

      // Datas: aceitar DD/MM/AAAA / YYYY-MM-DD / ISO
      const dataInicio = parseDateInput(order.dataInicio);
      const dataFimPrevista = parseDateInput(order.dataFimPrevista);

      // Valor: sempre numérico limpo
      const valor = toNumberOrNull(order.valorTotalPrevisto);

      const novaOrdem = await tx.ordemPagamento.create({
        data: {
          clienteId: cliente.id,
          sequenciaCliente: proximaSequencia,
          codigoInterno: order.codigoInterno ?? null,
          descricao: order.descricao ?? null,
          tipoContrato: order.tipoContrato ?? null,
          valorTotalPrevisto: valor,
          modeloPagamento: order.modeloPagamento,
          dataInicio: dataInicio ?? new Date(),
          dataFimPrevista,
          status: order.status ?? "ATIVA",
        },
      });

      return { cliente, ordem: novaOrdem };
    });

    // devolve com campos BR + valor numérico
    res.status(201).json({
      cliente: serializeCliente({ ...result.cliente, ordens: [] }),
      ordem: serializeOrdem(result.ordem),
    });
  } catch (err) {
    console.error("Erro ao criar cliente + ordem:", err);
    res.status(500).json({
      message: "Erro ao criar cliente e ordem de pagamento",
      error: err.message,
    });
  }
});

// LISTAGEM DE CLIENTES + ORDENS COM FILTROS
app.get("/api/clients-with-orders", async (req, res) => {
  // aceita aliases: q OU search
  const search = req.query.q ?? req.query.search;
  const status = req.query.status;
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;

  try {
    const whereClient = {};
    if (search) {
      whereClient.OR = [
        { nomeRazaoSocial: { contains: String(search), mode: "insensitive" } },
        { cpfCnpj: { contains: onlyDigits(String(search)) || String(search) } },
      ];
    }

    const whereOrder = {};
    if (status && status !== "ALL") whereOrder.status = status;

    if (fromDate || toDate) {
      whereOrder.dataInicio = {};

      const from = parseDateInput(fromDate);
      const to = parseDateInput(toDate);

      if (from) whereOrder.dataInicio.gte = from;

      if (to) {
        // inclui o dia inteiro
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        whereOrder.dataInicio.lte = end;
      }
    }

    const clientes = await prisma.cliente.findMany({
      where: whereClient,
      include: {
        ordens: {
          where: Object.keys(whereOrder).length ? whereOrder : undefined,
          orderBy: { sequenciaCliente: "asc" },
        },
      },
      orderBy: { nomeRazaoSocial: "asc" },
    });

    res.json(clientes.map(serializeCliente));
  } catch (err) {
    console.error("Erro ao listar clientes + ordens:", err);
    res.status(500).json({ message: "Erro ao listar clientes + ordens" });
  }
});

// DASHBOARD FINANCEIRO (RESUMO)
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const [totalClients, totalOrders, totalAtivas, totalConcluidas, sumValores] =
      await Promise.all([
        prisma.cliente.count(),
        prisma.ordemPagamento.count(),
        prisma.ordemPagamento.count({ where: { status: "ATIVA" } }),
        prisma.ordemPagamento.count({ where: { status: "CONCLUIDA" } }),
        prisma.ordemPagamento.aggregate({ _sum: { valorTotalPrevisto: true } }),
      ]);

    // normaliza soma para Number
    const totalValorPrevisto = toNumberOrNull(sumValores?._sum?.valorTotalPrevisto) ?? 0;

    // tentativa de groupBy opcional
    const ordensPorMes = await prisma.ordemPagamento
      .groupBy({
        by: ["anoMesInicio"],
        _count: { _all: true },
        _sum: { valorTotalPrevisto: true },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          // normaliza soma
          _sum: {
            ...r._sum,
            valorTotalPrevisto: toNumberOrNull(r?._sum?.valorTotalPrevisto) ?? 0,
          },
        }))
      )
      .catch(() => []);

    res.json({
      totalClients,
      totalOrders,
      totalAtivas,
      totalConcluidas,
      totalValorPrevisto,          // numérico limpo
      totalValorPrevistoBR: formatBRL(totalValorPrevisto), // exibição opcional
      ordensPorMes,
    });
  } catch (err) {
    console.error("Erro no dashboard:", err);
    res.status(500).json({ message: "Erro ao carregar dashboard" });
  }
});

app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});
