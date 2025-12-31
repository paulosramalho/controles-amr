// backend/src/server.js       30/12 - 01:25h
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

app.use(express.json());
app.use(morgan("dev"));

/* =========================
   DIRETRIZES — HELPERS
========================= */
async function nextRenegNumber(prisma, numeroOriginal) {
  const prefix = `${numeroOriginal}-R`;
  const existentes = await prisma.contratoPagamento.findMany({
    where: { numeroContrato: { startsWith: prefix } },
    select: { numeroContrato: true },
  });

  let max = 0;
  for (const e of existentes) {
    const m = e.numeroContrato.match(/-R(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${numeroOriginal}-R${max + 1}`;
}

function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

const normCPF = (v) => onlyDigits(v); // 11 dígitos esperado
const normPhone = (v) => onlyDigits(v); // 11 dígitos esperado
const normEmail = (v) => String(v || "").trim().toLowerCase();
const normOAB = (v) => String(v || "").trim().toUpperCase();
const normPix = (v) => (v === undefined ? undefined : (String(v || "").trim() || null));
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

  // DD/MM/AAAA → data local (12:00) para evitar D-1 por fuso
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD (input date) → data local (12:00)
  const isoShort = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoShort) {
    const yyyy = Number(isoShort[1]);
    const mm = Number(isoShort[2]);
    const dd = Number(isoShort[3]);
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

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

// Parse de moeda/valor (R$) — aceita:
// - number (ex.: 1234.56)
// - string "1.234,56" ou "1234,56" ou "1234.56"
// - string só dígitos (ex.: "123456" => R$ 1.234,56)  ✅ padrão de máscara do front
// Parse de moeda/valor (R$) — aceita:
// - number (ex.: 1234.56)  ✅ TRATAR COMO REAIS
// - string "1.234,56" ou "1234,56" ou "1234.56"
// - string só dígitos (ex.: "123456" => R$ 1.234,56) ✅ padrão de máscara do front (centavos)
function moneyToCents(input) {
  if (input === null || input === undefined || input === "") return null;

  // ✅ number => REAIS (não centavos)
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    // arredonda para evitar 0.1+0.2 etc
    return BigInt(Math.round(input * 100));
  }

  // ✅ Se vier um Decimal do Prisma / objeto, trate como VALOR (reais), não como "centavos"
  if (typeof input === "object" && input !== null && typeof input.toString === "function") {
    const sObj = String(input.toString()).trim();
    // "3870" (Decimal) => R$ 3.870,00
    if (/^\d+$/.test(sObj)) return BigInt(sObj + "00");
    // "3870.00" => ok
    if (/^\d+(\.\d{1,2})$/.test(sObj)) {
      const [i, d = ""] = sObj.split(".");
      return BigInt(i + d.padEnd(2, "0"));
    }
  }

  const s0 = String(input).trim();
  if (!s0) return null;

  // só dígitos: já é centavos (padrão da máscara do front)
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

  // fallback: tenta dígitos
  const d = onlyDigits(s0);
  return d ? BigInt(d) : null;
}


function signedMoneyToCents(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  const neg = raw.startsWith("-");
  const val = neg ? raw.slice(1).trim() : raw;
  const cents = moneyToCents(val);
  return neg ? -cents : cents;
}

function centsToDecimalString(cents) {
  if (cents === null || cents === undefined) return null;
  const c = BigInt(cents);
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const intPart = abs / 100n;
  const decPart = abs % 100n;
  return `${neg ? "-" : ""}${intPart.toString()}.${decPart.toString().padStart(2, "0")}`;
}

// Divide um total em N parcelas, distribuindo o "resto" em +1 centavo nas primeiras parcelas
function splitCents(totalCents, n) {
  const total = BigInt(totalCents);
  const N = BigInt(n);
  const base = total / N;
  const rem = total % N;
  const out = [];
  for (let i = 0n; i < N; i++) {
    out.push(base + (i < rem ? 1n : 0n));
  }
  return out;
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
    valorTotalPrevisto: valorNum,
    valorTotalPrevistoBR: valorNum === null ? null : formatBRL(valorNum),
  };
}

function calcAnoMes(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Acesso restrito a administradores." });
  }
  next();
}


async function assertAdminPassword(req, adminPassword) {
  const pwd = String(adminPassword ?? "").trim();
  if (!pwd) {
    const err = new Error("Confirme sua senha de administrador.");
    err.status = 400;
    throw err;
  }
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error("Sessão inválida.");
    err.status = 401;
    throw err;
  }
  const u = await prisma.usuario.findUnique({ where: { id: Number(userId) } });
  if (!u) {
    const err = new Error("Usuário não encontrado.");
    err.status = 401;
    throw err;
  }
  const { bcrypt } = await getAuthLibs();
  const ok = await bcrypt.compare(pwd, u.senhaHash);
  if (!ok) {
    const err = new Error("Senha inválida.");
    err.status = 401;
    throw err;
  }
  return true;
}


async function verifyAdminPassword(req, adminPassword) {
  if (!adminPassword) return false;
  if (!prisma.usuario) return false;
  const { bcrypt } = await getAuthLibs();

  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId)) return false;

  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u) return false;

  return bcrypt.compare(String(adminPassword), u.senhaHash);
}

async function requireAdminPassword(req, res, adminPassword) {
  const ok = await verifyAdminPassword(req, adminPassword);
  if (!ok) {
    res.status(401).json({ message: "Senha de admin inválida." });
    return false;
  }
  return true;
}


/* =========================
   AUTH (ADMIN / USER) — TEMP/REMOVÍVEL
========================= */

const JWT_SECRET = process.env.JWT_SECRET || "DEV_ONLY_CHANGE_ME";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Lazy-load libs
let _bcrypt = null;
let _jwt = null;

async function getAuthLibs() {
  if (!_bcrypt) {
    const mod = await import("bcryptjs");
    _bcrypt = mod.default || mod;
  }
  if (!_jwt) {
    const mod = await import("jsonwebtoken");
    _jwt = mod.default || mod;
  }
  return { bcrypt: _bcrypt, jwt: _jwt };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    ativo: u.ativo,
    tipoUsuario: u.tipoUsuario ?? null,
    cpf: u.cpf ?? null,
    telefone: u.telefone ?? null,
    // ✅ IMPORTANTE: precisa existir para /api/advogados/me
    advogadoId: u.advogadoId ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    createdAtBR: formatDateBR(u.createdAt),
    updatedAtBR: formatDateBR(u.updatedAt),
  };
}

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// Middleware: tenta anexar user se token existir (não obriga)
async function attachUserIfPresent(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    const { jwt } = await getAuthLibs();
    const payload = jwt.verify(token, JWT_SECRET);

    // Se o schema ainda não tiver Usuario, não quebra
    if (!prisma.usuario) return next();

    // payload.sub vem como string (ex: "1") e o Prisma espera Int.
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) return next();

    const u = await prisma.usuario.findUnique({ where: { id: userId } });
    if (u && u.ativo) req.user = publicUser(u);
  } catch {
    // token inválido/expirado etc — não trava a navegação pública
  }
  return next();
}

app.use(attachUserIfPresent);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Não autenticado." });
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Não autenticado." });
    if (req.user.role !== role) return res.status(403).json({ message: "Acesso negado." });
    return next();
  };
}

/* =========================
   ROTAS
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", message: "Controles-AMR backend ativo", db: "ok" });
  } catch (err) {
    console.error("Erro ao checar DB:", err);
    res.status(500).json({ status: "erro", message: "Falha ao acessar o banco" });
  }
});

const allowedOrigins = [
  "https://controles-amr.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // requests sem origin (ex.: healthcheck/curl) passam
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// garantir preflight para todas as rotas
app.options("*", cors());

/* =========================
   ADVOGADOS — ROTAS (Admin + User)
   Observação:
   - Admin: CRUD (soft delete via ativo)
   - User: /me (editar seus próprios dados)
========================= */

// ✅ BUG FIX: era "authRequired" (inexistente). O certo é requireAuth.
app.get("/api/advogados", requireAuth, requireAdmin, async (_req, res) => {
  const advogados = await prisma.advogado.findMany({
    orderBy: { nome: "asc" },
  });
  res.json(advogados);
});

app.post("/api/advogados", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nome, cpf, oab, email, telefone, chavePix, criarUsuario, senha, confirmarSenha } = req.body;

    const nomeNorm = String(nome || "").trim();
    const cpfLimpo = normCPF(cpf);
    const oabNorm = normOAB(oab);
    const emailNorm = normEmail(email);
    const telefoneNorm = normPhone(telefone);
    const pixNorm = normPix(chavePix);

    const criar = Boolean(criarUsuario);

    // Obrigatórios do Advogado
    if (!nomeNorm || !cpfLimpo || !oabNorm || !emailNorm) {
      return res.status(400).json({ message: "Informe nome, CPF, OAB e e-mail." });
    }
    if (!isValidCPF(cpfLimpo)) {
      return res.status(400).json({ message: "CPF inválido." });
    }

    // Se for criar usuário junto, exige senha + confirmação
    if (criar) {
      if (!String(senha || "").trim()) {
        return res.status(400).json({ message: "Informe a senha inicial (para o usuário)." });
      }
      if (String(senha).length < 8) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 8 caracteres." });
      }
      if (!confirmarSenha || String(confirmarSenha) !== String(senha)) {
        return res.status(400).json({ message: "As senhas não conferem." });
      }
    }

    const data = {
      nome: nomeNorm,
      cpf: cpfLimpo,
      oab: oabNorm,
      email: emailNorm,
      telefone: telefoneNorm,
      ativo: true,
      ...(pixNorm !== undefined ? { chavePix: pixNorm } : {}),
    };

    if (criar) {
      const { bcrypt } = await getAuthLibs();
      const senhaHash = await bcrypt.hash(String(senha), 10);
      data.usuario = {
  create: {
    nome: nomeNorm,
    email: emailNorm,
    senhaHash,
    role: "USER",
    ativo: true,

    // ✅ AQUI: força o tipo correto
    tipoUsuario: "ADVOGADO",
  },
};

    }

    const advogado = await prisma.advogado.create({ data });
    return res.status(201).json(advogado);
  } catch (err) {
    const msg = String(err?.message || "");

    // Duplicidades (CPF/OAB/Email)
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(409).json({ message: "CPF/OAB/E-mail já cadastrado." });
    }

    console.error(err);
    return res.status(500).json({ message: "Erro ao cadastrar advogado." });
  }
});

app.put("/api/advogados/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, chavePix, senha, confirmarSenha } = req.body;

    // Normalização
    const nomeNorm = nome !== undefined ? String(nome).trim() : undefined;
    const emailNorm = email !== undefined ? normEmail(email) : undefined;
    const telNorm = telefone !== undefined ? normPhone(telefone) : undefined;
    const pixNorm = chavePix !== undefined ? normPix(chavePix) : undefined;

    // Senha com confirmação
    if (senha !== undefined && String(senha).length > 0) {
      if (!confirmarSenha || String(confirmarSenha) !== String(senha)) {
        return res.status(400).json({ message: "As senhas não conferem." });
      }
      if (String(senha).length < 8) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 8 caracteres." });
      }
    }

    const data = {
      ...(nomeNorm !== undefined ? { nome: nomeNorm } : {}),
      ...(emailNorm !== undefined ? { email: emailNorm } : {}),
      ...(telNorm !== undefined ? { telefone: telNorm } : {}),
      ...(pixNorm !== undefined ? { chavePix: pixNorm } : {}),
    };

    // Se mudou nome/email, espelha no Usuario vinculado (login)
    const userUpdate = {};
    if (nomeNorm !== undefined) userUpdate.nome = nomeNorm;
    if (emailNorm !== undefined) userUpdate.email = emailNorm;

    if (Object.keys(userUpdate).length > 0 || (senha && String(senha).length > 0)) {
      const { bcrypt } = await getAuthLibs();
      data.usuario = {
        update: {
          ...userUpdate,
          ...(senha && String(senha).length > 0
            ? { senhaHash: await bcrypt.hash(String(senha), 10) }
            : {}),
        },
      };
    }

    const advogado = await prisma.advogado.update({
      where: { id: Number(id) },
      data,
    });

    res.json(advogado);
  } catch (err) {
    // Unique violations etc.
    const msg = String(err?.message || "");
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(409).json({ message: "CPF/OAB/E-mail já cadastrado." });
    }
    console.error(err);
    res.status(500).json({ message: "Erro ao atualizar advogado." });
  }
});

// USER — Meu Perfil Profissional
app.get("/api/advogados/me", requireAuth, async (req, res) => {
  if (!req.user?.advogadoId) {
    return res.status(404).json({ message: "Usuário não vinculado a advogado." });
  }

  const advogado = await prisma.advogado.findUnique({
    where: { id: Number(req.user.advogadoId) },
  });

  if (!advogado) return res.status(404).json({ message: "Advogado não encontrado." });
  return res.json(advogado);
});

app.put("/api/advogados/me", requireAuth, async (req, res) => {
  try {
    if (!req.user?.advogadoId) {
      return res.status(404).json({ message: "Usuário não vinculado a advogado." });
    }

    const { nome, email, telefone, chavePix, senha, confirmarSenha } = req.body;

    const nomeNorm = nome !== undefined ? String(nome).trim() : undefined;
    const emailNorm = email !== undefined ? normEmail(email) : undefined;
    const telNorm = telefone !== undefined ? normPhone(telefone) : undefined;
    const pixNorm = chavePix !== undefined ? normPix(chavePix) : undefined;

    if (senha !== undefined && String(senha).length > 0) {
      if (!confirmarSenha || String(confirmarSenha) !== String(senha)) {
        return res.status(400).json({ message: "As senhas não conferem." });
      }
      if (String(senha).length < 8) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 8 caracteres." });
      }
    }

    const data = {
      ...(nomeNorm !== undefined ? { nome: nomeNorm } : {}),
      ...(emailNorm !== undefined ? { email: emailNorm } : {}),
      ...(telNorm !== undefined ? { telefone: telNorm } : {}),
      ...(pixNorm !== undefined ? { chavePix: pixNorm } : {}),
    };

    // Espelha no Usuario (login)
    const userUpdate = {};
    if (nomeNorm !== undefined) userUpdate.nome = nomeNorm;
    if (emailNorm !== undefined) userUpdate.email = emailNorm;

    if (Object.keys(userUpdate).length > 0 || (senha && String(senha).length > 0)) {
      const { bcrypt } = await getAuthLibs();
      data.usuario = {
        update: {
          ...userUpdate,
          ...(senha && String(senha).length > 0
            ? { senhaHash: await bcrypt.hash(String(senha), 10) }
            : {}),
        },
      };
    }

    const advogado = await prisma.advogado.update({
      where: { id: Number(req.user.advogadoId) },
      data,
    });

    return res.json(advogado);
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(409).json({ message: "E-mail já cadastrado." });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
});

// Admin — Ativar/Inativar Advogado (soft delete)
app.patch("/api/advogados/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;

    if (typeof ativo !== "boolean") {
      return res.status(400).json({ message: "Campo 'ativo' deve ser boolean." });
    }

    const advogado = await prisma.advogado.update({
      where: { id: Number(id) },
      data: {
        ativo,
        usuario: { update: { ativo } },
      },
    });

    return res.json(advogado);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar status." });
  }
});

// Modelo de Distribuição (admin-only)
app.get("/api/modelo-distribuicao", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.modeloDistribuicao.findMany({
      orderBy: { codigo: "asc" },
      select: {
        id: true,
        codigo: true,
        descricao: true,
        ativo: true,
        origem: true,          // ✅ add
        periodicidade: true,   // ✅ add
      },
    });

    // compat com o front
    res.json(
      rows.map((r) => ({
        id: r.id,
        cod: r.codigo,
        codigo: r.codigo,            // ✅ opcional (ajuda consistência)
        descricao: r.descricao,
        ativo: r.ativo,
        origem: r.origem,            // ✅ add
        periodicidade: r.periodicidade, // ✅ add
      }))
    );
  } catch (err) {
    console.error("[modelo-distribuicao][GET]", err);
    res.status(500).json({ message: "Erro ao listar modelos de distribuição." });
  }
});

app.post("/api/modelo-distribuicao", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { cod, descricao, ativo, periodicidade, origem } = req.body || {};

    if (!cod || !String(cod).trim()) {
      return res.status(400).json({ message: "Informe o código." });
    }
    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ message: "Informe a descrição." });
    }

    // ✅ mantém compat: se o front não mandar periodicidade, assumimos INCIDENTAL
    const per = periodicidade ? String(periodicidade).trim() : "INCIDENTAL";

    const row = await prisma.modeloDistribuicao.create({
      data: {
        codigo: String(cod).trim().toUpperCase(),
        descricao: String(descricao).trim(),
        ativo: ativo !== false,
        periodicidade: per,
        origem: origem ? String(origem).trim() : "REPASSE",
      },
      select: { id:true, codigo:true, descricao:true, ativo:true, origem:true, periodicidade:true },
    });

    res.json({
  id: row.id, cod: row.codigo, codigo: row.codigo,
  descricao: row.descricao, ativo: row.ativo,
  origem: row.origem, periodicidade: row.periodicidade
});
  } catch (err) {
    console.error("[modelo-distribuicao][POST]", err);
    res.status(500).json({ message: "Erro ao criar modelo de distribuição." });
  }
});

app.put("/api/modelo-distribuicao/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const { cod, descricao, ativo, periodicidade, origem } = req.body || {};
    const data = {};

    if (cod !== undefined) data.codigo = String(cod).trim().toUpperCase();
    if (descricao !== undefined) data.descricao = String(descricao).trim();
    if (ativo !== undefined) data.ativo = !!ativo;
    if (periodicidade !== undefined) data.periodicidade = String(periodicidade).trim();
    if (origem !== undefined) data.origem = origem ? String(origem).trim() : "REPASSE";

    const row = await prisma.modeloDistribuicao.update({
      where: { id },
      data,
      select: { id:true, codigo:true, descricao:true, ativo:true, origem:true, periodicidade:true },
    });

    res.json({
  id: row.id, cod: row.codigo, codigo: row.codigo,
  descricao: row.descricao, ativo: row.ativo,
  origem: row.origem, periodicidade: row.periodicidade
});
  } catch (err) {
    console.error("[modelo-distribuicao][PUT]", err);
    res.status(500).json({ message: "Erro ao atualizar modelo de distribuição." });
  }
});

app.delete("/api/modelo-distribuicao/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    await prisma.modeloDistribuicao.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("[modelo-distribuicao][DELETE]", err);
    res.status(500).json({ message: "Erro ao excluir modelo de distribuição." });
  }
});

// Itens do Modelo de Distribuição (admin-only)

// listar itens de um modelo
app.get("/api/modelo-distribuicao/:id/itens", requireAuth, requireAdmin, async (req, res) => {
  try {
    const modeloId = Number(req.params.id);
    if (!Number.isFinite(modeloId)) return res.status(400).json({ message: "ID inválido." });

    const itens = await prisma.modeloDistribuicaoItem.findMany({
      where: { modeloId },
      orderBy: { ordem: "asc" },
    });

    res.json(itens);
  } catch (err) {
    console.error("[modelo-distribuicao][itens][GET]", err);
    res.status(500).json({ message: "Erro ao listar itens do modelo." });
  }
});

// criar item
app.post("/api/modelo-distribuicao/:id/itens", requireAuth, requireAdmin, async (req, res) => {
  try {
    const modeloId = Number(req.params.id);
    if (!Number.isFinite(modeloId)) return res.status(400).json({ message: "ID inválido." });

    const { ordem, origem, periodicidade, destinoTipo, percentualBp, destinatario } = req.body || {};
    const o = Number(ordem);
    const p = Number(percentualBp);

    if (!Number.isFinite(o) || o <= 0) return res.status(400).json({ message: "Ordem inválida." });

    const org = String(origem || "").trim().toUpperCase();
    const per = String(periodicidade || "").trim().toUpperCase();

    if (!org) return res.status(400).json({ message: "Informe a origem." });
    if (!per) return res.status(400).json({ message: "Informe o tipo." });

    if (!destinoTipo) return res.status(400).json({ message: "Informe o destino." });
    if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ message: "Percentual inválido." });

    const row = await prisma.modeloDistribuicaoItem.create({
      data: {
        modeloId,
        ordem: o,
        origem: org,
        periodicidade: per,
        destinoTipo,
        percentualBp: p,
        destinatario: destinatario ? String(destinatario).trim() : null,
      },
    });

    res.json(row);

  } catch (err) {
    console.error("[modelo-distribuicao][itens][POST]", err);
    // unique (modeloId, ordem)
    if (err?.code === "P2002") {
      return res.status(400).json({ message: "Já existe um item com essa ordem neste modelo." });
    }
    res.status(500).json({ message: "Erro ao criar item do modelo." });
  }
});

// atualizar item
app.put("/api/modelo-distribuicao/itens/:itemId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isFinite(itemId)) return res.status(400).json({ message: "ID inválido." });

    const { ordem, origem, periodicidade, destinoTipo, percentualBp, destinatario } = req.body || {};
    const data = {};

    if (ordem !== undefined) {
      const o = Number(ordem);
      if (!Number.isFinite(o) || o <= 0) return res.status(400).json({ message: "Ordem inválida." });
      data.ordem = o;
    }

    if (origem !== undefined) {
      const org = String(origem || "").trim().toUpperCase();
      if (!org) return res.status(400).json({ message: "Informe a origem." });
      data.origem = org;
    }

    if (periodicidade !== undefined) {
      const per = String(periodicidade || "").trim().toUpperCase();
      if (!per) return res.status(400).json({ message: "Informe o tipo." });
      data.periodicidade = per;
    }

    if (destinoTipo !== undefined) data.destinoTipo = destinoTipo;

    if (percentualBp !== undefined) {
      const p = Number(percentualBp);
      if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ message: "Percentual inválido." });
      data.percentualBp = p;
    }

    if (destinatario !== undefined) data.destinatario = destinatario ? String(destinatario).trim() : null;

    const row = await prisma.modeloDistribuicaoItem.update({ where: { id: itemId }, data });
    res.json(row);

  } catch (err) {
    console.error("[modelo-distribuicao][itens][PUT]", err);
    if (err?.code === "P2002") {
      return res.status(400).json({ message: "Já existe um item com essa ordem neste modelo." });
    }
    res.status(500).json({ message: "Erro ao atualizar item do modelo." });
  }
});

// excluir item
app.delete("/api/modelo-distribuicao/itens/:itemId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isFinite(itemId)) return res.status(400).json({ message: "ID inválido." });

    await prisma.modeloDistribuicaoItem.delete({ where: { id: itemId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("[modelo-distribuicao][itens][DELETE]", err);
    res.status(500).json({ message: "Erro ao excluir item do modelo." });
  }
});

// ---------------- Alíquotas (admin-only) ----------------
app.get("/api/aliquotas", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.aliquota.findMany({
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
    });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao listar alíquotas." });
  }
});

app.post("/api/aliquotas", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { mes, ano, percentualBp } = req.body || {};
    const m = Number(mes);
    const a = Number(ano);
    const p = Number(percentualBp);

    if (!Number.isFinite(m) || m < 1 || m > 12) return res.status(400).json({ message: "Mês inválido." });
    if (!Number.isFinite(a) || a < 1900 || a > 2100) return res.status(400).json({ message: "Ano inválido." });
    if (!Number.isFinite(p) || p < 0 || p > 10000) return res.status(400).json({ message: "Percentual inválido." });

    const row = await prisma.aliquota.create({
      data: { mes: m, ano: a, percentualBp: p },
    });
    res.json(row);
  } catch (e) {
    console.error(e);
    // unique mes/ano
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ message: "Já existe alíquota para este mês/ano." });
    }
    res.status(500).json({ message: "Erro ao criar alíquota." });
  }
});

app.put("/api/aliquotas/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const { mes, ano, percentualBp } = req.body || {};
    const m = Number(mes);
    const a = Number(ano);
    const p = Number(percentualBp);

    if (!Number.isFinite(m) || m < 1 || m > 12) return res.status(400).json({ message: "Mês inválido." });
    if (!Number.isFinite(a) || a < 1900 || a > 2100) return res.status(400).json({ message: "Ano inválido." });
    if (!Number.isFinite(p) || p < 0 || p > 10000) return res.status(400).json({ message: "Percentual inválido." });

    const row = await prisma.aliquota.update({
      where: { id },
      data: { mes: m, ano: a, percentualBp: p },
    });
    res.json(row);
  } catch (e) {
    console.error(e);
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ message: "Já existe alíquota para este mês/ano." });
    }
    res.status(500).json({ message: "Erro ao atualizar alíquota." });
  }
});

app.delete("/api/aliquotas/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    await prisma.aliquota.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao excluir alíquota." });
  }
});

// =========================
// REPASSES — PRÉVIA (MVP)
// =========================
function monthRangeUTC(year, month1to12) {
  // intervalo [start, end) em UTC
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0));
  return { start, end };
}

function prevMonth(year, month1to12) {
  if (month1to12 === 1) return { year: year - 1, month: 12 };
  return { year, month: month1to12 - 1 };
}

function toCents(decimalVal) {
  if (decimalVal == null) return 0;
  const n = Number(decimalVal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function fromCents(cents) {
  return (cents || 0) / 100;
}

function bpToRate(bp) {
  // 3000 bp = 30,00% => 0.30
  return (bp || 0) / 10000;
}

app.get("/api/repasses/previa", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ano = Number(req.query.ano);
    const mes = Number(req.query.mes); // competência (M+1)
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ message: "Parâmetros inválidos. Use ?ano=YYYY&mes=1..12 (competência)." });
    }

    // M = mês anterior ao da competência (M+1)
    const { year: anoPag, month: mesPag } = prevMonth(ano, mes);
    const { start, end } = monthRangeUTC(anoPag, mesPag);

    // Alíquota da competência (ou última)
    const aliquotaExata = await prisma.aliquota.findUnique({
      where: { mes_ano: { mes, ano } },
    });

    const aliquotaUsada = aliquotaExata
      ? aliquotaExata
      : await prisma.aliquota.findFirst({
          where: {
            OR: [{ ano: { lt: ano } }, { ano: ano, mes: { lte: mes } }],
          },
          orderBy: [{ ano: "desc" }, { mes: "desc" }],
        });

    if (!aliquotaUsada) {
      return res.status(400).json({ message: "Nenhuma alíquota cadastrada ainda. Cadastre ao menos uma alíquota." });
    }

    const aliquotaBp = aliquotaUsada.percentualBp;

    // Parcelas recebidas no mês M
    const parcelas = await prisma.parcelaContrato.findMany({
      where: {
        dataRecebimento: { gte: start, lt: end },
        valorRecebido: { not: null },
        canceladaEm: null,
        contrato: { ativo: true },
      },
      include: {
        contrato: {
          include: { cliente: true },
        },
        splitsAdvogados: {
          include: { advogado: true },
        },
        modeloDistribuicao: {
          include: { itens: true },
        },
      },
      orderBy: [{ dataRecebimento: "asc" }, { id: "asc" }],
    });

    // Pegar modelos do contrato (quando não houver override na parcela)
    const contratoIdsSemModeloNaParcela = parcelas
      .filter((p) => !p.modeloDistribuicaoId)
      .map((p) => p.contratoId);

    const contratosComModelo = contratoIdsSemModeloNaParcela.length
      ? await prisma.contratoPagamento.findMany({
          where: { id: { in: [...new Set(contratoIdsSemModeloNaParcela)] } },
          select: { id: true, modeloDistribuicaoId: true },
        })
      : [];

    const contratoModeloMap = new Map(contratosComModelo.map((c) => [c.id, c.modeloDistribuicaoId]));

    // Carregar modelos necessários (itens) em batch
    const modeloIds = new Set();
    for (const p of parcelas) {
      const mid = p.modeloDistribuicaoId || contratoModeloMap.get(p.contratoId) || null;
      if (mid) modeloIds.add(mid);
    }

    const modelos = modeloIds.size
      ? await prisma.modeloDistribuicao.findMany({
          where: { id: { in: [...modeloIds] }, ativo: true },
          include: { itens: true },
        })
      : [];

    const modeloMap = new Map(modelos.map((m) => [m.id, m]));

    // Montar linhas
    const linhas = parcelas.map((p) => {
      const valorBrutoCent = toCents(p.valorRecebido);
      const impostoCent = Math.round(valorBrutoCent * bpToRate(aliquotaBp));
      const liquidoCent = valorBrutoCent - impostoCent;

      const modeloId = p.modeloDistribuicaoId || contratoModeloMap.get(p.contratoId) || null;
      const modelo = modeloId ? modeloMap.get(modeloId) : null;

      // Itens do modelo (bp sobre o líquido)
      let frBp = 0;
      let escBp = 0;
      let socioBp = 0;

      if (modelo?.itens?.length) {
        for (const it of modelo.itens) {
          if (it.destinoTipo === "FUNDO_RESERVA") frBp += it.percentualBp;
          if (it.destinoTipo === "ESCRITORIO") escBp += it.percentualBp;
          if (it.destinoTipo === "SOCIO") socioBp += it.percentualBp;
        }
      }

      const fundoReservaCent = Math.round(liquidoCent * bpToRate(frBp));
      const escritorioCent = Math.round(liquidoCent * bpToRate(escBp));
      const socioTotalCent = Math.round(liquidoCent * bpToRate(socioBp));

      // Splits dos advogados (bp sobre o LÍQUIDO) — validação: soma <= socioBp
      const advs = (p.splitsAdvogados || []).map((s) => ({
        advogadoId: s.advogadoId,
        nome: s.advogado?.nome || `Advogado #${s.advogadoId}`,
        percentualBp: s.percentualBp,
        valorCentavos: Math.round(liquidoCent * bpToRate(s.percentualBp)),
      }));

      const somaSplitsBp = advs.reduce((acc, a) => acc + (a.percentualBp || 0), 0);
      const splitOk = somaSplitsBp <= socioBp;

      return {
        parcelaId: p.id,
        contratoId: p.contratoId,
        numeroContrato: p.contrato?.numeroContrato,
        clienteId: p.contrato?.cliente?.id,
        clienteNome: p.contrato?.cliente?.nomeRazaoSocial,

        dataRecebimento: p.dataRecebimento,
        valorBruto: fromCents(valorBrutoCent),
        aliquotaBp,
        imposto: fromCents(impostoCent),
        liquido: fromCents(liquidoCent),

        modeloDistribuicaoId: modeloId,
        modeloCodigo: modelo?.codigo || null,
        modeloDescricao: modelo?.descricao || null,

        fundoReserva: fromCents(fundoReservaCent),
        escritorio: fromCents(escritorioCent),
        socioTotal: fromCents(socioTotalCent),

        advogados: advs.map((a) => ({
          advogadoId: a.advogadoId,
          nome: a.nome,
          percentualBp: a.percentualBp,
          valor: fromCents(a.valorCentavos),
        })),

        // flags para UI
        pendencias: {
          modeloAusente: !modeloId,
          splitAusenteComSocio: socioBp > 0 && advs.length === 0,
          splitExcedido: !splitOk,
        },
      };
    });

    // totais
    const totals = linhas.reduce(
      (acc, l) => {
        acc.valor += l.valorBruto;
        acc.imposto += l.imposto;
        acc.liquido += l.liquido;
        acc.escritorio += l.escritorio;
        acc.fundoReserva += l.fundoReserva;
        acc.socioTotal += l.socioTotal;

        for (const a of l.advogados || []) {
          acc.advMap.set(a.advogadoId, (acc.advMap.get(a.advogadoId) || 0) + a.valor);
        }
        return acc;
      },
      { valor: 0, imposto: 0, liquido: 0, escritorio: 0, fundoReserva: 0, socioTotal: 0, advMap: new Map() }
    );

    const advTotais = [...totals.advMap.entries()].map(([advogadoId, valor]) => ({ advogadoId, valor }));

    return res.json({
      competencia: { ano, mes },
      pagamentosConsiderados: { ano: anoPag, mes: mesPag },
      aliquotaUsada: { ano: aliquotaUsada.ano, mes: aliquotaUsada.mes, percentualBp: aliquotaBp },
      linhas,
      totais: {
        valor: totals.valor,
        imposto: totals.imposto,
        liquido: totals.liquido,
        escritorio: totals.escritorio,
        fundoReserva: totals.fundoReserva,
        socioTotal: totals.socioTotal,
        advogados: advTotais,
      },
    });
  } catch (err) {
    console.error("Erro em /api/repasses/previa:", err);
    return res.status(500).json({ message: "Erro ao gerar prévia de repasses." });
  }
});

