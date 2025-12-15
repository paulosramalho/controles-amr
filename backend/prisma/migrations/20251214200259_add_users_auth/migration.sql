/*
  Warnings:

  - You are about to drop the column `perfil` on the `Usuario` table. All the data in the column will be lost.
  - You are about to drop the column `telefone` on the `Usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[advogadoId]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Made the column `senhaHash` on table `Usuario` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PREVISTO', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAdvogado" AS ENUM ('SOCIO', 'ASSOCIADO');

-- DropIndex
DROP INDEX "Cliente_ativo_idx";

-- DropIndex
DROP INDEX "OrdemPagamento_dataInicio_idx";

-- DropIndex
DROP INDEX "Usuario_perfil_idx";

-- AlterTable
ALTER TABLE "OrdemPagamento" ADD COLUMN     "anoMesInicio" TEXT,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "perfil",
DROP COLUMN "telefone",
ADD COLUMN     "advogadoId" INTEGER,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "senhaHash" SET NOT NULL;

-- DropEnum
DROP TYPE "PerfilUsuario";

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "dataPrevista" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "valorPrevisto" DECIMAL(65,30),
    "valorPago" DECIMAL(65,30),
    "status" "StatusPagamento" NOT NULL DEFAULT 'PREVISTO',

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advogado" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "tipo" "TipoAdvogado" NOT NULL,
    "possuiFixoMensal" BOOLEAN NOT NULL DEFAULT false,
    "valorFixoMensal" DECIMAL(65,30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Advogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repasse" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "advogadoId" INTEGER NOT NULL,
    "ordemId" INTEGER,
    "valor" DECIMAL(65,30),
    "referenciaAnoMes" TEXT,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estagiario" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "auxTransporte" DECIMAL(65,30),
    "auxEstagio" DECIMAL(65,30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Estagiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrestadorServico" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "descricao" TEXT,
    "valorMensal" DECIMAL(65,30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PrestadorServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pagamento_ordemId_idx" ON "Pagamento"("ordemId");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");

-- CreateIndex
CREATE INDEX "Advogado_nome_idx" ON "Advogado"("nome");

-- CreateIndex
CREATE INDEX "Advogado_email_idx" ON "Advogado"("email");

-- CreateIndex
CREATE INDEX "Repasse_advogadoId_idx" ON "Repasse"("advogadoId");

-- CreateIndex
CREATE INDEX "Repasse_ordemId_idx" ON "Repasse"("ordemId");

-- CreateIndex
CREATE INDEX "Repasse_referenciaAnoMes_idx" ON "Repasse"("referenciaAnoMes");

-- CreateIndex
CREATE INDEX "Estagiario_nome_idx" ON "Estagiario"("nome");

-- CreateIndex
CREATE INDEX "PrestadorServico_nome_idx" ON "PrestadorServico"("nome");

-- CreateIndex
CREATE INDEX "Cliente_email_idx" ON "Cliente"("email");

-- CreateIndex
CREATE INDEX "OrdemPagamento_anoMesInicio_idx" ON "OrdemPagamento"("anoMesInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_advogadoId_key" ON "Usuario"("advogadoId");

-- CreateIndex
CREATE INDEX "Usuario_role_idx" ON "Usuario"("role");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_advogadoId_fkey" FOREIGN KEY ("advogadoId") REFERENCES "Advogado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "OrdemPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_advogadoId_fkey" FOREIGN KEY ("advogadoId") REFERENCES "Advogado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "OrdemPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
