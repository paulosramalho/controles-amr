import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client"; // ⬅️ NOVO

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ⬅️ NOVO: instancia do Prisma
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/health", async (req, res) => {
  try {
    // testa rapidamente o banco
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
      orderBy: { nomeRazaoSocial: "asc" }
    });
    res.json(clientes);
  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
});

// LISTAR ORDENS DE PAGAMENTO
app.get("/api/orders", async (req, res) => {
  try {
    const ordens = await prisma.ordemPagamento.findMany({
      include: {
        cliente: true
      },
      orderBy: [
        { clienteId: "asc" },
        { sequenciaCliente: "asc" }
      ]
    });
    res.json(ordens);
  } catch (err) {
    console.error("Erro ao listar ordens de pagamento:", err);
    res.status(500).json({ message: "Erro ao listar ordens de pagamento" });
  }
});

// LISTAR MODELOS DE DISTRIBUIÇÃO (A–G)
app.get("/api/config/distribution-models", async (req, res) => {
  try {
    const modelos = await prisma.modeloDistribuicao.findMany({
      orderBy: [{ codigo: "asc" }, { id: "asc" }]
    });
    res.json(modelos);
  } catch (err) {
    console.error("Erro ao listar modelos de distribuição:", err);
    res.status(500).json({ message: "Erro ao listar modelos de distribuição" });
  }
});

// Login (placeholder)
app.post("/api/auth/login", (req, res) => {
  // TODO: validar usuário e senha usando tabela Usuario
  res.status(501).json({ message: "Login ainda não implementado." });
});

// CRIAR CLIENTE + ORDEM DE PAGAMENTO NUM TIRO SÓ
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

      // Se veio client.id, tentamos usar o cliente existente
      if (client.id) {
        cliente = await tx.cliente.findUnique({
          where: { id: client.id },
        });
        if (!cliente) {
          throw new Error("Cliente informado não existe.");
        }
      } else {
        // Senão, criamos o cliente
        cliente = await tx.cliente.create({
          data: {
            cpfCnpj: client.cpfCnpj,
            nomeRazaoSocial: client.nomeRazaoSocial,
            email: client.email ?? null,
            telefone: client.telefone ?? null,
            observacoes: client.observacoes ?? null,
            ativo: true,
          },
        });
      }

      // Obter última sequência de ordem para esse cliente
      const ultimaOrdem = await tx.ordemPagamento.findFirst({
        where: { clienteId: cliente.id },
        orderBy: { sequenciaCliente: "desc" },
      });

      const proximaSequencia = (ultimaOrdem?.sequenciaCliente ?? 0) + 1;

      // Criar nova ordem de pagamento
      const novaOrdem = await tx.ordemPagamento.create({
        data: {
          clienteId: cliente.id,
          sequenciaCliente: proximaSequencia,
          codigoInterno: order.codigoInterno ?? null,
          descricao: order.descricao ?? null,
          tipoContrato: order.tipoContrato ?? null,
          valorTotalPrevisto: order.valorTotalPrevisto
            ? Number(order.valorTotalPrevisto)
            : null,
          modeloPagamento: order.modeloPagamento, // "AVISTA" | "ENTRADA_E_PARCELAS" | "PARCELAS"
          dataInicio: order.dataInicio ? new Date(order.dataInicio) : null,
          dataFimPrevista: order.dataFimPrevista
            ? new Date(order.dataFimPrevista)
            : null,
          status: order.status ?? "ATIVA",
        },
      });

      return { cliente, ordem: novaOrdem };
    });

    res.status(201).json(result);

  } catch (err) {
    console.error("Erro ao criar cliente + ordem:", err);
    res.status(500).json({
      message: "Erro ao criar cliente e ordem de pagamento",
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});