// =========================
// REPASSES — PRÉVIA (M+1)
// =========================
function startOfMonthUTC(ano, mes1a12) {
  return new Date(Date.UTC(ano, mes1a12 - 1, 1, 0, 0, 0, 0));
}
function startOfNextMonthUTC(ano, mes1a12) {
  return new Date(Date.UTC(ano, mes1a12, 1, 0, 0, 0, 0));
}
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
}

/* =========================
   AUTH — ROTAS
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!prisma.usuario) {
      return res.status(501).json({
        message: "Auth ainda não ativado no banco. Aguarde o schema.prisma com model Usuario.",
      });
    }

    const { bcrypt, jwt } = await getAuthLibs();

    const email = String(req.body?.email || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");

    if (!email || !senha) return res.status(400).json({ message: "Informe email e senha." });

    const u = await prisma.usuario.findUnique({ where: { email } });
    if (!u || !u.ativo) return res.status(401).json({ message: "Credenciais inválidas." });

    const ok = await bcrypt.compare(senha, u.senhaHash);
    if (!ok) return res.status(401).json({ message: "Credenciais inválidas." });

    const token = jwt.sign({ role: u.role }, JWT_SECRET, {
      subject: String(u.id),
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.json({ token, user: publicUser(u) });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ message: "Erro no login" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    if (!prisma.usuario) {
      return res.status(501).json({
        message: "Auth ainda não ativado no banco. Aguarde o schema.prisma com model Usuario.",
      });
    }

    const { bcrypt } = await getAuthLibs();

    const senhaAtual = String(req.body?.senhaAtual || "");
    const novaSenha = String(req.body?.novaSenha || "");

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ message: "Informe senha atual e nova senha." });
    }
    if (novaSenha.length < 8) {
      return res.status(400).json({ message: "Nova senha deve ter no mínimo 8 caracteres." });
    }

    const u = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!u || !u.ativo) return res.status(401).json({ message: "Usuário inválido." });

    const ok = await bcrypt.compare(senhaAtual, u.senhaHash);
    if (!ok) return res.status(401).json({ message: "Senha atual inválida." });

    const novoHash = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
      where: { id: u.id },
      data: { senhaHash: novoHash },
    });

    return res.json({ message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("Erro ao trocar senha:", err);
    return res.status(500).json({ message: "Erro ao trocar senha" });
  }
});

app.post("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
  try {
    if (!prisma.usuario) {
      return res.status(501).json({
        message: "Auth ainda não ativado no banco. Aguarde o schema.prisma com model Usuario.",
      });
    }

    const { bcrypt } = await getAuthLibs();

    const nome = String(req.body?.nome || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "USER").toUpperCase();
    const senhaInicial = String(req.body?.senhaInicial || "");

    if (!nome || !email || !senhaInicial) {
      return res.status(400).json({ message: "Informe nome, email e senhaInicial." });
    }
    if (!["ADMIN", "USER"].includes(role)) {
      return res.status(400).json({ message: 'role inválido. Use "ADMIN" ou "USER".' });
    }
    if (senhaInicial.length < 8) {
      return res.status(400).json({ message: "senhaInicial deve ter no mínimo 8 caracteres." });
    }

    const senhaHash = await bcrypt.hash(senhaInicial, 10);

    const created = await prisma.usuario.create({
      data: { nome, email, role, senhaHash, ativo: true },
    });

    return res.status(201).json({ user: publicUser(created) });
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    return res.status(500).json({ message: "Erro ao criar usuário", error: err.message });
  }
});

/* =========================
   DADOS — ROTAS
========================= */

