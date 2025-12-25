import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/* ===========================
   Helpers (mask/parse)
   =========================== */
function onlyDigits(v = "") {
  return String(v ?? "").replace(/\D/g, "");
}

function parseDateDDMMYYYY(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900) return null;

  // Create local date at noon to avoid timezone/D-1 issues
  const dt = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
    return null;
  }
  return dt;
}

function centsToDecimalString(cents) {
  // cents: BigInt
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const s = abs.toString().padStart(3, "0");
  const intPart = s.slice(0, -2);
  const decPart = s.slice(-2);
  return `${sign}${intPart}.${decPart}`;
}

// Parse de moeda/valor (R$) — aceita:
// - number (ex.: 1234.56)  ✅ TRATAR COMO REAIS
// - string "1.234,56" ou "1234,56" ou "1234.56"
// - string só dígitos (ex.: "123456" => R$ 1.234,56) ✅ padrão de máscara do front (centavos)
function moneyToCents(input) {
  if (input === null || input === undefined || input === "") return null;

  // ✅ number => REAIS (não centavos)
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return BigInt(Math.round(input * 100));
  }

  // ✅ Decimal-like object
  if (typeof input === "object" && input !== null && typeof input.toString === "function") {
    const sObj = String(input.toString()).trim();
    if (/^\d+$/.test(sObj)) return BigInt(sObj + "00");
    if (/^\d+(\.\d{1,2})$/.test(sObj)) {
      const [i, d = ""] = sObj.split(".");
      return BigInt(i + d.padEnd(2, "0"));
    }
  }

  const s0 = String(input).trim();
  if (!s0) return null;

  // só dígitos: já é centavos (padrão máscara)
  if (/^\d+$/.test(s0)) return BigInt(s0);

  // BR: "1.234,56"
  if (s0.includes(",")) {
    const s = s0.replace(/\./g, "");
    const [intPart, decPartRaw = ""] = s.split(",");
    const decPart = (decPartRaw + "00").slice(0, 2);
    const all = (onlyDigits(intPart) || "0") + decPart;
    return BigInt(all);
  }

  // EN: "1234.56"
  if (s0.includes(".")) {
    const [intPart, decPartRaw = ""] = s0.split(".");
    const decPart = (onlyDigits(decPartRaw) + "00").slice(0, 2);
    const all = (onlyDigits(intPart) || "0") + decPart;
    return BigInt(all);
  }

  // fallback
  const d = onlyDigits(s0);
  return d ? BigInt(d) : null;
}

/* ===========================
   Auth middleware
   =========================== */
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      ativo: user.ativo,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Não autenticado." });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Sessão inválida." });
  }
}

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "ADMIN") return res.status(403).json({ message: "Acesso restrito a admin." });
  return next();
}

async function requireAdminPassword(req, res, adminPassword) {
  const pwd = String(adminPassword || "");
  if (!pwd) {
    res.status(400).json({ message: "Confirme a senha do admin." });
    return false;
  }
  const adminId = req.user?.id;
  const adminUser = await prisma.usuario.findUnique({ where: { id: adminId } });
  if (!adminUser) {
    res.status(401).json({ message: "Admin inválido." });
    return false;
  }
  const ok = await bcrypt.compare(pwd, adminUser.senha_hash || "");
  if (!ok) {
    res.status(401).json({ message: "Senha do admin inválida." });
    return false;
  }
  return true;
}

/* ===========================
   Health
   =========================== */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* ===========================
   Auth routes
   =========================== */
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ message: "Informe e-mail e senha." });

    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.ativo) return res.status(401).json({ message: "Credenciais inválidas." });

    const ok = await bcrypt.compare(password, user.senha_hash || "");
    if (!ok) return res.status(401).json({ message: "Credenciais inválidas." });

    const token = makeToken(user);
    return res.json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role, ativo: user.ativo },
    });
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha no login." });
  }
});

/* ===========================
   Clientes
   =========================== */
