// backend/src/server.js
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// Helpers
// =========================
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function maskCpfCnpj(v) {
  const digits = String(v || "").replace(/\D/g, "");
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .padStart(11, "0")
      .replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, "$1.$2.$3-$4");
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .padStart(14, "0")
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
}

function parseMoneyInputToDecimalString(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;

  // aceita:
  // "123,45" (pt-BR)
  // "123.45" (en)
  // "R$ 1.234,56"
  // "123456" (centavos digitados) -> vira 1234.56
  // "3870" (Decimal) => 38.70  (padrão do app)
  const digitsOnly = s.replace(/\D/g, "");
  const hasSep = /[.,]/.test(s);

  if (!hasSep && digitsOnly.length) {
    // interpretando como centavos digitados
    const n = Number(digitsOnly);
    if (!Number.isFinite(n)) return null;
    const value = (n / 100).toFixed(2);
    return value;
  }

  // normaliza ptBR pra ponto decimal
  // remove milhares
  let normalized = s.replace(/[R$\s]/g, "");
  // se tiver ambos ponto e vírgula, assume ponto milhar e vírgula decimal
  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

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

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Não autenticado." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ message: "Não autenticado." });
  const u = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!u) return res.status(401).json({ message: "Usuário inválido." });
  if (u.tipoUsuario !== "ADMIN") {
    return res.status(403).json({ message: "Acesso negado." });
  }
  req.adminUser = u;
  return next();
}

// =========================
// Auth
// =========================
app.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ message: "Email e senha são obrigatórios." });

  const u = await prisma.usuario.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!u) return res.status(401).json({ message: "Credenciais inválidas." });

  const ok = await bcrypt.compare(String(senha), u.senhaHash);
  if (!ok) return res.status(401).json({ message: "Credenciais inválidas." });

  if (u.ativo === false) return res.status(403).json({ message: "Usuário inativo." });

  const token = jwt.sign({ id: u.id, tipoUsuario: u.tipoUsuario }, JWT_SECRET, { expiresIn: "7d" });
  return res.json({
    token,
    user: { id: u.id, nome: u.nome, email: u.email, tipoUsuario: u.tipoUsuario, ativo: u.ativo },
  });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!u) return res.status(401).json({ message: "Usuário inválido." });
  return res.json({ id: u.id, nome: u.nome, email: u.email, tipoUsuario: u.tipoUsuario, ativo: u.ativo });
});

// =========================
// Contratos / Parcelas
// =========================

/** Regras base:
 * - Datas sempre DD/MM/AAAA no input
 * - Valores no padrão do app: digitado em centavos (string de dígitos) OU decimal pt-BR
 */
function buildNumeroContrato(prefixDateYYYYMMDD, seq, sufixoLetra = "A") {
  const seqStr = String(seq).padStart(3, "0");
  return `${prefixDateYYYYMMDD}${seqStr}${sufixoLetra}`;
}

async function nextContratoSeq(prisma, yyyymmdd) {
  const like = `${yyyymmdd}%`;
  const last = await prisma.contratoPagamento.findFirst({
    where: { numero: { startsWith: like } },
    orderBy: { numero: "desc" },
  });
  if (!last) return 1;
  const m = String(last.numero).match(/^(\d{8})(\d{3})/);
  if (!m) return 1;
  return Number(m[2]) + 1;
}

/** Renegociação:
 * numero renegociado = NUMERO_ORIGINAL + "-R1", "-R2", ...
 */
async function nextRenegNumber(prisma, numeroOriginal) {
  const like = `${numeroOriginal}-R`;
  const last = await prisma.contratoPagamento.findFirst({
    where: { numero: { startsWith: like } },
    orderBy: { numero: "desc" },
  });
  if (!last) return `${numeroOriginal}-R1`;
  const m = String(last.numero).match(/-R(\d+)$/);
  const n = m ? Number(m[1]) : 0;
  return `${numeroOriginal}-R${n + 1}`;
}

// GET contratos (lista)
app.get("/api/contratos", requireAuth, async (req, res) => {
  const contratos = await prisma.contratoPagamento.findMany({
    include: {
      cliente: true,
      parcelas: { orderBy: { numero: "asc" } },
      criadoPor: { select: { id: true, nome: true } },
      contratoOrigem: true,
      renegociacoes: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(contratos);
});

// GET contrato (detalhe)
app.get("/api/contratos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const contrato = await prisma.contratoPagamento.findUnique({
    where: { id },
    include: {
      cliente: true,
      parcelas: {
        orderBy: { numero: "asc" },
        include: {
          canceladaPor: { select: { id: true, nome: true } },
        },
      },
      criadoPor: { select: { id: true, nome: true } },
      contratoOrigem: true,
      renegociacoes: true,
    },
  });
  if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });
  res.json(contrato);
});