// ===== CLIENTES (Admin only) — CRUD + Soft delete =====

// helpers locais (CPF/CNPJ)
function isValidCNPJ(cnpj) {
  const s = onlyDigits(cnpj);
  if (s.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;

  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(s.slice(0, 12), w1);
  const d2 = calc(s.slice(0, 12) + String(d1), w2);

  return d1 === Number(s[12]) && d2 === Number(s[13]);
}

function isValidCpfCnpj(doc) {
  const d = onlyDigits(doc);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

function normalizeCpfCnpj(doc) {
  return onlyDigits(doc);
}

// ✅ GET /api/clients — Admin only
app.get("/api/clients", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nomeRazaoSocial: "asc" },
    });

    // serializeCliente espera ordens no objeto (mesmo que vazio)
    res.json(clientes.map((c) => serializeCliente({ ...c, ordens: [] })));
  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
});

// ✅ POST /api/clients — cria só o cliente (sem ordem)
app.post("/api/clients", requireAuth, requireAdmin, async (req, res) => {
  try {
    const cpfCnpj = normalizeCpfCnpj(req.body?.cpfCnpj || "");
    const nomeRazaoSocial = String(req.body?.nomeRazaoSocial || "").trim();
    const email = req.body?.email ? normEmail(req.body.email) : null;
    const telefone = req.body?.telefone ? normPhone(req.body.telefone) : null;
    const observacoes = req.body?.observacoes ? String(req.body.observacoes).trim() : null;

    if (!cpfCnpj) return res.status(400).json({ message: "Informe CPF ou CNPJ." });
    if (!isValidCpfCnpj(cpfCnpj)) return res.status(400).json({ message: "CPF/CNPJ inválido." });
    if (!nomeRazaoSocial) return res.status(400).json({ message: "Informe Nome/Razão Social." });

    // telefone: se veio algo e não for 10/11 dígitos, rejeita
    if (req.body?.telefone && (!telefone || (telefone.length !== 10 && telefone.length !== 11))) {
      return res.status(400).json({ message: "Telefone inválido." });
    }

    const created = await prisma.cliente.create({
      data: {
        cpfCnpj,
        nomeRazaoSocial,
        email,
        telefone,
        observacoes,
        ativo: true,
      },
    });

    return res.status(201).json(serializeCliente({ ...created, ordens: [] }));
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Já existe cliente com este CPF/CNPJ." });
    }
    console.error("Erro ao criar cliente:", err);
    return res.status(500).json({ message: "Erro ao criar cliente." });
  }
});

// ✅ PUT /api/clients/:id — edita dados
app.put("/api/clients/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const cpfCnpj = req.body?.cpfCnpj !== undefined ? normalizeCpfCnpj(req.body.cpfCnpj) : undefined;
    const nomeRazaoSocial =
      req.body?.nomeRazaoSocial !== undefined ? String(req.body.nomeRazaoSocial || "").trim() : undefined;

    const email = req.body?.email !== undefined ? (req.body.email ? normEmail(req.body.email) : null) : undefined;
    const telefone =
      req.body?.telefone !== undefined ? (req.body.telefone ? normPhone(req.body.telefone) : null) : undefined;

    const observacoes =
      req.body?.observacoes !== undefined ? (req.body.observacoes ? String(req.body.observacoes).trim() : null) : undefined;

    if (cpfCnpj !== undefined) {
      if (!cpfCnpj) return res.status(400).json({ message: "Informe CPF ou CNPJ." });
      if (!isValidCpfCnpj(cpfCnpj)) return res.status(400).json({ message: "CPF/CNPJ inválido." });
    }
    if (nomeRazaoSocial !== undefined && !nomeRazaoSocial) {
      return res.status(400).json({ message: "Informe Nome/Razão Social." });
    }
    if (req.body?.telefone !== undefined && req.body.telefone && (!telefone || (telefone.length !== 10 && telefone.length !== 11))) {
      return res.status(400).json({ message: "Telefone inválido." });
    }

    const updated = await prisma.cliente.update({
      where: { id },
      data: {
        ...(cpfCnpj !== undefined ? { cpfCnpj } : {}),
        ...(nomeRazaoSocial !== undefined ? { nomeRazaoSocial } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(telefone !== undefined ? { telefone } : {}),
        ...(observacoes !== undefined ? { observacoes } : {}),
      },
    });

    return res.json(serializeCliente({ ...updated, ordens: [] }));
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Já existe cliente com este CPF/CNPJ." });
    }
    console.error("Erro ao atualizar cliente:", err);
    return res.status(500).json({ message: "Erro ao atualizar cliente." });
  }
});

// ✅ PATCH /api/clients/:id/toggle — Ativar/Inativar (soft delete)
app.patch("/api/clients/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const current = await prisma.cliente.findUnique({ where: { id }, select: { ativo: true } });
    if (!current) return res.status(404).json({ message: "Cliente não encontrado." });

    const updated = await prisma.cliente.update({
      where: { id },
      data: { ativo: !current.ativo },
    });

    return res.json({ id: updated.id, ativo: updated.ativo });
  } catch (err) {
    console.error("Erro ao alternar status do cliente:", err);
    return res.status(500).json({ message: "Erro ao ativar/inativar cliente." });
  }
});