app.get("/api/clientes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const where = q
      ? {
          OR: [
            { nomeRazaoSocial: { contains: q, mode: "insensitive" } },
            { cpfCnpj: { contains: onlyDigits(q) } },
          ],
        }
      : undefined;

    const itens = await prisma.cliente.findMany({ where, orderBy: { nomeRazaoSocial: "asc" } });
    return res.json(itens);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao listar clientes." });
  }
});

app.post("/api/clientes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const nomeRazaoSocial = String(req.body?.nomeRazaoSocial || "").trim();
    const cpfCnpj = onlyDigits(req.body?.cpfCnpj || "");
    if (!nomeRazaoSocial) return res.status(400).json({ message: "Nome/Razão social é obrigatório." });
    if (!cpfCnpj) return res.status(400).json({ message: "CPF/CNPJ é obrigatório." });

    const created = await prisma.cliente.create({
      data: { nomeRazaoSocial, cpfCnpj, ativo: true },
    });

    return res.json(created);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao criar cliente." });
  }
});

app.put("/api/clientes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nomeRazaoSocial = String(req.body?.nomeRazaoSocial || "").trim();
    const cpfCnpj = onlyDigits(req.body?.cpfCnpj || "");
    const ativo = req.body?.ativo === undefined ? undefined : Boolean(req.body.ativo);

    const updated = await prisma.cliente.update({
      where: { id },
      data: {
        ...(nomeRazaoSocial ? { nomeRazaoSocial } : {}),
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
      },
    });

    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao atualizar cliente." });
  }
});

/* ===========================
   Usuários (para não dar 404/HTML no front)
   CRUD mínimo admin-only
   =========================== */
app.get("/api/usuarios", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.usuario.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, role: true, ativo: true, createdAt: true, updatedAt: true },
    });
    return res.json(users);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao listar usuários." });
  }
});

app.post("/api/usuarios", requireAuth, requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "user");
    const ativo = req.body?.ativo === undefined ? true : Boolean(req.body.ativo);
    const senha = String(req.body?.senha || "");

    if (!nome) return res.status(400).json({ message: "Nome é obrigatório." });
    if (!email) return res.status(400).json({ message: "E-mail é obrigatório." });
    if (!senha) return res.status(400).json({ message: "Senha é obrigatória." });

    const hash = await bcrypt.hash(senha, 10);
    const created = await prisma.usuario.create({
      data: { nome, email, role, ativo, senha_hash: hash },
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
    return res.json(created);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao criar usuário." });
  }
});

app.put("/api/usuarios/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nome = req.body?.nome !== undefined ? String(req.body.nome).trim() : undefined;
    const email = req.body?.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const role = req.body?.role !== undefined ? String(req.body.role) : undefined;
    const ativo = req.body?.ativo !== undefined ? Boolean(req.body.ativo) : undefined;
    const senha = req.body?.senha !== undefined ? String(req.body.senha) : undefined;

    const data = {};
    if (nome) data.nome = nome;
    if (email) data.email = email;
    if (role) data.role = role;
    if (ativo !== undefined) data.ativo = ativo;
    if (senha) data.senha_hash = await bcrypt.hash(senha, 10);

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao atualizar usuário." });
  }
});

/* ===========================
   Advogados (placeholder JSON para não quebrar front)
   ⚠️ Sem mexer no schema: devolve [] e endpoints estáveis.
   =========================== */
app.get("/api/advogados", requireAuth, requireAdmin, async (_req, res) => {
  return res.json([]);
});

/* ===========================
   Modelo de Distribuição (placeholder JSON para não quebrar front)
   ⚠️ Sem mexer no schema: devolve [] e endpoints estáveis.
   =========================== */
app.get("/api/modelo-distribuicao", requireAuth, requireAdmin, async (_req, res) => {
  return res.json([]);
});

/* ===========================
   Contratos (LISTA)
   ✅ includes pai/filho (derivados/renegociadosDele/contratoOrigem/renegociadoPara)
   =========================== */