// POST contrato (criar)
app.post("/api/contratos", requireAuth, async (req, res) => {
  try {
    const {
      clienteId,
      formaPagamento, // "A_VISTA" | "ENTRADA_PARCELAS" | "PARCELADO"
      valorTotal,
      valorEntrada,
      vencimentoEntrada,
      vencimentoPrimeiraParcela,
      diaVencimento,
      numeroParcelas,
      vencimentoAVista,
    } = req.body || {};

    if (!clienteId) return res.status(400).json({ message: "Cliente é obrigatório." });
    if (!formaPagamento) return res.status(400).json({ message: "Forma de pagamento é obrigatória." });

    const valorTotalDec = parseMoneyInputToDecimalString(valorTotal);
    if (!valorTotalDec) return res.status(400).json({ message: "Valor total inválido." });

    // gera numero: AAAAMMDDSSSA (seq)
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const seq = await nextContratoSeq(prisma, yyyymmdd);
    const numero = buildNumeroContrato(yyyymmdd, seq, "A");

    // parcelas
    const parcelas = [];
    let totalParcelas = 0;

    if (formaPagamento === "A_VISTA") {
      const dv = parseDateInput(vencimentoAVista);
      if (!dv) return res.status(400).json({ message: "Vencimento à vista inválido. Use DD/MM/AAAA." });

      parcelas.push({
        numero: 1,
        valorPrevisto: valorTotalDec,
        vencimento: dv,
        status: "PREVISTA",
      });
      totalParcelas = Number(valorTotalDec);
    }

    if (formaPagamento === "PARCELADO") {
      const n = Number(numeroParcelas);
      const dia = Number(diaVencimento);
      const dv = parseDateInput(vencimentoPrimeiraParcela);
      if (!n || n < 1) return res.status(400).json({ message: "Número de parcelas inválido." });
      if (!dia || dia < 1 || dia > 28) return res.status(400).json({ message: "Dia de vencimento inválido (1-28)." });
      if (!dv) return res.status(400).json({ message: "Vencimento da 1ª parcela inválido. Use DD/MM/AAAA." });

      const total = Number(valorTotalDec);
      const base = Math.floor((total * 100) / n); // centavos
      let resto = Math.round(total * 100) - base * n;

      for (let i = 0; i < n; i++) {
        const cents = base + (resto > 0 ? 1 : 0);
        if (resto > 0) resto--;

        const venc = new Date(dv);
        venc.setUTCMonth(venc.getUTCMonth() + i);

        parcelas.push({
          numero: i + 1,
          valorPrevisto: (cents / 100).toFixed(2),
          vencimento: venc,
          status: "PREVISTA",
        });
      }
      totalParcelas = parcelas.reduce((acc, p) => acc + Number(p.valorPrevisto), 0);
    }

    if (formaPagamento === "ENTRADA_PARCELAS") {
      const n = Number(numeroParcelas);
      const dia = Number(diaVencimento);
      const dEntrada = parseDateInput(vencimentoEntrada);
      const dPrimeira = parseDateInput(vencimentoPrimeiraParcela);

      const entradaDec = parseMoneyInputToDecimalString(valorEntrada);
      if (!entradaDec) return res.status(400).json({ message: "Valor de entrada inválido." });

      if (!dEntrada) return res.status(400).json({ message: "Vencimento da entrada inválido. Use DD/MM/AAAA." });
      if (!n || n < 1) return res.status(400).json({ message: "Número de parcelas inválido." });
      if (!dia || dia < 1 || dia > 28) return res.status(400).json({ message: "Dia de vencimento inválido (1-28)." });
      if (!dPrimeira) return res.status(400).json({ message: "Vencimento da 1ª parcela inválido. Use DD/MM/AAAA." });

      // entrada
      parcelas.push({
        numero: 0,
        valorPrevisto: entradaDec,
        vencimento: dEntrada,
        status: "PREVISTA",
      });

      const total = Number(valorTotalDec);
      const entrada = Number(entradaDec);
      const restante = total - entrada;
      if (restante < 0) return res.status(400).json({ message: "Entrada maior que o total." });

      const base = Math.floor((restante * 100) / n); // centavos
      let resto = Math.round(restante * 100) - base * n;

      for (let i = 0; i < n; i++) {
        const cents = base + (resto > 0 ? 1 : 0);
        if (resto > 0) resto--;

        const venc = new Date(dPrimeira);
        venc.setUTCMonth(venc.getUTCMonth() + i);

        parcelas.push({
          numero: i + 1,
          valorPrevisto: (cents / 100).toFixed(2),
          vencimento: venc,
          status: "PREVISTA",
        });
      }

      totalParcelas = parcelas.reduce((acc, p) => acc + Number(p.valorPrevisto), 0);
    }

    // salva
    const contrato = await prisma.contratoPagamento.create({
      data: {
        numero,
        clienteId: Number(clienteId),
        formaPagamento,
        valorTotal: valorTotalDec,
        status: "EM_DIA",
        criadoPorId: req.user.id,
        parcelas: { create: parcelas },
      },
      include: {
        cliente: true,
        parcelas: { orderBy: { numero: "asc" } },
      },
    });

    return res.json(contrato);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao criar contrato." });
  }
});

