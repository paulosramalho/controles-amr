// backend/src/server.js
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

app.get("/api/clients", async (_req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nomeRazaoSocial: "asc" },
    });
    res.json(clientes.map((c) => serializeCliente({ ...c, ordens: [] })));
  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
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

app.get("/api/clients-with-orders", async (req, res) => {
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