app.get("/api/contratos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const where = q
      ? {
          OR: [
            { numeroContrato: { contains: q, mode: "insensitive" } },
            { cliente: { nomeRazaoSocial: { contains: q, mode: "insensitive" } } },
            { cliente: { cpfCnpj: { contains: onlyDigits(q) } } },
          ],
        }
      : undefined;

    const contratos = await prisma.contratoPagamento.findMany({
      where,
      include: {
        cliente: true,

        // ✅ Pai / Filho direto
        contratoOrigem: { select: { id: true, numeroContrato: true } },
        renegociadoPara: { select: { id: true, numeroContrato: true } },

        // ✅ Listas (histórico)
        derivados: { select: { id: true, numeroContrato: true } },
        renegociadosDele: { select: { id: true, numeroContrato: true } },

        parcelas: { orderBy: { numero: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return res.json(contratos);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao listar contratos." });
  }
});

/* ===========================
   Contrato (DETALHE)
   ✅ includes pai/filho/listas + cancel info
   =========================== */
app.get("/api/contratos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });

    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id },
      include: {
        cliente: true,

        // ✅ Pai / Filho direto
        contratoOrigem: { select: { id: true, numeroContrato: true } },
        renegociadoPara: { select: { id: true, numeroContrato: true } },

        // ✅ Listas (histórico)
        derivados: { select: { id: true, numeroContrato: true } },
        renegociadosDele: { select: { id: true, numeroContrato: true } },

        parcelas: {
          orderBy: { numero: "asc" },
          include: {
            canceladaPor: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });
    return res.json(contrato);
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao carregar contrato." });
  }
});

/* ===========================
   Criar contrato (pagamento)
   =========================== */
app.post("/api/contratos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const clienteId = Number(req.body?.clienteId);
    const numeroContrato = String(req.body?.numeroContrato || "").trim();
    const formaPagamento = String(req.body?.formaPagamento || "").trim();
    const valorTotalCents = moneyToCents(req.body?.valorTotal);
    const observacoes = req.body?.observacoes ? String(req.body.observacoes) : null;

    if (!clienteId) return res.status(400).json({ message: "Cliente inválido." });
    if (!numeroContrato) return res.status(400).json({ message: "Número do contrato é obrigatório." });
    if (!formaPagamento) return res.status(400).json({ message: "Forma de pagamento é obrigatória." });
    if (valorTotalCents === null || valorTotalCents <= 0n)
      return res.status(400).json({ message: "Valor total inválido." });

    const parcelas = Array.isArray(req.body?.parcelas) ? req.body.parcelas : [];
    if (!parcelas.length) return res.status(400).json({ message: "Informe as parcelas." });

    const created = await prisma.$transaction(async (tx) => {
      const contrato = await tx.contratoPagamento.create({
        data: {
          clienteId,
          numeroContrato,
          formaPagamento,
          valorTotal: centsToDecimalString(valorTotalCents),
          observacoes,
          ativo: true,
        },
      });

      for (const p of parcelas) {
        const venc = parseDateDDMMYYYY(p?.vencimento);
        const valCents = moneyToCents(p?.valorPrevisto);
        if (!venc) throw new Error("Vencimento inválido em parcela.");
        if (valCents === null || valCents <= 0n) throw new Error("Valor inválido em parcela.");

        await tx.parcelaContrato.create({
          data: {
            contratoId: contrato.id,
            numero: Number(p?.numero || 1),
            vencimento: venc,
            valorPrevisto: centsToDecimalString(valCents),
            status: "PREVISTA",
          },
        });
      }

      return contrato;
    });

    return res.json({ message: "Contrato criado.", contrato: created });
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao criar contrato." });
  }
});

/* ===========================
   Renegociar contrato
   ✅ grava pai/filho nos dois lados
   =========================== */