// PATCH confirmar recebimento de parcela
app.patch("/api/parcelas/:id/confirmar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { valorRecebido, dataRecebimento, meioRecebimento, adminPassword } = req.body || {};

    // valida senha admin
    if (!adminPassword) return res.status(400).json({ message: "Confirme a senha do admin." });
    const ok = await bcrypt.compare(String(adminPassword), req.adminUser.senhaHash);
    if (!ok) return res.status(403).json({ message: "Senha do admin incorreta." });

    const parcela = await prisma.parcelaContrato.findUnique({
      where: { id },
      include: { contrato: true },
    });
    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });
    if (parcela.status !== "PREVISTA") return res.status(400).json({ message: "Apenas parcelas PREVISTAS podem ser recebidas." });

    const v = parseMoneyInputToDecimalString(valorRecebido);
    if (!v) return res.status(400).json({ message: "Valor recebido inválido." });

    const d = parseDateInput(dataRecebimento);
    if (!d) return res.status(400).json({ message: "Data de recebimento inválida. Use DD/MM/AAAA." });

    const meio = String(meioRecebimento || "").trim();
    if (!meio) return res.status(400).json({ message: "Meio de recebimento é obrigatório." });

    const updated = await prisma.parcelaContrato.update({
      where: { id },
      data: {
        status: "RECEBIDA",
        valorRecebido: v,
        dataRecebimento: d,
        meioRecebimento: meio,
      },
    });

    // atualiza status do contrato (simples)
    const contratoId = parcela.contratoId;
    const parcelas = await prisma.parcelaContrato.findMany({ where: { contratoId } });
    const hasPrevista = parcelas.some((p) => p.status === "PREVISTA");
    const statusContrato = hasPrevista ? "EM_DIA" : "QUITADO";

    await prisma.contratoPagamento.update({
      where: { id: contratoId },
      data: { status: statusContrato },
    });

    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao confirmar recebimento." });
  }
});

// POST cancelar parcela
app.post("/api/parcelas/:id/cancelar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { motivo, adminPassword } = req.body || {};

    if (!adminPassword) return res.status(400).json({ message: "Confirme a senha do admin." });
    const ok = await bcrypt.compare(String(adminPassword), req.adminUser.senhaHash);
    if (!ok) return res.status(403).json({ message: "Senha do admin incorreta." });

    const parcela = await prisma.parcelaContrato.findUnique({ where: { id } });
    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });
    if (parcela.status !== "PREVISTA") return res.status(400).json({ message: "Apenas parcelas PREVISTAS podem ser canceladas." });

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Motivo é obrigatório." });

    const updated = await prisma.parcelaContrato.update({
      where: { id },
      data: {
        status: "CANCELADA",
        canceladaEm: new Date(),
        canceladaPorId: req.adminUser.id,
        cancelamentoMotivo: motivoTxt,
      },
    });

    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao cancelar parcela." });
  }
});

app.delete("/api/usuarios/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.usuario.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao excluir usuário." });
  }
});

// =========================
// Clientes
// =========================

app.get("/api/clientes", requireAuth, async (_req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });
    res.json(clientes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao listar clientes." });
  }
});

app.get("/api/clientes/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado." });
    res.json(cliente);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar cliente." });
  }
});