app.get("/api/orders", async (_req, res) => {
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

app.get("/api/config/distribution-models", async (_req, res) => {
  try {
    // ⚠️ Ajuste aqui se o campo for "cod" no schema atual:
    const modelos = await prisma.modeloDistribuicao.findMany({
      orderBy: [{ cod: "asc" }, { id: "asc" }],
    });
    res.json(modelos);
  } catch (err) {
    console.error("Erro ao listar modelos de distribuição:", err);
    res.status(500).json({ message: "Erro ao listar modelos de distribuição" });
  }
});

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

      if (client.id) {
        cliente = await tx.cliente.findUnique({ where: { id: client.id } });
        if (!cliente) throw new Error("Cliente informado não existe.");
      } else {
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

      const ultimaOrdem = await tx.ordemPagamento.findFirst({
        where: { clienteId: cliente.id },
        orderBy: { sequenciaCliente: "desc" },
      });
      const proximaSequencia = (ultimaOrdem?.sequenciaCliente ?? 0) + 1;

      const dataInicio = parseDateInput(order.dataInicio);
      const anoMesInicio = calcAnoMes(dataInicio);
      const dataFimPrevista = parseDateInput(order.dataFimPrevista);

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
          anoMesInicio: anoMesInicio ?? null,
        },
      });

      return { cliente, ordem: novaOrdem };
    });

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

app.get("/api/clients-with-orders", requireAuth, requireAdmin, async (req, res) => {
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

app.get("/api/dashboard/summary", async (_req, res) => {
  try {
    const [totalClients, totalOrders, totalAtivas, totalConcluidas, sumValores] =
      await Promise.all([
        prisma.cliente.count(),
        prisma.ordemPagamento.count(),
        prisma.ordemPagamento.count({ where: { status: "ATIVA" } }),
        prisma.ordemPagamento.count({ where: { status: "CONCLUIDA" } }),
        prisma.ordemPagamento.aggregate({ _sum: { valorTotalPrevisto: true } }),
      ]);

    const totalValorPrevisto = toNumberOrNull(sumValores?._sum?.valorTotalPrevisto) ?? 0;

    const ordensPorMes = await prisma.ordemPagamento
      .groupBy({
        by: ["anoMesInicio"],
        _count: { _all: true },
        _sum: { valorTotalPrevisto: true },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
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
      totalValorPrevisto,
      totalValorPrevistoBR: formatBRL(totalValorPrevisto),
      ordensPorMes,
    });
  } catch (err) {
    console.error("Erro no dashboard:", err);
    res.status(500).json({ message: "Erro ao carregar dashboard" });
  }
});

/* =========================
   USUÁRIOS (ADMIN) + ME (USER)
========================= */

// CPF validation (backend)
function isValidCPF(cpf) {
  const s = onlyDigits(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(s.slice(0, 9), 10);
  const d2 = calc(s.slice(0, 10), 11);
  return d1 === Number(s[9]) && d2 === Number(s[10]);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeTelefone(v) {
  const d = onlyDigits(v);
  if (!d) return null;
  // BR: 10 (fixo) ou 11 (celular)
  if (d.length !== 10 && d.length !== 11) return null;
  return d;
}

// ADMIN: list
app.get("/api/usuarios", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
  orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  select: {
    id: true,
    nome: true,
    email: true,
    role: true,
    tipoUsuario: true,
    cpf: true,
    telefone: true,
    advogadoId: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    advogado: {
      select: {
        cpf: true,
        telefone: true,
        email: true,
        nome: true,
      },
    },
  },
});


    res.json(
  usuarios.map((u) => ({
    ...u,
    cpf: u.cpf ?? u.advogado?.cpf ?? null,
    telefone: u.telefone ?? u.advogado?.telefone ?? null,
    email: u.email ?? u.advogado?.email ?? null,
    createdAtBR: formatDateBR(u.createdAt),
    updatedAtBR: formatDateBR(u.updatedAt),
  }))
);
  } catch (err) {
    console.error("Erro ao listar usuarios:", err);
    res.status(500).json({ message: "Erro ao listar usuários." });
  }
});

// ADMIN: create
app.post("/api/usuarios", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bcrypt } = await getAuthLibs();

    const nome = String(req.body?.nome || "").trim();
    const email = normalizeEmail(req.body?.email);
    const role = String(req.body?.role || "USER").toUpperCase();
    const tipoUsuario = String(req.body?.tipoUsuario || "USUARIO").toUpperCase();

    const cpf = req.body?.cpf ? onlyDigits(req.body.cpf) : null;
    const telefone = req.body?.telefone ? normalizeTelefone(req.body.telefone) : null;

    const advogadoId = req.body?.advogadoId ? Number(req.body.advogadoId) : null;

    const senha = String(req.body?.senha || "");
    const senhaConfirmacao = String(req.body?.senhaConfirmacao || "");

    if (!nome) return res.status(400).json({ message: "Informe o nome." });
    if (!email) return res.status(400).json({ message: "Informe o e-mail." });
    if (!["ADMIN", "USER"].includes(role)) return res.status(400).json({ message: "Role inválido." });
    if (!["ADVOGADO", "USUARIO", "ESTAGIARIO"].includes(tipoUsuario))
      return res.status(400).json({ message: "Tipo de usuário inválido." });

    // CPF obrigatório para usuário comum/estagiário
    if (tipoUsuario === "USUARIO" || tipoUsuario === "ESTAGIARIO") {
      if (!cpf) return res.status(400).json({ message: "CPF é obrigatório para Usuário/Estagiário." });
      if (!isValidCPF(cpf)) return res.status(400).json({ message: "CPF inválido." });
    } else if (cpf && !isValidCPF(cpf)) {
      return res.status(400).json({ message: "CPF inválido." });
    }

    if (req.body?.telefone && !telefone) {
      return res.status(400).json({ message: "Telefone inválido." });
    }

    // ADVOGADO precisa estar vinculado
    if (tipoUsuario === "ADVOGADO") {
      if (!advogadoId || !Number.isFinite(advogadoId)) {
        return res.status(400).json({ message: "Para tipo Advogado, informe advogadoId." });
      }
      const adv = await prisma.advogado.findUnique({ where: { id: advogadoId } });
      if (!adv) return res.status(400).json({ message: "Advogado não encontrado para vinculação." });
    }

    if (!senha || senha.length < 8) {
      return res.status(400).json({ message: "Senha obrigatória (mínimo 8 caracteres)." });
    }
    if (senha !== senhaConfirmacao) {
      return res.status(400).json({ message: "As senhas não conferem." });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const novo = await prisma.usuario.create({
      data: {
        nome,
        email,
        role,
        tipoUsuario,
        cpf,
        telefone,
        advogadoId,
        senhaHash,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        tipoUsuario: true,
        cpf: true,
        telefone: true,
        advogadoId: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      ...novo,
      createdAtBR: formatDateBR(novo.createdAt),
      updatedAtBR: formatDateBR(novo.updatedAt),
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : "campo";
      return res.status(409).json({ message: `Já existe usuário com este ${target}.` });
    }
    console.error("Erro ao criar usuario:", err);
    res.status(500).json({ message: "Erro ao criar usuário." });
  }
});

// ADMIN: update
app.put("/api/usuarios/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const { bcrypt } = await getAuthLibs();

    const nome = req.body?.nome !== undefined ? String(req.body.nome || "").trim() : undefined;
    const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : undefined;
    const role = req.body?.role !== undefined ? String(req.body.role || "").toUpperCase() : undefined;
    const tipoUsuario =
      req.body?.tipoUsuario !== undefined ? String(req.body.tipoUsuario || "").toUpperCase() : undefined;

    const cpf = req.body?.cpf !== undefined ? (req.body.cpf ? onlyDigits(req.body.cpf) : null) : undefined;
    const telefone =
      req.body?.telefone !== undefined ? (req.body.telefone ? normalizeTelefone(req.body.telefone) : null) : undefined;

    const advogadoId =
      req.body?.advogadoId !== undefined ? (req.body.advogadoId ? Number(req.body.advogadoId) : null) : undefined;

    const senha = req.body?.senha ? String(req.body.senha) : "";
    const senhaConfirmacao = req.body?.senhaConfirmacao ? String(req.body.senhaConfirmacao) : "";

    if (role !== undefined && !["ADMIN", "USER"].includes(role)) {
      return res.status(400).json({ message: "Role inválido." });
    }
    if (tipoUsuario !== undefined && !["ADVOGADO", "USUARIO", "ESTAGIARIO"].includes(tipoUsuario)) {
      return res.status(400).json({ message: "Tipo de usuário inválido." });
    }
    if (cpf !== undefined && cpf && !isValidCPF(cpf)) return res.status(400).json({ message: "CPF inválido." });
    if (req.body?.telefone !== undefined && req.body.telefone && !telefone)
      return res.status(400).json({ message: "Telefone inválido." });

    const current = await prisma.usuario.findUnique({ where: { id }, select: { tipoUsuario: true, cpf: true, advogadoId: true } });
    if (!current) return res.status(404).json({ message: "Usuário não encontrado." });

    const finalTipo = tipoUsuario ?? current.tipoUsuario;
    const finalCpf = cpf === undefined ? current.cpf : cpf;

    if (finalTipo === "USUARIO" || finalTipo === "ESTAGIARIO") {
      if (!finalCpf) return res.status(400).json({ message: "CPF é obrigatório para Usuário/Estagiário." });
      if (!isValidCPF(finalCpf)) return res.status(400).json({ message: "CPF inválido." });
    }

    if (finalTipo === "ADVOGADO") {
      const advIdEffective = advogadoId === undefined ? current.advogadoId : advogadoId;
      if (!advIdEffective) return res.status(400).json({ message: "Para tipo Advogado, informe advogadoId." });
      const adv = await prisma.advogado.findUnique({ where: { id: advIdEffective } });
      if (!adv) return res.status(400).json({ message: "Advogado não encontrado para vinculação." });
    }

    const data = {
      ...(nome !== undefined ? { nome } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(tipoUsuario !== undefined ? { tipoUsuario } : {}),
      ...(cpf !== undefined ? { cpf } : {}),
      ...(telefone !== undefined ? { telefone } : {}),
      ...(advogadoId !== undefined ? { advogadoId } : {}),
    };

    if (senha || senhaConfirmacao) {
      if (!senha || senha.length < 8) return res.status(400).json({ message: "Nova senha deve ter no mínimo 8 caracteres." });
      if (senha !== senhaConfirmacao) return res.status(400).json({ message: "As senhas não conferem." });
      data.senhaHash = await bcrypt.hash(String(senha), 10);
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        tipoUsuario: true,
        cpf: true,
        telefone: true,
        advogadoId: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      ...updated,
      createdAtBR: formatDateBR(updated.createdAt),
      updatedAtBR: formatDateBR(updated.updatedAt),
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : "campo";
      return res.status(409).json({ message: `Já existe usuário com este ${target}.` });
    }
    console.error("Erro ao atualizar usuario:", err);
    res.status(500).json({ message: "Erro ao atualizar usuário." });
  }
});

// ADMIN: ativar/inativar
app.patch("/api/usuarios/:id/ativo", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ativo = Boolean(req.body?.ativo);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const u = await prisma.usuario.update({
      where: { id },
      data: { ativo },
      select: { id: true, ativo: true },
    });

    res.json(u);
  } catch (err) {
    console.error("Erro ao mudar ativo usuario:", err);
    res.status(500).json({ message: "Erro ao alterar status." });
  }
});

// USER: me (somente para usuário NÃO vinculado a advogado)
app.get("/api/usuarios/me", requireAuth, async (req, res) => {
  try {
    if (req.user?.advogadoId) {
      return res.status(400).json({ message: "Perfil de advogado deve ser acessado em /api/advogados/me." });
    }
    const u = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        tipoUsuario: true,
        cpf: true,
        telefone: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!u || !u.ativo) return res.status(404).json({ message: "Usuário não encontrado." });

    res.json({
      ...u,
      createdAtBR: formatDateBR(u.createdAt),
      updatedAtBR: formatDateBR(u.updatedAt),
    });
  } catch (err) {
    console.error("Erro ao ler usuario/me:", err);
    res.status(500).json({ message: "Erro ao carregar perfil." });
  }
});

app.put("/api/usuarios/me", requireAuth, async (req, res) => {
  try {
    if (req.user?.advogadoId) {
      return res.status(400).json({ message: "Perfil de advogado deve ser atualizado em /api/advogados/me." });
    }

    const { bcrypt } = await getAuthLibs();

    const nome = req.body?.nome !== undefined ? String(req.body.nome || "").trim() : undefined;
    const email = req.body?.email !== undefined ? normalizeEmail(req.body.email) : undefined;
    const cpf = req.body?.cpf !== undefined ? (req.body.cpf ? onlyDigits(req.body.cpf) : null) : undefined;
    const telefone =
      req.body?.telefone !== undefined ? (req.body.telefone ? normalizeTelefone(req.body.telefone) : null) : undefined;

    const senha = req.body?.senha ? String(req.body.senha) : "";
    const senhaConfirmacao = req.body?.senhaConfirmacao ? String(req.body.senhaConfirmacao) : "";

    if (cpf !== undefined && cpf && !isValidCPF(cpf)) return res.status(400).json({ message: "CPF inválido." });
    if (req.body?.telefone !== undefined && req.body.telefone && !telefone)
      return res.status(400).json({ message: "Telefone inválido." });

    const current = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { tipoUsuario: true, cpf: true, ativo: true },
    });
    if (!current || !current.ativo) return res.status(404).json({ message: "Usuário não encontrado." });

    const finalTipo = current.tipoUsuario;
    const finalCpf = cpf === undefined ? current.cpf : cpf;

    if (finalTipo === "USUARIO" || finalTipo === "ESTAGIARIO") {
      if (!finalCpf) return res.status(400).json({ message: "CPF é obrigatório para Usuário/Estagiário." });
      if (!isValidCPF(finalCpf)) return res.status(400).json({ message: "CPF inválido." });
    }

    const data = {
      ...(nome !== undefined ? { nome } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(cpf !== undefined ? { cpf } : {}),
      ...(telefone !== undefined ? { telefone } : {}),
    };

    if (senha || senhaConfirmacao) {
      if (!senha || senha.length < 8) return res.status(400).json({ message: "Nova senha deve ter no mínimo 8 caracteres." });
      if (senha !== senhaConfirmacao) return res.status(400).json({ message: "As senhas não conferem." });
      data.senhaHash = await bcrypt.hash(String(senha), 10);
    }

    const updated = await prisma.usuario.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        tipoUsuario: true,
        cpf: true,
        telefone: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      ...updated,
      createdAtBR: formatDateBR(updated.createdAt),
      updatedAtBR: formatDateBR(updated.updatedAt),
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : "campo";
      return res.status(409).json({ message: `Já existe usuário com este ${target}.` });
    }
    console.error("Erro ao atualizar usuario/me:", err);
    res.status(500).json({ message: "Erro ao atualizar perfil." });
  }
});