app.post("/api/contratos/:id/renegociar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    if (!contratoId) return res.status(400).json({ message: "ID inválido." });

    const { adminPassword, motivo, numeroContratoNovo, formaPagamento, valorTotal, parcelas } = req.body || {};
    const ok = await requireAdminPassword(req, res, adminPassword);
    if (!ok) return;

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo da renegociação." });

    const base = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      include: { parcelas: true },
    });
    if (!base) return res.status(404).json({ message: "Contrato não encontrado." });

    const novoNumero = String(numeroContratoNovo || "").trim();
    if (!novoNumero) return res.status(400).json({ message: "Informe o número do novo contrato." });

    const fp = String(formaPagamento || base.formaPagamento || "").trim();
    if (!fp) return res.status(400).json({ message: "Forma de pagamento inválida." });

    const totalCents = moneyToCents(valorTotal);
    if (totalCents === null || totalCents <= 0n) return res.status(400).json({ message: "Valor total inválido." });

    const arrParcelas = Array.isArray(parcelas) ? parcelas : [];
    if (!arrParcelas.length) return res.status(400).json({ message: "Informe as parcelas do novo contrato." });

    const created = await prisma.$transaction(async (tx) => {
      const filho = await tx.contratoPagamento.create({
        data: {
          clienteId: base.clienteId,
          numeroContrato: novoNumero,
          formaPagamento: fp,
          valorTotal: centsToDecimalString(totalCents),
          observacoes: base.observacoes,
          ativo: true,

          // ✅ vínculo filho → pai
          contratoOrigemId: base.id,
        },
      });

      for (const p of arrParcelas) {
        const venc = parseDateDDMMYYYY(p?.vencimento);
        const valCents = moneyToCents(p?.valorPrevisto);
        if (!venc) throw new Error("Vencimento inválido em parcela.");
        if (valCents === null || valCents <= 0n) throw new Error("Valor inválido em parcela.");

        await tx.parcelaContrato.create({
          data: {
            contratoId: filho.id,
            numero: Number(p?.numero || 1),
            vencimento: venc,
            valorPrevisto: centsToDecimalString(valCents),
            status: "PREVISTA",
          },
        });
      }

      // ✅ vínculo pai → filho (direto)
      await tx.contratoPagamento.update({
        where: { id: base.id },
        data: { renegociadoParaId: filho.id },
      });

      await tx.historicoContrato.create({
        data: {
          contratoId: base.id,
          tipo: "RENEGOCIACAO",
          descricao: `Renegociado para ${filho.numeroContrato}. Motivo: ${motivoTxt}`,
          criadoPorId: req.user?.id ?? null,
        },
      });

      return filho;
    });

    return res.json({ message: "Renegociação criada.", contrato: created });
  } catch (e) {
    return res.status(500).json({ message: e?.message || "Falha ao renegociar contrato." });
  }
});

/* ===========================
   Retificar parcela (preserva total via compensação)
   =========================== */
