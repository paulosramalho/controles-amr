/*
  Warnings:

  - The values [SUSPENSA] on the enum `StatusOrdem` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `anoMesInicio` on the `OrdemPagamento` table. All the data in the column will be lost.
  - You are about to drop the `Advogado` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Estagiario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pagamento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrestadorServico` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Repasse` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'USER');

-- AlterEnum
BEGIN;
CREATE TYPE "StatusOrdem_new" AS ENUM ('ATIVA', 'CONCLUIDA', 'CANCELADA');
ALTER TABLE "OrdemPagamento" ALTER COLUMN "status" TYPE "StatusOrdem_new" USING ("status"::text::"StatusOrdem_new");
ALTER TYPE "StatusOrdem" RENAME TO "StatusOrdem_old";
ALTER TYPE "StatusOrdem_new" RENAME TO "StatusOrdem";
DROP TYPE "StatusOrdem_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_ordemPagamentoId_fkey";

-- DropForeignKey
ALTER TABLE "Repasse" DROP CONSTRAINT "Repasse_advogadoId_fkey";

-- DropForeignKey
ALTER TABLE "Repasse" DROP CONSTRAINT "Repasse_ordemPagamentoId_fkey";

-- DropIndex
DROP INDEX "Cliente_cpfCnpj_idx";

-- DropIndex
DROP INDEX "OrdemPagamento_anoMesInicio_idx";

-- AlterTable
ALTER TABLE "OrdemPagamento" DROP COLUMN "anoMesInicio",
ALTER COLUMN "status" SET DEFAULT 'ATIVA';

-- DropTable
DROP TABLE "Advogado";

-- DropTable
DROP TABLE "Estagiario";

-- DropTable
DROP TABLE "Pagamento";

-- DropTable
DROP TABLE "PrestadorServico";

-- DropTable
DROP TABLE "Repasse";

-- DropEnum
DROP TYPE "OrigemRepasse";

-- DropEnum
DROP TYPE "StatusPagamento";

-- DropEnum
DROP TYPE "TipoAdvogado";

-- DropEnum
DROP TYPE "TipoPrestador";

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'USER',
    "senhaHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_perfil_idx" ON "Usuario"("perfil");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "Usuario"("ativo");

-- CreateIndex
CREATE INDEX "Cliente_ativo_idx" ON "Cliente"("ativo");