app.post("/api/clientes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nome, cpfCnpj, email, telefone, observacoes, ativo } = req.body || {};
    const nomeNorm = String(nome || "").trim();
    if (!nomeNorm) return res.status(400).json({ message: "Nome é obrigatório." });

    const cpfCnpjNorm = String(cpfCnpj || "").trim();
    if (!cpfCnpjNorm) return res.status(400).json({ message: "CPF/CNPJ é obrigatório." });

    const created = await prisma.cliente.create({
      data: {
        nome: nomeNorm,
        cpfCnpj: maskCpfCnpj(cpfCnpjNorm),
        email: email ? String(email).toLowerCase().trim() : null,
        telefone: telefone ? String(telefone).trim() : null,
        observacoes: observacoes ? String(observacoes).trim() : null,
        ativo: ativo === undefined ? true : Boolean(ativo),
      },
    });

    res.json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao criar cliente." });
  }
});

app.put("/api/clientes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, cpfCnpj, email, telefone, observacoes, ativo } = req.body || {};

    const data = {};
    if (nome !== undefined) data.nome = String(nome || "").trim();
    if (cpfCnpj !== undefined) data.cpfCnpj = maskCpfCnpj(String(cpfCnpj || "").trim());
    if (email !== undefined) data.email = email ? String(email).toLowerCase().trim() : null;
    if (telefone !== undefined) data.telefone = telefone ? String(telefone).trim() : null;
    if (observacoes !== undefined) data.observacoes = observacoes ? String(observacoes).trim() : null;
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const updated = await prisma.cliente.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao atualizar cliente." });
  }
});

app.delete("/api/clientes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.cliente.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao excluir cliente." });
  }
});

// =========================
// Advogados
// =========================

app.get("/api/advogados", requireAuth, async (_req, res) => {
  try {
    const advogados = await prisma.advogado.findMany({ orderBy: { nome: "asc" } });
    res.json(advogados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao listar advogados." });
  }
});

app.get("/api/advogados/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const advogado = await prisma.advogado.findUnique({ where: { id } });
    if (!advogado) return res.status(404).json({ message: "Advogado não encontrado." });
    res.json(advogado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar advogado." });
  }
});

app.post("/api/advogados", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nome, cpf, email, telefone, tipoRepasse, percentualRepasse, ativo } = req.body || {};
    const nomeNorm = String(nome || "").trim();
    if (!nomeNorm) return res.status(400).json({ message: "Nome é obrigatório." });

    const cpfNorm = String(cpf || "").trim();
    if (!cpfNorm) return res.status(400).json({ message: "CPF é obrigatório." });

    let perc = null;
    if (percentualRepasse !== undefined && percentualRepasse !== null && String(percentualRepasse).trim() !== "") {
      perc = toNumberOrNull(percentualRepasse);
      if (perc === null) return res.status(400).json({ message: "Percentual inválido." });
    }

    const created = await prisma.advogado.create({
      data: {
        nome: nomeNorm,
        cpf: cpfNorm,
        email: email ? String(email).toLowerCase().trim() : null,
        telefone: telefone ? String(telefone).trim() : null,
        tipoRepasse: tipoRepasse ? String(tipoRepasse).trim() : null,
        percentualRepasse: perc,
        ativo: ativo === undefined ? true : Boolean(ativo),
      },
    });

    res.json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao criar advogado." });
  }
});

app.put("/api/advogados/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, cpf, email, telefone, tipoRepasse, percentualRepasse, ativo } = req.body || {};

    const data = {};
    if (nome !== undefined) data.nome = String(nome || "").trim();
    if (cpf !== undefined) data.cpf = String(cpf || "").trim();
    if (email !== undefined) data.email = email ? String(email).toLowerCase().trim() : null;
    if (telefone !== undefined) data.telefone = telefone ? String(telefone).trim() : null;
    if (tipoRepasse !== undefined) data.tipoRepasse = tipoRepasse ? String(tipoRepasse).trim() : null;

    if (percentualRepasse !== undefined) {
      if (percentualRepasse === null || String(percentualRepasse).trim() === "") {
        data.percentualRepasse = null;
      } else {
        const n = toNumberOrNull(percentualRepasse);
        if (n === null) return res.status(400).json({ message: "Percentual inválido." });
        data.percentualRepasse = n;
      }
    }

    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const updated = await prisma.advogado.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao atualizar advogado." });
  }
});

