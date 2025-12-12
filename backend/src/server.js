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

app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});