/* =========================
   404 + Error handler (sempre JSON)
========================= */
// =========================
// PAGAMENTOS (CONTRATOS + PARCELAS) — Admin only (por enquanto)
// =========================

// Listar contratos (com cliente + parcelas)
app.get("/api/contratos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
const qDigits = onlyDigits(q);

// 1) Descobre clientes pelo nome (não-relacional, blindado)
let clienteIds = [];
if (q) {
  const clientes = await prisma.cliente.findMany({
    where: { nomeRazaoSocial: { contains: q, mode: "insensitive" } },
    select: { id: true },
    take: 200,
  });
  clienteIds = clientes.map((c) => c.id);
}

const where = q
  ? {
      OR: [
        // Contrato
        { numeroContrato: { contains: q, mode: "insensitive" } },

        // CPF/CNPJ (com máscara ou não)
        { cliente: { cpfCnpj: { contains: qDigits } } },

        // ✅ Cliente por ID (garante busca por nome)
        ...(clienteIds.length ? [{ clienteId: { in: clienteIds } }] : []),
      ],
    }
  : undefined;

    const contratos = await prisma.contratoPagamento.findMany({
      where,
      include: {
        cliente: true,
        contratoOrigem: { select: { id: true, numeroContrato: true } },
        renegociadoPara: { select: { id: true, numeroContrato: true } },
        parcelas: {
          orderBy: { numero: "asc" },
          include: {
            canceladaPor: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    const out = contratos.map((c) => {
      const parcelas = c.parcelas || [];
      const recebidas = parcelas.filter((p) => p.status === "RECEBIDA");
      const totalRecebido = recebidas.reduce((acc, p) => {
        const movs = Array.isArray(p.movimentos) ? p.movimentos : [];
        const somaMovs = movs.reduce((s, m) => s + Number(m.valor || 0), 0);
        const efetivo = Number(p.valorRecebido || 0) + somaMovs;
        return acc + efetivo;
      }, 0);

      return {
        id: c.id,
        numeroContrato: c.numeroContrato,
        renegociadoParaId: c.renegociadoParaId,
        contratoOrigemId: c.contratoOrigemId,
        contratoOrigem: c.contratoOrigem ? { id: c.contratoOrigem.id, numeroContrato: c.contratoOrigem.numeroContrato } : null,
        renegociadoPara: c.renegociadoPara ? { id: c.renegociadoPara.id, numeroContrato: c.renegociadoPara.numeroContrato } : null,
        clienteId: c.clienteId,
        cliente: serializeCliente({ ...c.cliente, ordens: [] }),
        valorTotal: c.valorTotal,
        formaPagamento: c.formaPagamento,
        ativo: c.ativo,
        observacoes: c.observacoes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        parcelas,
        resumo: {
          qtdParcelas: parcelas.length,
          qtdRecebidas: recebidas.length,
          totalRecebido,
        },
      };
    });

    res.json(out);
  } catch (err) {
    console.error("Erro ao listar contratos:", err);
    res.status(500).json({ message: "Erro ao listar pagamentos (contratos)." });
  }
});

// Criar contrato + gerar parcelas
// Body esperado (flexível):
// {
//   clienteId, numeroContrato, valorTotal, formaPagamento,
//   avista?: { vencimento },
//   entrada?: { valor, vencimento },
//   parcelas?: { quantidade, primeiroVencimento, valorParcela? },
//   observacoes?
// }
app.post("/api/contratos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      clienteId,
      numeroContrato,
      valorTotal,
      formaPagamento,
      avista,
      entrada,
      parcelas,
      observacoes,
    } = req.body || {};

    if (!clienteId) return res.status(400).json({ message: "Informe o cliente." });
    if (!numeroContrato) return res.status(400).json({ message: "Informe o número do contrato." });

    const cliente = await prisma.cliente.findUnique({ where: { id: Number(clienteId) } });
    if (!cliente) return res.status(404).json({ message: "Cliente não encontrado." });

    const totalCents = moneyToCents(valorTotal);
    if (totalCents === null) return res.status(400).json({ message: "Informe o valor total do contrato." });
    if (totalCents <= 0n) return res.status(400).json({ message: "O valor total precisa ser maior que zero." });

    const fp = (formaPagamento || "").toString().trim().toUpperCase();
    if (!["AVISTA", "ENTRADA_PARCELAS", "PARCELADO"].includes(fp)) {
      return res.status(400).json({
        message: "Forma de pagamento inválida. Use AVISTA, ENTRADA_PARCELAS ou PARCELADO.",
      });
    }

    const parseDate = (v, field) => {
      const d = parseDateInput(v);
      if (!d) throw new Error(`Data inválida em ${field}. Use DD/MM/AAAA.`);
      return d;
    };

    let parcelasPlan = [];

    if (fp === "AVISTA") {
      const venc = parseDate(avista?.vencimento, "avista.vencimento");
      parcelasPlan = [{ numero: 1, vencimento: venc, valorCents: totalCents }];
    }

    if (fp === "PARCELADO") {
      const qtd = Number(parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas." });

      const primeiroVenc = parseDate(parcelas?.primeiroVencimento, "parcelas.primeiroVencimento");

      let valoresCents;
      if (parcelas?.valorParcela !== undefined && parcelas?.valorParcela !== null && parcelas?.valorParcela !== "") {
        const vParc = moneyToCents(parcelas.valorParcela);
        if (vParc === null || vParc <= 0n) return res.status(400).json({ message: "Valor da parcela inválido." });
        valoresCents = Array.from({ length: qtd }, () => vParc);
        const soma = valoresCents.reduce((a, b) => a + b, 0n);
        if (soma !== totalCents) {
          return res.status(400).json({
            message:
              "Soma das parcelas diferente do valor total. Ajuste o valor da parcela ou remova para dividir automaticamente.",
          });
        }
      } else {
        valoresCents = splitCents(totalCents, qtd);
      }

      for (let i = 0; i < qtd; i++) {
        const venc = new Date(primeiroVenc);
        venc.setMonth(venc.getMonth() + i);
        parcelasPlan.push({ numero: i + 1, vencimento: venc, valorCents: valoresCents[i] });
      }
    }

    if (fp === "ENTRADA_PARCELAS") {
      const eValorCents = moneyToCents(entrada?.valor);
      if (eValorCents === null || eValorCents <= 0n) return res.status(400).json({ message: "Informe o valor da entrada." });
      if (eValorCents >= totalCents) return res.status(400).json({ message: "A entrada deve ser menor que o valor total." });

      const eVenc = parseDate(entrada?.vencimento, "entrada.vencimento");

      const qtd = Number(parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas (após a entrada)." });

      const primeiroVenc = parseDate(parcelas?.primeiroVencimento, "parcelas.primeiroVencimento");

      const restante = totalCents - eValorCents;

      let valoresCents;
      if (parcelas?.valorParcela !== undefined && parcelas?.valorParcela !== null && parcelas?.valorParcela !== "") {
        const vParc = moneyToCents(parcelas.valorParcela);
        if (vParc === null || vParc <= 0n) return res.status(400).json({ message: "Valor da parcela inválido." });
        valoresCents = Array.from({ length: qtd }, () => vParc);
        const soma = valoresCents.reduce((a, b) => a + b, 0n);
        if (soma !== restante) {
          return res.status(400).json({
            message:
              "Soma das parcelas diferente do restante (total - entrada). Ajuste o valor da parcela ou remova para dividir automaticamente.",
          });
        }
      } else {
        valoresCents = splitCents(restante, qtd);
      }

      parcelasPlan.push({ numero: 1, vencimento: eVenc, valorCents: eValorCents });

      for (let i = 0; i < qtd; i++) {
        const venc = new Date(primeiroVenc);
        venc.setMonth(venc.getMonth() + i);
        parcelasPlan.push({ numero: i + 2, vencimento: venc, valorCents: valoresCents[i] });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const contrato = await tx.contratoPagamento.create({
        data: {
          clienteId: Number(clienteId),
          numeroContrato: String(numeroContrato).trim(),
          valorTotal: centsToDecimalString(totalCents),
          formaPagamento: fp,
          observacoes: observacoes ? String(observacoes) : null,
        },
      });

      const parcelasData = parcelasPlan.map((p) => ({
        contratoId: contrato.id,
        numero: p.numero,
        vencimento: p.vencimento,
        valorPrevisto: centsToDecimalString(p.valorCents),
      }));

      await tx.parcelaContrato.createMany({ data: parcelasData });

      return tx.contratoPagamento.findUnique({
        where: { id: contrato.id },
        include: {
  cliente: true,
  parcelas: {
    orderBy: { numero: "asc" },
    include: {
      canceladaPor: {
        select: { id: true, nome: true }
      },
      movimentos: {
        orderBy: { createdAt: "asc" },
        include: { criadoPor: { select: { id: true, nome: true } } }
      }
    }
  }
}
,
      });
    });

    res.status(201).json(created);
  } catch (err) {
    if (err?.code === "P2002") return res.status(409).json({ message: "Número de contrato já existe." });
    console.error("Erro ao criar contrato:", err);
    res.status(500).json({ message: err?.message || "Erro ao criar contrato." });
  }
});

// Atualizar contrato (não mexe automaticamente nas parcelas — por segurança)
app.put("/api/contratos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { numeroContrato, valorTotal, formaPagamento, observacoes } = req.body || {};

    const data = {};

    if (numeroContrato !== undefined) data.numeroContrato = String(numeroContrato).trim();

    if (valorTotal !== undefined) {
      const cents = moneyToCents(valorTotal);
      if (cents === null || cents <= 0n) return res.status(400).json({ message: "Valor total inválido." });
      data.valorTotal = centsToDecimalString(cents);
    }

    if (formaPagamento !== undefined) {
      const fp = String(formaPagamento).trim().toUpperCase();
      if (!["AVISTA", "ENTRADA_PARCELAS", "PARCELADO"].includes(fp)) {
        return res.status(400).json({ message: "Forma de pagamento inválida." });
      }
      data.formaPagamento = fp;
    }

    if (observacoes !== undefined) data.observacoes = observacoes ? String(observacoes) : null;

    const updated = await prisma.contratoPagamento.update({
      where: { id },
      data,
      include: {
        cliente: true,
        parcelas: {
          orderBy: { numero: "asc" },
          include: {
            canceladaPor: {
              select: { id: true, nome: true }
            },
            movimentos: {
              orderBy: { createdAt: "asc" },
              include: { criadoPor: { select: { id: true, nome: true } } }
            }
          }
        }
      },
    });

    res.json(updated);
  } catch (err) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Contrato não encontrado." });
    if (err?.code === "P2002") return res.status(409).json({ message: "Número de contrato já existe." });
    console.error("Erro ao atualizar contrato:", err);
    res.status(500).json({ message: "Erro ao atualizar contrato." });
  }
});

// =========================
// CONTRATOS — REPASSE CONFIG (admin-only)
// PATCH /api/contratos/:id/repasse-config
// =========================
app.patch("/api/contratos/:id/repasse-config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    if (!Number.isFinite(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido." });
    }

    const {
      modeloDistribuicaoId,
      usaSplitSocio,
      advogadoPrincipalId,
      splits, // [{ advogadoId, percentualBp }]
    } = req.body || {};

    const modeloId = modeloDistribuicaoId == null ? null : Number(modeloDistribuicaoId);
    if (modeloId !== null && !Number.isFinite(modeloId)) {
      return res.status(400).json({ message: "modeloDistribuicaoId inválido." });
    }

    const usaSplit = Boolean(usaSplitSocio);

    const advPrincipalId =
      advogadoPrincipalId == null || advogadoPrincipalId === ""
        ? null
        : Number(advogadoPrincipalId);

    // Regra C: sem split => exige 1 advogado principal
    if (!usaSplit) {
      if (!Number.isFinite(advPrincipalId)) {
        return res.status(400).json({ message: "Selecione o Advogado Principal (sem split)." });
      }
    }

    // garante que contrato existe
    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      select: { id: true },
    });
    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });

    // %SOCIO do modelo para validar splits
    let socioBp = null;
    if (modeloId !== null) {
      const modelo = await prisma.modeloDistribuicao.findUnique({
        where: { id: modeloId },
        include: { itens: true },
      });
      if (!modelo) return res.status(400).json({ message: "Modelo de distribuição não encontrado." });

      const itemSocio = (modelo.itens || []).find((it) => it.destinatario === "SOCIO");
      socioBp = itemSocio ? Number(itemSocio.percentualBp) : 0;
      if (!Number.isFinite(socioBp)) socioBp = 0;
    }

    const splitsArr = Array.isArray(splits) ? splits : [];
    const normalizedSplits = splitsArr
      .map((s) => ({
        advogadoId: Number(s?.advogadoId),
        percentualBp: Number(s?.percentualBp),
      }))
      .filter((s) => Number.isFinite(s.advogadoId) && Number.isFinite(s.percentualBp) && s.percentualBp > 0);

    if (usaSplit) {
      if (normalizedSplits.length < 2) {
        return res.status(400).json({ message: "Split ativado: informe ao menos 2 advogados com percentual." });
      }
      const somaBp = normalizedSplits.reduce((acc, s) => acc + s.percentualBp, 0);
      if (socioBp !== null && somaBp > socioBp) {
        return res.status(400).json({
          message: `Split excede o percentual do SOCIO no modelo. Soma: ${somaBp} bp; SOCIO: ${socioBp} bp.`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const contratoUpd = await tx.contratoPagamento.update({
        where: { id: contratoId },
        data: {
          modeloDistribuicaoId: modeloId,
          usaSplitSocio: usaSplit,
          repasseAdvogadoPrincipalId: usaSplit ? null : advPrincipalId,
        },
        select: {
          id: true,
          modeloDistribuicaoId: true,
          usaSplitSocio: true,
          repasseAdvogadoPrincipalId: true,
        },
      });

      // split OFF: limpa tabela de splits
      if (!usaSplit) {
        await tx.contratoRepasseSplitAdvogado.deleteMany({ where: { contratoId } });
        return { contrato: contratoUpd, splits: [] };
      }

      // split ON: substitui tudo
      await tx.contratoRepasseSplitAdvogado.deleteMany({ where: { contratoId } });
      await tx.contratoRepasseSplitAdvogado.createMany({
        data: normalizedSplits.map((s) => ({
          contratoId,
          advogadoId: s.advogadoId,
          percentualBp: s.percentualBp,
        })),
      });

      const splitsSaved = await tx.contratoRepasseSplitAdvogado.findMany({
        where: { contratoId },
        include: { advogado: true },
        orderBy: [{ id: "asc" }],
      });

      return { contrato: contratoUpd, splits: splitsSaved };
    });

    return res.json(result);
  } catch (err) {
    console.error("[contratos][repasse-config][PATCH]", err);
    return res.status(500).json({ message: "Erro ao salvar configuração de repasse do contrato." });
  }
});