app.delete("/api/advogados/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.advogado.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao excluir advogado." });
  }
});


// =========================
// Orders
// =========================

app.get("/api/orders", async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
    res.json(orders);
  } catch (err) {
    console.error("Erro ao listar ordens de pagamento:", err);
    res.status(500).json({ message: "Erro ao listar ordens de pagamento." });
  }
});

// =========================
// Renegociação
// =========================

// POST renegociar contrato
app.post("/api/contratos/:id/renegociar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    const {
      formaPagamento,
      valorTotal,
      valorEntrada,
      vencimentoEntrada,
      vencimentoPrimeiraParcela,
      diaVencimento,
      numeroParcelas,
      dataBase, // opcional
    } = req.body || {};

    const contratoOrig = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      include: {
        parcelas: { orderBy: { numero: "asc" } },
      },
    });
    if (!contratoOrig) return res.status(404).json({ message: "Contrato não encontrado." });

    // número renegociado
    const numero = await nextRenegNumber(prisma, contratoOrig.numero);

    const valorTotalDec = parseMoneyInputToDecimalString(valorTotal);
    if (!valorTotalDec) return res.status(400).json({ message: "Valor total inválido." });

    const parcelas = [];

    if (formaPagamento === "A_VISTA") {
      const dv = parseDateInput(vencimentoPrimeiraParcela || dataBase);
      if (!dv) return res.status(400).json({ message: "Vencimento inválido." });

      parcelas.push({
        numero: 1,
        valorPrevisto: valorTotalDec,
        vencimento: dv,
        status: "PREVISTA",
      });
    }

    if (formaPagamento === "PARCELADO") {
      const n = Number(numeroParcelas);
      const dia = Number(diaVencimento);
      const dv = parseDateInput(vencimentoPrimeiraParcela || dataBase);
      if (!n || n < 1) return res.status(400).json({ message: "Número de parcelas inválido." });
      if (!dia || dia < 1 || dia > 28) return res.status(400).json({ message: "Dia de vencimento inválido." });
      if (!dv) return res.status(400).json({ message: "Vencimento da 1ª parcela inválido." });

      const total = Number(valorTotalDec);
      const base = Math.floor((total * 100) / n);
      let resto = Math.round(total * 100) - base * n;

      for (let i = 0; i < n; i++) {
        const cents = base + (resto > 0 ? 1 : 0);
        if (resto > 0) resto--;

        const venc = new Date(dv);
        venc.setUTCMonth(venc.getUTCMonth() + i);

        parcelas.push({
          numero: i + 1,
          valorPrevisto: (cents / 100).toFixed(2),
          vencimento: venc,
          status: "PREVISTA",
        });
      }
    }

    if (formaPagamento === "ENTRADA_PARCELAS") {
      const n = Number(numeroParcelas);
      const dia = Number(diaVencimento);
      const dEntrada = parseDateInput(vencimentoEntrada || dataBase);
      const dPrimeira = parseDateInput(vencimentoPrimeiraParcela || dataBase);

      const entradaDec = parseMoneyInputToDecimalString(valorEntrada);
      if (!entradaDec) return res.status(400).json({ message: "Valor de entrada inválido." });
      if (!dEntrada) return res.status(400).json({ message: "Vencimento da entrada inválido." });
      if (!n || n < 1) return res.status(400).json({ message: "Número de parcelas inválido." });
      if (!dia || dia < 1 || dia > 28) return res.status(400).json({ message: "Dia de vencimento inválido." });
      if (!dPrimeira) return res.status(400).json({ message: "Vencimento da 1ª parcela inválido." });

      parcelas.push({
        numero: 0,
        valorPrevisto: entradaDec,
        vencimento: dEntrada,
        status: "PREVISTA",
      });

      const total = Number(valorTotalDec);
      const entrada = Number(entradaDec);
      const restante = total - entrada;
      if (restante < 0) return res.status(400).json({ message: "Entrada maior que o total." });

      const base = Math.floor((restante * 100) / n);
      let resto = Math.round(restante * 100) - base * n;

      for (let i = 0; i < n; i++) {
        const cents = base + (resto > 0 ? 1 : 0);
        if (resto > 0) resto--;

        const venc = new Date(dPrimeira);
        venc.setUTCMonth(venc.getUTCMonth() + i);

        parcelas.push({
          numero: i + 1,
          valorPrevisto: (cents / 100).toFixed(2),
          vencimento: venc,
          status: "PREVISTA",
        });
      }
    }

    const novoContrato = await prisma.contratoPagamento.create({
      data: {
        numero,
        clienteId: contratoOrig.clienteId,
        formaPagamento,
        valorTotal: valorTotalDec,
        status: "EM_DIA",
        criadoPorId: req.user.id,
        contratoOrigemId: contratoOrig.id,
        parcelas: { create: parcelas },
      },
      include: {
        parcelas: true,
      },
    });

    // marca contrato original como RENEGOCIADO
    await prisma.contratoPagamento.update({
      where: { id: contratoOrig.id },
      data: { status: "RENEGOCIADO" },
    });

    res.json(novoContrato);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao renegociar contrato." });
  }
});