app.post("/api/parcelas/:id/retificar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parcelaId = Number(req.params.id);
    if (!Number.isFinite(parcelaId)) return res.status(400).json({ message: "ID inválido." });

    const { adminPassword, motivo, patch } = req.body || {};
    const ok = await requireAdminPassword(req, res, adminPassword);
    if (!ok) return;

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo da retificação." });

    const parcela = await prisma.parcelaContrato.findUnique({
      where: { id: parcelaId },
      include: { contrato: { include: { parcelas: true } } },
    });
    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });

    const contrato = parcela.contrato;
    if (!contrato) return res.status(400).json({ message: "Contrato da parcela não encontrado." });

    const previstas = (contrato.parcelas || []).filter((p) => p.status === "PREVISTA");
    if (previstas.length < 2) {
      return res.status(400).json({
        message:
          "Retificação bloqueada: é necessário existir 2 ou mais parcelas PREVISTAS no contrato/renegociação.",
      });
    }

    if (parcela.status !== "PREVISTA") {
      return res.status(400).json({ message: "Somente parcelas PREVISTAS podem ser retificadas." });
    }

    const patchIn = patch || {};
    const dataToUpdate = {};

    if (patchIn.vencimento !== undefined) {
      const d = parseDateDDMMYYYY(patchIn.vencimento);
      if (!d) return res.status(400).json({ message: "Vencimento inválido. Use DD/MM/AAAA." });
      dataToUpdate.vencimento = d;
    }

    let novoValorCents = null;
    if (patchIn.valorPrevisto !== undefined) {
      const cents = moneyToCents(patchIn.valorPrevisto);
      if (cents === null || cents <= 0n) return res.status(400).json({ message: "Valor previsto inválido." });
      novoValorCents = cents;
      dataToUpdate.valorPrevisto = centsToDecimalString(cents);
    }

    if (!Object.keys(dataToUpdate).length) {
      return res.status(400).json({ message: "Nada para retificar." });
    }

    const before = {
      id: parcela.id,
      contratoId: parcela.contratoId,
      numero: parcela.numero,
      vencimento: parcela.vencimento,
      valorPrevisto: parcela.valorPrevisto,
      status: parcela.status,
    };

    const parcelaAtualizada = await prisma.$transaction(async (tx) => {
      let outraAntes = null;
      let outraDepois = null;

      if (novoValorCents !== null) {
        const atualCents = moneyToCents(parcela.valorPrevisto) || 0n;
        const delta = novoValorCents - atualCents;

        if (delta !== 0n) {
          const candidata = previstas
            .filter((x) => x.id !== parcela.id)
            .sort((a, b) => (a.numero || 0) - (b.numero || 0))
            .slice(-1)[0];

          if (!candidata) {
            const err = new Error("Retificação bloqueada: não há outra parcela PREVISTA para compensação.");
            err.status = 400;
            throw err;
          }

          outraAntes = await tx.parcelaContrato.findUnique({ where: { id: candidata.id } });

          const candAtualCents = moneyToCents(candidata.valorPrevisto) || 0n;
          const candNovoCents = candAtualCents - delta;

          if (candNovoCents <= 0n) {
            const err = new Error(
              "Retificação bloqueada: a compensação tornaria outra parcela PREVISTA menor/igual a zero. Use renegociação (Rx)."
            );
            err.status = 400;
            throw err;
          }

          outraDepois = await tx.parcelaContrato.update({
            where: { id: candidata.id },
            data: { valorPrevisto: centsToDecimalString(candNovoCents) },
          });
        }
      }

      const afterParcela = await tx.parcelaContrato.update({
        where: { id: parcelaId },
        data: dataToUpdate,
      });

      const alteracoes = {};
      if (dataToUpdate.vencimento)
        alteracoes.vencimento = { before: before.vencimento, after: afterParcela.vencimento };
      if (dataToUpdate.valorPrevisto)
        alteracoes.valorPrevisto = { before: before.valorPrevisto, after: afterParcela.valorPrevisto };

      if (outraAntes && outraDepois) {
        alteracoes.compensacao = {
          parcelaId: outraDepois.id,
          numero: outraDepois.numero,
          before: outraAntes.valorPrevisto,
          after: outraDepois.valorPrevisto,
        };
      }

      await tx.retificacaoParcela.create({
        data: {
          parcelaId,
          motivo: motivoTxt,
          alteracoes,
          snapshotAntes: before,
          snapshotDepois: {
            id: afterParcela.id,
            contratoId: afterParcela.contratoId,
            numero: afterParcela.numero,
            vencimento: afterParcela.vencimento,
            valorPrevisto: afterParcela.valorPrevisto,
            status: afterParcela.status,
          },
          criadoPorId: req.user?.id ?? null,
        },
      });

      return afterParcela;
    });

    return res.json({ message: "Parcela retificada com sucesso.", parcela: parcelaAtualizada });
  } catch (err) {
    const status = err?.status || 500;
    console.error("Erro ao retificar parcela:", err);
    return res.status(status).json({ message: err?.message || "Erro ao retificar parcela." });
  }
});

/* ===========================
   Aliases sem /api (se o front chamar direto)
   =========================== */
app.get("/clientes", requireAuth, requireAdmin, (req, res) => res.redirect(307, "/api/clientes"));
app.get("/usuarios", requireAuth, requireAdmin, (req, res) => res.redirect(307, "/api/usuarios"));
app.get("/advogados", requireAuth, requireAdmin, (req, res) => res.redirect(307, "/api/advogados"));
app.get("/modelo-distribuicao", requireAuth, requireAdmin, (req, res) => res.redirect(307, "/api/modelo-distribuicao"));

/* ===========================
   404 em JSON (nunca HTML)
   =========================== */
app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada.", path: req.originalUrl });
});

/* ===========================
   Start
   =========================== */
app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});