// =====================
// ADMIN-ONLY: EDIÇÃO (restrita) e RETIFICAÇÃO (auditável)
// Decisão do projeto:
// - "Editar" = somente observações (texto) + confirmação de senha
// - "Retificar" = correção de vencimento/valor (e, no verde, reestruturação) com LOG
// =====================

// Editar contrato (somente observações)
app.put("/api/contratos/:id/admin-edit", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido." });

    const { adminPassword, observacoes } = req.body || {};
    const ok = await requireAdminPassword(req, res, adminPassword);
    if (!ok) return;

    const updated = await prisma.contratoPagamento.update({
      where: { id },
      data: {
        observacoes: observacoes === undefined ? undefined : String(observacoes),
      },
      include: {
        cliente: true,
        contratoOrigem: { select: { id: true, numeroContrato: true } },
        renegociadoPara: { select: { id: true, numeroContrato: true } },
        parcelas: { orderBy: { numero: "asc" }, include: { canceladaPor: { select: { id: true, nome: true } } } },
      },
    });

    return res.json(updated);
  } catch (err) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Contrato não encontrado." });
    console.error("Erro ao editar observações do contrato:", err);
    return res.status(500).json({ message: "Erro ao editar observações do contrato." });
  }
});

// Editar parcela (desativado; use retificação)
app.put("/api/parcelas/:id/admin-edit", requireAuth, requireAdmin, async (_req, res) => {
  return res.status(400).json({
    message: "Edição direta de parcela foi desativada. Use Retificar (admin) para correção com log.",
  });
});

// Retificar parcela (auditável)
// Retificar parcela (auditável) — preserva total do contrato/renegociação
app.post("/api/parcelas/:id/retificar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parcelaId = Number(req.params.id);
    if (!Number.isFinite(parcelaId)) return res.status(400).json({ message: "ID inválido." });

    const { adminPassword, motivo, patch, ratearEntreDemais, valoresOutrasParcelas } = req.body || {};

    // ✅ mantém seu padrão: senha admin via bcrypt (já existente no server)
    const ok = await requireAdminPassword(req, res, adminPassword);
    if (!ok) return;

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo da retificação." });

    // carrega parcela + contrato + parcelas
    const parcela = await prisma.parcelaContrato.findUnique({
      where: { id: parcelaId },
      include: { contrato: { include: { parcelas: true } } },
    });
    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });
    if (parcela.status !== "PREVISTA") {
      return res.status(400).json({ message: "Somente parcelas PREVISTAS podem ser retificadas." });
    }

    const contrato = parcela.contrato;
    const previstas = (contrato?.parcelas || []).filter((p) => p.status === "PREVISTA");
    if (previstas.length < 2) {
      return res.status(400).json({ message: "É necessário ao menos duas parcelas PREVISTAS." });
    }

    // ---- valores em centavos (BigInt), usando helpers já existentes no seu server ----
    const alvoAtual = moneyToCents(parcela.valorPrevisto);
    if (alvoAtual === null) return res.status(400).json({ message: "Valor atual da parcela inválido." });

    const alvoNovo =
      patch?.valorPrevisto !== undefined && patch?.valorPrevisto !== null && String(patch.valorPrevisto).trim() !== ""
        ? moneyToCents(patch.valorPrevisto)
        : alvoAtual;

    if (alvoNovo === null || alvoNovo <= 0n) {
      return res.status(400).json({ message: "Novo valor da parcela inválido." });
    }

    const delta = alvoNovo - alvoAtual; // + => aumentou alvo, então outras devem reduzir; - => outras aumentam

    const outras = previstas.filter((p) => p.id !== parcela.id);

    // mapa de "novos valores" (centavos) apenas para parcelas que serão ajustadas
    const novos = new Map(); // parcelaId -> BigInt cents

    // Modo 1: RATEIO (diferença distribuída igualmente; resto na primeira)
    if (ratearEntreDemais) {
      const n = BigInt(outras.length);
      const totalAdjust = -delta; // o que precisa ser aplicado no conjunto das outras para manter soma

      const base = totalAdjust / n; // BigInt trunca para zero
      const resto = totalAdjust - base * n; // pode ser negativo; vai na primeira

      outras.forEach((p, idx) => {
        const before = moneyToCents(p.valorPrevisto) ?? 0n;
        const add = base + (idx === 0 ? resto : 0n); // ✅ resto na primeira
        const after = before + add;
        novos.set(p.id, after);
      });
    }
    // Modo 2: MANUAL (valores absolutos editados)
    else if (valoresOutrasParcelas && typeof valoresOutrasParcelas === "object") {
      for (const p of outras) {
        if (valoresOutrasParcelas[p.id] === undefined) continue; // permite mandar subset
        const v = moneyToCents(valoresOutrasParcelas[p.id]);
        if (v === null || v <= 0n) {
          return res.status(400).json({ message: "Valor inválido em ajuste manual." });
        }
        novos.set(p.id, v);
      }
    }
    // Modo 3: DEFAULT (compensar tudo na primeira PREVISTA)
    else {
      const primeira = outras[0];
      const before = moneyToCents(primeira.valorPrevisto);
      if (before === null) return res.status(400).json({ message: "Valor da parcela de compensação inválido." });
      novos.set(primeira.id, before - delta);
    }

    // valida: nenhuma parcela pode ficar <= 0
    for (const p of outras) {
      if (!novos.has(p.id)) continue;
      const after = novos.get(p.id);
      if (after === null || after <= 0n) {
        return res.status(400).json({
          message: "A retificação gerou parcela com valor inválido (<= 0). Ajuste manualmente ou renegocie.",
        });
      }
    }

    // valida: soma das PREVISTAS não muda (preserva total do contrato sem mexer em recebidas/canceladas)
    const somaPrevistasAntes = previstas.reduce((acc, p) => acc + (moneyToCents(p.valorPrevisto) || 0n), 0n);

    const somaPrevistasDepois = previstas.reduce((acc, p) => {
      if (p.id === parcela.id) return acc + alvoNovo;
      if (novos.has(p.id)) return acc + (novos.get(p.id) || 0n);
      return acc + (moneyToCents(p.valorPrevisto) || 0n);
    }, 0n);

    if (somaPrevistasDepois !== somaPrevistasAntes) {
      return res.status(400).json({ message: "Soma das parcelas PREVISTAS não fecha. Verifique os valores." });
    }

    // vencimento (opcional)
    const novoVenc = patch?.vencimento ? parseDateInput(patch.vencimento) : null;
    if (patch?.vencimento && !novoVenc) {
      return res.status(400).json({ message: "Vencimento inválido (use DD/MM/AAAA)." });
    }

    const userId = req.user?.id ? Number(req.user.id) : null;

    await prisma.$transaction(async (tx) => {
      // --- atualiza alvo
      const alvoBeforeDec = parcela.valorPrevisto;
      const alvoAfterDec = centsToDecimalString(alvoNovo);

      await tx.parcelaContrato.update({
        where: { id: parcela.id },
        data: {
          valorPrevisto: alvoAfterDec,
          ...(novoVenc ? { vencimento: novoVenc } : {}),
        },
      });

      await tx.retificacaoParcela.create({
        data: {
          parcelaId: parcela.id,
          motivo: motivoTxt,
          criadoPorId: userId,
          alteracoes: {
            valorPrevisto: { before: alvoBeforeDec, after: alvoAfterDec },
            ...(novoVenc ? { vencimento: { before: parcela.vencimento, after: novoVenc } } : {}),
          },
          snapshotAntes: parcela,
          snapshotDepois: { ...parcela, valorPrevisto: alvoAfterDec, ...(novoVenc ? { vencimento: novoVenc } : {}) },
        },
      });

      // --- atualiza demais afetadas
      for (const p of outras) {
        if (!novos.has(p.id)) continue;

        const beforeDec = p.valorPrevisto;
        const afterDec = centsToDecimalString(novos.get(p.id));

        await tx.parcelaContrato.update({
          where: { id: p.id },
          data: { valorPrevisto: afterDec },
        });

        await tx.retificacaoParcela.create({
          data: {
            parcelaId: p.id,
            motivo: `Compensação/Rateio da retificação da parcela ${parcela.numero}: ${motivoTxt}`,
            criadoPorId: userId,
            alteracoes: {
              valorPrevisto: { before: beforeDec, after: afterDec },
            },
            snapshotAntes: p,
            snapshotDepois: { ...p, valorPrevisto: afterDec },
          },
        });
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    const status = err?.status || 500;
    console.error("Erro ao retificar parcela:", err);
    return res.status(status).json({ message: err?.message || "Erro ao retificar parcela." });
  }
});

// Retificar contrato (verde): reestrutura parcelas PREVISTAS conforme payload (com log)
app.post("/api/contratos/:id/retificar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    if (!Number.isFinite(contratoId)) return res.status(400).json({ message: "ID inválido." });

    const { adminPassword, motivo, payload } = req.body || {};
    const ok = await requireAdminPassword(req, res, adminPassword);
    if (!ok) return;

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo da retificação." });

    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      include: { parcelas: true },
    });
    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });

    const inCadeiaReneg = Boolean(contrato.renegociadoParaId || contrato.contratoOrigemId);
    const temRecebida = (contrato.parcelas || []).some((p) => p.status === "RECEBIDA");
    if (inCadeiaReneg || temRecebida) {
      return res.status(400).json({
        message:
          "Retificação estrutural bloqueada: contrato está renegociado (pai/filho) e/ou possui parcela recebida.",
      });
    }

    const allPrevistas = (contrato.parcelas || []).every((p) => p.status === "PREVISTA");
    if (!allPrevistas) {
      return res.status(400).json({ message: "Retificação estrutural permitida somente quando todas as parcelas são PREVISTAS." });
    }

    const totalCents = moneyToCents(contrato.valorTotal);
    if (totalCents === null || totalCents <= 0n) return res.status(400).json({ message: "Valor total inválido no contrato." });

    // reutiliza a mesma lógica de plano de parcelas do endpoint de renegociação:
    const b = payload || {};
    const fp = String(b.formaPagamento || contrato.formaPagamento || "AVISTA").trim().toUpperCase();
    if (!["AVISTA", "ENTRADA_PARCELAS", "PARCELADO"].includes(fp)) {
      return res.status(400).json({ message: "Forma de pagamento inválida." });
    }

    // default: usa o vencimento da primeira parcela atual (normalizado) como base
    const firstV = (contrato.parcelas || []).map((p) => p.vencimento).filter(Boolean).sort((a,b)=>new Date(a)-new Date(b))[0];
    const base0 = firstV ? new Date(firstV) : new Date();
    const dataBase = new Date(base0.getFullYear(), base0.getMonth(), base0.getDate(), 12, 0, 0, 0);

    const parseDateOrDefault = (v, field, fallbackDate) => {
      if (v === undefined || v === null || String(v).trim() === "") return fallbackDate;
      const d = parseDateInput(v);
      if (!d) throw new Error(`Data inválida em ${field}. Use DD/MM/AAAA.`);
      return d;
    };

    const addMonthsLocalNoon = (date, months) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    };

    let parcelasPlan = [];

    if (fp === "AVISTA") {
      const venc = parseDateOrDefault(b?.avista?.vencimento, "avista.vencimento", dataBase);
      parcelasPlan = [{ numero: 1, vencimento: venc, valorCents: totalCents }];
    }

    if (fp === "PARCELADO") {
      const qtd = Number(b?.parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas." });
      const primeiroVenc = parseDateOrDefault(b?.parcelas?.primeiroVencimento, "parcelas.primeiroVencimento", dataBase);
      const valoresCents = splitCents(totalCents, qtd);
      for (let i = 0; i < qtd; i++) {
        parcelasPlan.push({ numero: i + 1, vencimento: addMonthsLocalNoon(primeiroVenc, i), valorCents: valoresCents[i] });
      }
    }

    if (fp === "ENTRADA_PARCELAS") {
      const eValorCents = moneyToCents(b?.entrada?.valor);
      if (eValorCents === null || eValorCents <= 0n) return res.status(400).json({ message: "Informe o valor da entrada." });
      if (eValorCents >= totalCents) return res.status(400).json({ message: "A entrada deve ser menor que o total." });

      const eVenc = parseDateOrDefault(b?.entrada?.vencimento, "entrada.vencimento", dataBase);

      const qtd = Number(b?.parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas (após a entrada)." });

      const primeiroDefault = addMonthsLocalNoon(dataBase, 1);
      const primeiroVenc = parseDateOrDefault(b?.parcelas?.primeiroVencimento, "parcelas.primeiroVencimento", primeiroDefault);

      const restante = totalCents - eValorCents;
      const valoresCents = splitCents(restante, qtd);

      parcelasPlan.push({ numero: 1, vencimento: eVenc, valorCents: eValorCents });
      for (let i = 0; i < qtd; i++) {
        parcelasPlan.push({ numero: i + 2, vencimento: addMonthsLocalNoon(primeiroVenc, i), valorCents: valoresCents[i] });
      }
    }

    const snapshotAntes = {
      id: contrato.id,
      numeroContrato: contrato.numeroContrato,
      formaPagamento: contrato.formaPagamento,
      valorTotal: contrato.valorTotal,
      parcelas: contrato.parcelas,
    };

    const result = await prisma.$transaction(async (tx) => {
      // apaga e recria parcelas (todas eram PREVISTAS)
      await tx.parcelaContrato.deleteMany({ where: { contratoId } });

      await tx.parcelaContrato.createMany({
        data: parcelasPlan.map((p) => ({
          contratoId,
          numero: p.numero,
          vencimento: p.vencimento,
          valorPrevisto: centsToDecimalString(p.valorCents),
          status: "PREVISTA",
        })),
      });

      const contratoDepois = await tx.contratoPagamento.update({
        where: { id: contratoId },
        data: { formaPagamento: fp },
        include: { parcelas: { orderBy: { numero: "asc" } } },
      });

      await tx.retificacaoContrato.create({
        data: {
          contratoId,
          motivo: motivoTxt,
          alteracoes: { formaPagamento: { before: contrato.formaPagamento, after: fp } },
          snapshotAntes,
          snapshotDepois: {
            id: contratoDepois.id,
            numeroContrato: contratoDepois.numeroContrato,
            formaPagamento: contratoDepois.formaPagamento,
            valorTotal: contratoDepois.valorTotal,
            parcelas: contratoDepois.parcelas,
          },
          criadoPorId: req.user?.id ?? null,
        },
      });

      return contratoDepois;
    });

    return res.json({ message: "Contrato retificado com sucesso.", contrato: result });
  } catch (err) {
    console.error("Erro ao retificar contrato:", err);
    return res.status(500).json({ message: err?.message || "Erro ao retificar contrato." });
  }
});


