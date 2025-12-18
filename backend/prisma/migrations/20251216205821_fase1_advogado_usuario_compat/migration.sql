/*
  Warnings:

  - You are about to drop the column `possuiFixoMensal` on the `Advogado` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `Advogado` table. All the data in the column will be lost.
  - You are about to drop the column `valorFixoMensal` on the `Advogado` table. All the data in the column will be lost.
  - You are about to drop the column `anoMesInicio` on the `OrdemPagamento` table. All the data in the column will be lost.
  - You are about to drop the column `dataPrevista` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `ordemId` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `valorPago` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `valorPrevisto` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `advogadoId` on the `Repasse` table. All the data in the column will be lost.
  - You are about to drop the column `ordemId` on the `Repasse` table. All the data in the column will be lost.
  - You are about to drop the column `pagoEm` on the `Repasse` table. All the data in the column will be lost.
  - You are about to drop the column `referenciaAnoMes` on the `Repasse` table. All the data in the column will be lost.
  - You are about to drop the `Estagiario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrestadorServico` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Advogado` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[oab]` on the table `Advogado` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cod]` on the table `ModeloDistribuicao` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `oab` to the `Advogado` table without a default value. This is not possible if the table is not empty.
  - Made the column `cpf` on table `Advogado` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Advogado` required. This step will fail if there are existing NULL values in that column.
  - Made the column `telefone` on table `Advogado` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusPagamento" ADD VALUE 'EM_ABERTO';
ALTER TYPE "StatusPagamento" ADD VALUE 'PARCIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoAdvogado" ADD VALUE 'CORRESPONDENTE';
ALTER TYPE "TipoAdvogado" ADD VALUE 'OUTRO';

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_ordemId_fkey";

-- DropForeignKey
ALTER TABLE "Repasse" DROP CONSTRAINT "Repasse_advogadoId_fkey";

-- DropForeignKey
ALTER TABLE "Repasse" DROP CONSTRAINT "Repasse_ordemId_fkey";

-- DropIndex
DROP INDEX "Advogado_email_idx";

-- DropIndex
DROP INDEX "Advogado_nome_idx";

-- DropIndex
DROP INDEX "Cliente_email_idx";

-- DropIndex
DROP INDEX "ModeloDistribuicao_codigo_idx";

-- DropIndex
DROP INDEX "ModeloDistribuicao_origem_idx";

-- DropIndex
DROP INDEX "ModeloDistribuicao_tipo_idx";

-- DropIndex
DROP INDEX "OrdemPagamento_anoMesInicio_idx";

-- DropIndex
DROP INDEX "OrdemPagamento_clienteId_idx";

-- DropIndex
DROP INDEX "Pagamento_ordemId_idx";

-- DropIndex
DROP INDEX "Pagamento_status_idx";

-- DropIndex
DROP INDEX "Repasse_advogadoId_idx";

-- DropIndex
DROP INDEX "Repasse_ordemId_idx";

-- DropIndex
DROP INDEX "Repasse_referenciaAnoMes_idx";

-- AlterTable
ALTER TABLE "Advogado" DROP COLUMN "possuiFixoMensal",
DROP COLUMN "tipo",
DROP COLUMN "valorFixoMensal",
ADD COLUMN     "oab" TEXT NOT NULL,
ALTER COLUMN "cpf" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "telefone" SET NOT NULL;

-- AlterTable
ALTER TABLE "ModeloDistribuicao" ADD COLUMN     "cod" TEXT,
ALTER COLUMN "codigo" DROP NOT NULL,
ALTER COLUMN "origem" DROP NOT NULL,
ALTER COLUMN "tipo" DROP NOT NULL,
ALTER COLUMN "percentual" DROP NOT NULL,
ALTER COLUMN "destinatario" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrdemPagamento" DROP COLUMN "anoMesInicio";

-- AlterTable
ALTER TABLE "Pagamento" DROP COLUMN "dataPrevista",
DROP COLUMN "ordemId",
DROP COLUMN "valorPago",
DROP COLUMN "valorPrevisto",
ADD COLUMN     "ordemPagamentoId" INTEGER,
ADD COLUMN     "valor" DECIMAL(65,30),
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Repasse" DROP COLUMN "advogadoId",
DROP COLUMN "ordemId",
DROP COLUMN "pagoEm",
DROP COLUMN "referenciaAnoMes",
ADD COLUMN     "competenciaAno" INTEGER,
ADD COLUMN     "competenciaMes" INTEGER,
ADD COLUMN     "ordemPagamentoId" INTEGER;

-- DropTable
DROP TABLE "Estagiario";

-- DropTable
DROP TABLE "PrestadorServico";

-- CreateIndex
CREATE UNIQUE INDEX "Advogado_cpf_key" ON "Advogado"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Advogado_oab_key" ON "Advogado"("oab");

-- CreateIndex
CREATE INDEX "Advogado_ativo_idx" ON "Advogado"("ativo");

-- CreateIndex
CREATE INDEX "Cliente_ativo_idx" ON "Cliente"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloDistribuicao_cod_key" ON "ModeloDistribuicao"("cod");

-- CreateIndex
CREATE INDEX "ModeloDistribuicao_cod_idx" ON "ModeloDistribuicao"("cod");

-- CreateIndex
CREATE INDEX "OrdemPagamento_modeloPagamento_idx" ON "OrdemPagamento"("modeloPagamento");

-- CreateIndex
CREATE INDEX "Pagamento_dataPagamento_idx" ON "Pagamento"("dataPagamento");

-- CreateIndex
CREATE INDEX "Repasse_competenciaAno_competenciaMes_idx" ON "Repasse"("competenciaAno", "competenciaMes");

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_ordemPagamentoId_fkey" FOREIGN KEY ("ordemPagamentoId") REFERENCES "OrdemPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_ordemPagamentoId_fkey" FOREIGN KEY ("ordemPagamentoId") REFERENCES "OrdemPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
