import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const nome = process.argv[2];
const email = process.argv[3];
const senha = process.argv[4];

if (!nome || !email || !senha) {
  console.log('Uso: node scripts/create-admin.mjs "Nome" "email@dominio.com" "SenhaForte123!"');
  process.exit(1);
}

const run = async () => {
  const senhaHash = await bcrypt.hash(senha, 10);

  const created = await prisma.usuario.upsert({
    where: { email: email.toLowerCase() },
    update: {
      nome,
      role: "ADMIN",
      ativo: true,
      senhaHash,
    },
    create: {
      nome,
      email: email.toLowerCase(),
      role: "ADMIN",
      ativo: true,
      senhaHash,
    },
  });

  console.log("ADMIN criado/atualizado:", { id: created.id, email: created.email, role: created.role });
};

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