// Ativar/Inativar contrato (soft)
app.patch("/api/contratos/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.contratoPagamento.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Contrato não encontrado." });

    const updated = await prisma.contratoPagamento.update({
      where: { id },
      data: { ativo: !current.ativo },
    });

    res.json({ message: updated.ativo ? "Contrato reativado." : "Contrato inativado.", contrato: updated });
  } catch (err) {
    console.error("Erro ao ativar/inativar contrato:", err);
    res.status(500).json({ message: "Erro ao ativar/inativar contrato." });
  }
});

// =========================
// CONTRATOS — REPASSE CONFIG (admin-only)
// PATCH /api/contratos/:id/repasse-config
// =========================
app.patch("/api/contratos/:id/repasse-config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    if (!Number.isFinite(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido." });
    }

    const {
      modeloDistribuicaoId,
      usaSplitSocio,
      advogadoPrincipalId,
      splits, // [{ advogadoId, percentualBp }]
    } = req.body || {};

    const modeloId = modeloDistribuicaoId == null ? null : Number(modeloDistribuicaoId);
    if (modeloId !== null && !Number.isFinite(modeloId)) {
      return res.status(400).json({ message: "modeloDistribuicaoId inválido." });
    }

    const usaSplit = Boolean(usaSplitSocio);

    const advPrincipalId =
      advogadoPrincipalId == null || advogadoPrincipalId === ""
        ? null
        : Number(advogadoPrincipalId);

    if (!usaSplit) {
      // Regra C: sem split => exige 1 advogado principal
      if (!Number.isFinite(advPrincipalId)) {
        return res.status(400).json({ message: "Selecione o Advogado Principal (sem split)." });
      }
    }

    // Carrega contrato (só pra garantir que existe)
    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      select: { id: true },
    });
    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });

    // Se tiver modelo, precisamos do %SOCIO para validar splits
    let socioBp = null;
    if (modeloId !== null) {
      const modelo = await prisma.modeloDistribuicao.findUnique({
        where: { id: modeloId },
        include: { itens: true },
      });
      if (!modelo) {
        return res.status(400).json({ message: "Modelo de distribuição não encontrado." });
      }

      // Ajuste aqui se o seu campo/destino for diferente (ex.: destino: "SOCIO")
      const itemSocio = (modelo.itens || []).find((it) => it.destinatario === "SOCIO");
      socioBp = itemSocio ? Number(itemSocio.percentualBp) : 0;
      if (!Number.isFinite(socioBp)) socioBp = 0;
    }

    // Normaliza splits
    const splitsArr = Array.isArray(splits) ? splits : [];
    const normalizedSplits = splitsArr
      .map((s) => ({
        advogadoId: Number(s?.advogadoId),
        percentualBp: Number(s?.percentualBp),
      }))
      .filter((s) => Number.isFinite(s.advogadoId) && Number.isFinite(s.percentualBp) && s.percentualBp > 0);

    if (usaSplit) {
      if (normalizedSplits.length < 2) {
        return res.status(400).json({ message: "Split ativado: informe ao menos 2 advogados com percentual." });
      }

      const somaBp = normalizedSplits.reduce((acc, s) => acc + s.percentualBp, 0);

      if (socioBp !== null && somaBp > socioBp) {
        return res.status(400).json({
          message: `Split excede o percentual do SOCIO no modelo. Soma do split: ${somaBp} bp; SOCIO no modelo: ${socioBp} bp.`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Atualiza contrato
      const contratoUpd = await tx.contratoPagamento.update({
        where: { id: contratoId },
        data: {
          modeloDistribuicaoId: modeloId,
          usaSplitSocio: usaSplit,
          repasseAdvogadoPrincipalId: usaSplit ? null : advPrincipalId,
        },
        select: {
          id: true,
          modeloDistribuicaoId: true,
          usaSplitSocio: true,
          repasseAdvogadoPrincipalId: true,
        },
      });

      // Limpa splits se split OFF
      if (!usaSplit) {
        await tx.contratoRepasseSplitAdvogado.deleteMany({ where: { contratoId } });
        return { contrato: contratoUpd, splits: [] };
      }

      // Split ON: substitui tudo (simples e seguro)
      await tx.contratoRepasseSplitAdvogado.deleteMany({ where: { contratoId } });

      await tx.contratoRepasseSplitAdvogado.createMany({
        data: normalizedSplits.map((s) => ({
          contratoId,
          advogadoId: s.advogadoId,
          percentualBp: s.percentualBp,
        })),
      });

      const splitsSaved = await tx.contratoRepasseSplitAdvogado.findMany({
        where: { contratoId },
        include: { advogado: true },
        orderBy: [{ id: "asc" }],
      });

      return { contrato: contratoUpd, splits: splitsSaved };
    });

    return res.json(result);
  } catch (err) {
    console.error("[contratos][repasse-config][PATCH]", err);
    return res.status(500).json({ message: "Erro ao salvar configuração de repasse do contrato." });
  }
});

// Confirmar recebimento de uma parcela
app.patch(
  "/api/parcelas/:id/confirmar",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { dataRecebimento, valorRecebido, meioRecebimento, observacoes } = req.body || {};

      const parcela = await prisma.parcelaContrato.findUnique({
        where: { id },
      });

      if (!parcela) {
        return res.status(404).json({ message: "Parcela não encontrada." });
      }

      if (parcela.status === "RECEBIDA") {
        return res.status(400).json({ message: "Esta parcela já foi recebida." });
      }

      const dt = dataRecebimento
        ? parseDateInput(dataRecebimento)
        : new Date();

      if (!dt) {
        return res
          .status(400)
          .json({ message: "Data de recebimento inválida (DD/MM/AAAA)." });
      }

      // Se não vier valorRecebido, assume o valor previsto
      const cents = valorRecebido
       ? moneyToCents(valorRecebido)
       : moneyToCents(parcela.valorPrevisto); // passa o Decimal “cru”, não string

      if (!cents || cents <= 0n) {
        return res.status(400).json({ message: "Valor recebido inválido." });
      }

      const meio = meioRecebimento
        ? String(meioRecebimento).trim().toUpperCase()
        : null;

      if (
        meio &&
        !["PIX", "TED", "BOLETO", "CARTAO", "DINHEIRO", "OUTRO"].includes(meio)
      ) {
        return res.status(400).json({ message: "Meio de recebimento inválido." });
      }

      const updated = await prisma.parcelaContrato.update({
        where: { id },
        data: {
          status: "RECEBIDA", // ⚠️ confirme ENUM
          dataRecebimento: dt,
          valorRecebido: Number(cents) / 100, // ✅ Decimal correto
          meioRecebimento: meio,
          observacoes: observacoes ? String(observacoes).trim() : null,
        },
      });

      return res.json({
        message: "Parcela recebida com sucesso.",
        parcela: updated,
      });
    } catch (err) {
      console.error("Erro ao confirmar parcela:", err);
      return res.status(500).json({
        message: "Erro interno ao confirmar o recebimento da parcela.",
      });
    }
  }
);

// Cancelar uma parcela (somente não recebidas)
app.patch(
  "/api/parcelas/:id/cancelar",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const motivo = String(req.body?.motivo || "").trim();

      if (!id) return res.status(400).json({ message: "ID da parcela inválido." });
      if (!motivo) {
        return res.status(400).json({ message: "Informe o motivo do cancelamento." });
      }
      if (motivo.length < 3) {
        return res.status(400).json({ message: "Motivo muito curto. Explique um pouco mais." });
      }

      const parcela = await prisma.parcelaContrato.findUnique({ where: { id } });
      if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });

      if (parcela.status === "RECEBIDA") {
        return res.status(409).json({ message: "Parcela recebida não pode ser cancelada." });
      }
      if (parcela.status === "CANCELADA") {
        return res.status(409).json({ message: "Esta parcela já está cancelada." });
      }

      const updated = await prisma.parcelaContrato.update({
        where: { id },
        data: {
          status: "CANCELADA",
          canceladaEm: new Date(),
          canceladaPorId: req.user?.id ?? null,
          cancelamentoMotivo: motivo,
        },
      });

      return res.json({
        message: "Parcela cancelada com sucesso.",
        parcela: updated,
      });
    } catch (err) {
      console.error("Erro ao cancelar parcela:", err);
      return res.status(500).json({
        message: "Erro interno ao cancelar a parcela.",
      });
    }
  }
);


// =========================
// 6.3.B — Movimentos (Ajustes / Estornos / Transferências) em Parcela (admin-only + senha)
// =========================

app.post("/api/parcelas/:id/movimentos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parcelaId = Number(req.params.id);
    if (!parcelaId) return res.status(400).json({ message: "ID da parcela inválido." });

    const { adminPassword, tipo, valor, dataMovimento, meio, motivo } = req.body || {};

    await assertAdminPassword(req, adminPassword);

    const tipoUp = String(tipo || "").toUpperCase();
    const allowed = ["AJUSTE", "ESTORNO", "TRANSFERENCIA_SAIDA", "TRANSFERENCIA_ENTRADA"];
    if (!allowed.includes(tipoUp)) return res.status(400).json({ message: "Tipo de movimento inválido." });

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo do movimento." });

    const parcela = await prisma.parcelaContrato.findUnique({
      where: { id: parcelaId },
      include: { contrato: true },
    });
    if (!parcela) return res.status(404).json({ message: "Parcela não encontrada." });

    if (parcela.status !== "RECEBIDA") {
      return res.status(400).json({ message: "Somente parcelas RECEBIDAS podem receber movimentos (ajustes/estornos)." });
    }

    const dt = dataMovimento ? parseDate(dataMovimento, "dataMovimento") : new Date();
    const dtNoon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0, 0);

    const cents = signedMoneyToCents(valor);
    if (!Number.isFinite(cents) || cents === 0) {
      return res.status(400).json({ message: "Informe um valor diferente de zero." });
    }

    const created = await prisma.parcelaMovimento.create({
      data: {
        parcelaId: parcelaId,
        tipo: tipoUp,
        valor: centsToDecimalString(cents),
        dataMovimento: dtNoon,
        meio: meio ? String(meio).toUpperCase() : null,
        motivo: motivoTxt,
        criadoPorId: req.user?.id ? Number(req.user.id) : null,
      },
    });

    const updated = await prisma.parcelaContrato.findUnique({
      where: { id: parcelaId },
      include: {
        movimentos: { orderBy: { createdAt: "asc" }, include: { criadoPor: { select: { id: true, nome: true } } } },
      },
    });

    return res.json({ ok: true, movimento: created, parcela: updated });
  } catch (err) {
    const status = err?.status || 500;
    console.error("Erro ao criar movimento da parcela:", err);
    return res.status(status).json({ message: err?.message || "Erro ao criar movimento." });
  }
});