// =========================
// Retificação de parcela
// =========================

// POST retificar parcela
app.post("/api/parcelas/:id/retificar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parcelaId = Number(req.params.id);
    const {
      novoValorPrevisto,
      novoVencimento,
      ratear = true,
      adminPassword,
    } = req.body || {};

    if (!adminPassword) {
      return res.status(400).json({ message: "Confirme a senha do admin." });
    }

    const ok = await bcrypt.compare(String(adminPassword), req.adminUser.senhaHash);
    if (!ok) return res.status(403).json({ message: "Senha do admin incorreta." });

    const parcela = await prisma.parcelaContrato.findUnique({
      where: { id: parcelaId },
      include: {
        contrato: {
          include: {
            parcelas: { orderBy: { numero: "asc" } },
          },
        },
      },
    });

    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });
    if (parcela.status !== "PREVISTA") {
      return res.status(400).json({ message: "Apenas parcelas PREVISTAS podem ser retificadas." });
    }

    const parcelasPrevistas = parcela.contrato.parcelas.filter((p) => p.status === "PREVISTA");
    if (parcelasPrevistas.length < 2) {
      return res.status(400).json({
        message:
          "Retificação bloqueada: é necessário ao menos 2 parcelas PREVISTAS. Use renegociação.",
      });
    }

    const novoValorDec = parseMoneyInputToDecimalString(novoValorPrevisto);
    if (!novoValorDec) return res.status(400).json({ message: "Novo valor inválido." });

    const novoVenc = novoVencimento ? parseDateInput(novoVencimento) : null;
    if (novoVencimento && !novoVenc) {
      return res.status(400).json({ message: "Vencimento inválido. Use DD/MM/AAAA." });
    }

    const valorAtual = Number(parcela.valorPrevisto);
    const novoValor = Number(novoValorDec);
    const delta = novoValor - valorAtual;

    const outras = parcelasPrevistas.filter((p) => p.id !== parcela.id);

    await prisma.$transaction(async (tx) => {
      // atualiza parcela alvo
      await tx.parcelaContrato.update({
        where: { id: parcela.id },
        data: {
          valorPrevisto: novoValorDec,
          ...(novoVenc ? { vencimento: novoVenc } : {}),
        },
      });

      if (delta !== 0) {
        if (ratear) {
          // rateia delta igualmente nas demais parcelas PREVISTAS
          const count = outras.length;
          const deltaCents = Math.round(delta * 100);
          const base = Math.floor(deltaCents / count);
          let resto = deltaCents - base * count;

          for (const p of outras) {
            const add = base + (resto > 0 ? 1 : 0);
            if (resto > 0) resto--;

            const novo = Number(p.valorPrevisto) - add / 100;
            if (novo < 0) {
              throw new Error("Rateio inválido: valor negativo em parcela.");
            }

            await tx.parcelaContrato.update({
              where: { id: p.id },
              data: { valorPrevisto: novo.toFixed(2) },
            });
          }
        } else {
          // se não ratear, backend apenas valida soma total (front deve enviar ajustes)
          const soma = outras.reduce((acc, p) => acc + Number(p.valorPrevisto), 0);
          const totalAntes = parcelasPrevistas.reduce((acc, p) => acc + Number(p.valorPrevisto), 0);
          const totalDepois = novoValor + soma;
          if (Math.abs(totalDepois - totalAntes) > 0.01) {
            throw new Error("Valor total do contrato não pode ser alterado.");
          }
        }
      }
    });

    const atualizado = await prisma.parcelaContrato.findUnique({ where: { id: parcela.id } });
    res.json(atualizado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Erro ao retificar parcela." });
  }
});

// =========================
// Start
// =========================

app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});