app.post("/api/parcelas/:id/transferir-recebimento", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parcelaOrigemId = Number(req.params.id);
    if (!parcelaOrigemId) return res.status(400).json({ message: "ID da parcela inválido." });

    const { adminPassword, parcelaDestinoId, valor, dataMovimento, meio, motivo } = req.body || {};
    await assertAdminPassword(req, adminPassword);

    const destinoId = Number(parcelaDestinoId);
    if (!destinoId) return res.status(400).json({ message: "Informe a parcela de destino." });

    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return res.status(400).json({ message: "Informe o motivo da transferência." });

    const dt = dataMovimento ? parseDate(dataMovimento, "dataMovimento") : new Date();
    const dtNoon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0, 0);

    const centsPos = moneyToCents(valor);
    if (!Number.isFinite(centsPos) || centsPos <= 0) {
      return res.status(400).json({ message: "Informe um valor positivo para transferir." });
    }

    const userId = req.user?.id ? Number(req.user.id) : null;

    const result = await prisma.$transaction(async (tx) => {
      const origem = await tx.parcelaContrato.findUnique({ where: { id: parcelaOrigemId } });
      const destino = await tx.parcelaContrato.findUnique({ where: { id: destinoId } });
      if (!origem || !destino) throw Object.assign(new Error("Parcela origem/destino não encontrada."), { status: 404 });
      if (origem.status !== "RECEBIDA" || destino.status !== "RECEBIDA") {
        throw Object.assign(new Error("Transferência exige parcelas RECEBIDAS (origem e destino)."), { status: 400 });
      }

      const movSaida = await tx.parcelaMovimento.create({
        data: {
          parcelaId: parcelaOrigemId,
          tipo: "TRANSFERENCIA_SAIDA",
          valor: centsToDecimalString(-centsPos),
          dataMovimento: dtNoon,
          meio: meio ? String(meio).toUpperCase() : null,
          motivo: motivoTxt,
          criadoPorId: userId,
        },
      });

      const movEntrada = await tx.parcelaMovimento.create({
        data: {
          parcelaId: destinoId,
          tipo: "TRANSFERENCIA_ENTRADA",
          valor: centsToDecimalString(centsPos),
          dataMovimento: dtNoon,
          meio: meio ? String(meio).toUpperCase() : null,
          motivo: motivoTxt,
          criadoPorId: userId,
          referenciaMovimentoId: movSaida.id,
        },
      });

      await tx.parcelaMovimento.update({
        where: { id: movSaida.id },
        data: { referenciaMovimentoId: movEntrada.id },
      });

      return { movSaida, movEntrada };
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    const status = err?.status || 500;
    console.error("Erro ao transferir recebimento:", err);
    return res.status(status).json({ message: err?.message || "Erro ao transferir recebimento." });
  }
});

app.get("/api/contratos/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID do contrato inválido." });

    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id },
      include: {
        cliente: true,
        contratoOrigem: { select: { id: true, numeroContrato: true } },
        renegociadoPara: { select: { id: true, numeroContrato: true } },
        parcelas: {
          orderBy: { numero: "asc" },
          include: {
            canceladaPor: { select: { id: true, nome: true } },
          },
        },
        modeloDistribuicao: { select: { id: true, codigo: true, descricao: true } },
        repasseAdvogadoPrincipal: { select: { id: true, nome: true } },
        repasseSplits: {
          include: { advogado: { select: { id: true, nome: true } } },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });
    return res.json(contrato);
  } catch (err) {
    console.error("Erro ao buscar contrato:", err);
    return res.status(500).json({ message: "Erro ao buscar contrato." });
  }
});



// GET /api/contratos/:id/renegociar-preview
// Retorna dados para pré-preencher o modal de renegociação (sem criar nada).
app.get("/api/contratos/:id/renegociar-preview", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    if (!Number.isFinite(contratoId)) {
      return res.status(400).json({ message: "ID do contrato inválido." });
    }

    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      include: { parcelas: true },
    });

    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });

    const pendentes = (contrato.parcelas || []).filter((p) => p.status === "PREVISTA");
    if (pendentes.length === 0) {
      return res.status(400).json({ message: "Não há saldo pendente para renegociar." });
    }

    // dataBase (default inteligente): menor vencimento dentre pendentes (normalizado para 12:00)
    const dataBaseRaw = pendentes
      .map((p) => p.vencimento)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

    const db0 = dataBaseRaw ? new Date(dataBaseRaw) : new Date();
    const dataBase = new Date(db0.getFullYear(), db0.getMonth(), db0.getDate(), 12, 0, 0, 0);

    // saldo pendente em centavos
    const saldoCents = pendentes.reduce((acc, p) => acc + (moneyToCents(p.valorPrevisto) || 0n), 0n);
    if (saldoCents <= 0n) {
      return res.status(400).json({ message: "Saldo pendente inválido para renegociação." });
    }

    // raiz do número (remove -R{n} repetidamente no final)
    function getNumeroRaiz(numeroContrato) {
      let base = String(numeroContrato || "").trim();
      while (/-R\d+$/.test(base)) base = base.replace(/-R\d+$/, "");
      return base;
    }

    const raiz = getNumeroRaiz(contrato.numeroContrato);

    // próximo sufixo R{n} baseado na raiz
    const existing = await prisma.contratoPagamento.findMany({
      where: { numeroContrato: { startsWith: `${raiz}-R` } },
      select: { numeroContrato: true },
    });

    const used = new Set(existing.map((x) => x.numeroContrato));
    let seq = 1;
    let novoNumero = `${raiz}-R${seq}`;
    while (used.has(novoNumero)) {
      seq += 1;
      novoNumero = `${raiz}-R${seq}`;
    }

    return res.json({
      contratoId: contrato.id,
      clienteId: contrato.clienteId,
      numeroContratoNovo: novoNumero,
      dataBaseISO: dataBase.toISOString(),
      saldoCents: saldoCents.toString(), // em centavos (string)
      formaPagamentoOriginal: contrato.formaPagamento,
    });
  } catch (err) {
    console.error("Erro ao preparar renegociação:", err);
    return res.status(500).json({ message: err?.message || "Erro ao preparar renegociação." });
  }
});

// POST /api/contratos/:id/renegociar
app.post("/api/contratos/:id/renegociar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const contratoId = Number(req.params.id);
    const usuarioId = req.user?.id ?? null;

    if (!Number.isFinite(contratoId)) {
      return res.status(400).json({ message: "ID do contrato inválido." });
    }

    const contrato = await prisma.contratoPagamento.findUnique({
      where: { id: contratoId },
      include: {
        cliente: true,
        parcelas: true,
      },
    });

    if (!contrato) return res.status(404).json({ message: "Contrato não encontrado." });

    const pendentes = (contrato.parcelas || []).filter((p) => p.status === "PREVISTA");
    if (pendentes.length === 0) {
      return res.status(400).json({ message: "Não há saldo pendente para renegociar." });
    }

    // dataBase (default inteligente): menor vencimento dentre pendentes (normalizado para 12:00)
    const dataBaseRaw = pendentes
      .map((p) => p.vencimento)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

    const db0 = dataBaseRaw ? new Date(dataBaseRaw) : new Date();
    const dataBase = new Date(db0.getFullYear(), db0.getMonth(), db0.getDate(), 12, 0, 0, 0);

    // saldo pendente em centavos
    const saldoCents = pendentes.reduce((acc, p) => acc + (moneyToCents(p.valorPrevisto) || 0n), 0n);
    if (saldoCents <= 0n) {
      return res.status(400).json({ message: "Saldo pendente inválido para renegociação." });
    }

    // raiz do número (remove -R{n} repetidamente no final)
    function getNumeroRaiz(numeroContrato) {
      let base = String(numeroContrato || "").trim();
      while (/-R\d+$/.test(base)) base = base.replace(/-R\d+$/, "");
      return base;
    }

    const raiz = getNumeroRaiz(contrato.numeroContrato);

    // próximo sufixo R{n} baseado na raiz
    const existing = await prisma.contratoPagamento.findMany({
      where: { numeroContrato: { startsWith: `${raiz}-R` } },
      select: { numeroContrato: true },
    });

    const used = new Set(existing.map((x) => x.numeroContrato));
    let seq = 1;
    let novoNumero = `${raiz}-R${seq}`;
    while (used.has(novoNumero)) {
      seq += 1;
      novoNumero = `${raiz}-R${seq}`;
    }

    const motivo = `Renegociação do saldo pendente do contrato ${contrato.numeroContrato} -> ${novoNumero}`;

    const body = req.body || {};
    const fp = String(body.formaPagamento || "AVISTA").trim().toUpperCase();
    if (!["AVISTA", "PARCELADO", "ENTRADA_PARCELAS"].includes(fp)) {
      return res.status(400).json({ message: "Forma de pagamento inválida." });
    }

    const parseDateOrDefault = (v, field, fallback) => {
      if (v === undefined || v === null || String(v).trim() === "") return fallback;
      const d = parseDateInput(v);
      if (!d) throw new Error(`Data inválida em ${field}. Use DD/MM/AAAA.`);
      return d;
    };

    const addMonthsLocalNoon = (date, months) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    };

    // monta plano de parcelas (sempre total = saldoCents)
    let parcelasPlan = [];

    if (fp === "AVISTA") {
      const venc = parseDateOrDefault(body?.avista?.vencimento, "avista.vencimento", dataBase);
      parcelasPlan = [{ numero: 1, vencimento: venc, valorCents: saldoCents }];
    }

    if (fp === "PARCELADO") {
      const qtd = Number(body?.parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas." });

      const primeiroVenc = parseDateOrDefault(body?.parcelas?.primeiroVencimento, "parcelas.primeiroVencimento", dataBase);

      // se vier valorParcela, valida soma; senão divide automaticamente
      let valoresCents;
      const valorParcelaRaw = body?.parcelas?.valorParcela;
      if (valorParcelaRaw !== undefined && valorParcelaRaw !== null && String(valorParcelaRaw).trim() !== "") {
        const vParc = moneyToCents(valorParcelaRaw);
        if (!vParc || vParc <= 0n) return res.status(400).json({ message: "Valor da parcela inválido." });
        valoresCents = Array.from({ length: qtd }, () => vParc);
        const soma = valoresCents.reduce((a, b) => a + b, 0n);
        if (soma !== saldoCents) {
          return res.status(400).json({
            message: "Soma das parcelas diferente do saldo pendente. Ajuste o valor da parcela ou deixe em branco para dividir automaticamente.",
          });
        }
      } else {
        valoresCents = splitCents(saldoCents, qtd);
      }

      for (let i = 0; i < qtd; i++) {
        const venc = addMonthsLocalNoon(primeiroVenc, i);
        parcelasPlan.push({ numero: i + 1, vencimento: venc, valorCents: valoresCents[i] });
      }
    }

    if (fp === "ENTRADA_PARCELAS") {
      const eValorCents = moneyToCents(body?.entrada?.valor);
      if (!eValorCents || eValorCents <= 0n) return res.status(400).json({ message: "Informe o valor da entrada." });
      if (eValorCents >= saldoCents) return res.status(400).json({ message: "A entrada deve ser menor que o saldo pendente." });

      const eVenc = parseDateOrDefault(body?.entrada?.vencimento, "entrada.vencimento", dataBase);

      const qtd = Number(body?.parcelas?.quantidade || 0);
      if (!qtd || qtd < 1) return res.status(400).json({ message: "Informe a quantidade de parcelas (após entrada)." });

      // default: 1ª parcela = dataBase + 1 mês (editável no front)
      const primeiroDefault = addMonthsLocalNoon(dataBase, 1);
      const primeiroVenc = parseDateOrDefault(body?.parcelas?.primeiroVencimento, "parcelas.primeiroVencimento", primeiroDefault);

      const restante = saldoCents - eValorCents;

      let valoresCents;
      const valorParcelaRaw = body?.parcelas?.valorParcela;
      if (valorParcelaRaw !== undefined && valorParcelaRaw !== null && String(valorParcelaRaw).trim() !== "") {
        const vParc = moneyToCents(valorParcelaRaw);
        if (!vParc || vParc <= 0n) return res.status(400).json({ message: "Valor da parcela inválido." });
        valoresCents = Array.from({ length: qtd }, () => vParc);
        const soma = valoresCents.reduce((a, b) => a + b, 0n);
        if (soma !== restante) {
          return res.status(400).json({
            message: "Soma das parcelas diferente do restante (saldo - entrada). Ajuste o valor da parcela ou deixe em branco para dividir automaticamente.",
          });
        }
      } else {
        valoresCents = splitCents(restante, qtd);
      }

      parcelasPlan.push({ numero: 1, vencimento: eVenc, valorCents: eValorCents });

      for (let i = 0; i < qtd; i++) {
        const venc = addMonthsLocalNoon(primeiroVenc, i);
        parcelasPlan.push({ numero: i + 2, vencimento: venc, valorCents: valoresCents[i] });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // cancela pendentes do contrato que está sendo renegociado
      await tx.parcelaContrato.updateMany({
        where: { contratoId, status: { in: ["PREVISTA"] } },
        data: {
          status: "CANCELADA",
          canceladaEm: new Date(),
          canceladaPorId: usuarioId,
          cancelamentoMotivo: motivo,
        },
      });

      const filho = await tx.contratoPagamento.create({
        data: {
          numeroContrato: novoNumero,
          clienteId: contrato.clienteId,
          valorTotal: centsToDecimalString(saldoCents),
          formaPagamento: fp,
          observacoes: `Originado da renegociação do contrato ${contrato.numeroContrato}.`,
          contratoOrigemId: contrato.id,
          parcelas: {
            create: parcelasPlan.map((p) => ({
              numero: p.numero,
              vencimento: p.vencimento,
              valorPrevisto: centsToDecimalString(p.valorCents),
              status: "PREVISTA",
            })),
          },
        },
        include: {
          cliente: true,
          contratoOrigem: { select: { id: true, numeroContrato: true } },
          parcelas: { orderBy: { numero: "asc" } },
        },
      });

      const originalAtualizado = await tx.contratoPagamento.update({
        where: { id: contratoId },
        data: {
          renegociadoEm: new Date(),
          renegociadoPorId: usuarioId,
          renegociadoParaId: filho.id,
        },
        include: {
          cliente: true,
          renegociadoPara: { select: { id: true, numeroContrato: true } },
          parcelas: { orderBy: { numero: "asc" }, include: { canceladaPor: { select: { id: true, nome: true } } } },
        },
      });

      return { filho, originalAtualizado };
    });

    return res.json({
      message: `Renegociação criada com sucesso: ${result.filho.numeroContrato}.`,
      contratoNovo: result.filho,
      contratoOriginal: result.originalAtualizado,
    });
  } catch (err) {
    console.error("Erro ao renegociar saldo:", err);
    return res.status(500).json({ message: err?.message || "Erro ao renegociar saldo." });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada.", path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ message: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`Controles-AMR backend rodando na porta ${PORT}`);
});