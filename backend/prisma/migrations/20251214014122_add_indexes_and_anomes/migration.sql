/*
  Warnings:

  - You are about to drop the column `auxilioEstagioValor` on the `Estagiario` table. All the data in the column will be lost.
  - You are about to drop the column `auxilioTransporteValor` on the `Estagiario` table. All the data in the column will be lost.
  - You are about to drop the column `cpfCnpj` on the `PrestadorServico` table. All the data in the column will be lost.
  - You are about to drop the column `nomeRazaoSocial` on the `PrestadorServico` table. All the data in the column will be lost.
  - You are about to drop the column `valorRecorrente` on the `PrestadorServico` table. All the data in the column will be lost.
  - You are about to drop the `ConfiguracaoCalculo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Usuario` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cpfCnpj]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clienteId,sequenciaCliente]` on the table `OrdemPagamento` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nome` to the `PrestadorServico` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tipo` on the `PrestadorServico` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoPrestador" AS ENUM ('SECRETARIA_VIRTUAL', 'CONTA_CONTABILIDADE', 'OUTRO');

-- AlterEnum
ALTER TYPE "ModeloPagamento" ADD VALUE 'APENAS_PARCELAS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigemRepasse" ADD VALUE 'ORDEM_DE_PAGAMENTO';
ALTER TYPE "OrigemRepasse" ADD VALUE 'FIXO_MENSAL';
ALTER TYPE "OrigemRepasse" ADD VALUE 'AJUSTE';
ALTER TYPE "OrigemRepasse" ADD VALUE 'OUTROS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusPagamento" ADD VALUE 'PREVISTO';
ALTER TYPE "StatusPagamento" ADD VALUE 'ATRASADO';

-- AlterTable
ALTER TABLE "Estagiario" DROP COLUMN "auxilioEstagioValor",
DROP COLUMN "auxilioTransporteValor",
ADD COLUMN     "valorAuxilio" DECIMAL(65,30),
ADD COLUMN     "valorTransporte" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "OrdemPagamento" ADD COLUMN     "anoMesInicio" VARCHAR(7);

-- AlterTable
ALTER TABLE "PrestadorServico" DROP COLUMN "cpfCnpj",
DROP COLUMN "nomeRazaoSocial",
DROP COLUMN "valorRecorrente",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "valorMensal" DECIMAL(65,30),
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoPrestador" NOT NULL;

-- DropTable
DROP TABLE "ConfiguracaoCalculo";

-- DropTable
DROP TABLE "Usuario";

-- DropEnum
DROP TYPE "PerfilUsuario";

-- CreateIndex
CREATE INDEX "Advogado_nome_idx" ON "Advogado"("nome");

-- CreateIndex
CREATE INDEX "Advogado_email_idx" ON "Advogado"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE INDEX "Cliente_nomeRazaoSocial_idx" ON "Cliente"("nomeRazaoSocial");

-- CreateIndex
CREATE INDEX "Cliente_cpfCnpj_idx" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE INDEX "Estagiario_nome_idx" ON "Estagiario"("nome");

-- CreateIndex
CREATE INDEX "ModeloDistribuicao_codigo_idx" ON "ModeloDistribuicao"("codigo");

-- CreateIndex
CREATE INDEX "ModeloDistribuicao_origem_idx" ON "ModeloDistribuicao"("origem");

-- CreateIndex
CREATE INDEX "ModeloDistribuicao_tipo_idx" ON "ModeloDistribuicao"("tipo");

-- CreateIndex
CREATE INDEX "OrdemPagamento_clienteId_idx" ON "OrdemPagamento"("clienteId");

-- CreateIndex
CREATE INDEX "OrdemPagamento_status_idx" ON "OrdemPagamento"("status");

-- CreateIndex
CREATE INDEX "OrdemPagamento_dataInicio_idx" ON "OrdemPagamento"("dataInicio");

-- CreateIndex
CREATE INDEX "OrdemPagamento_anoMesInicio_idx" ON "OrdemPagamento"("anoMesInicio");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemPagamento_clienteId_sequenciaCliente_key" ON "OrdemPagamento"("clienteId", "sequenciaCliente");

-- CreateIndex
CREATE INDEX "Pagamento_ordemPagamentoId_idx" ON "Pagamento"("ordemPagamentoId");

-- CreateIndex
CREATE INDEX "Pagamento_dataPrevista_idx" ON "Pagamento"("dataPrevista");

-- CreateIndex
CREATE INDEX "Pagamento_dataEfetiva_idx" ON "Pagamento"("dataEfetiva");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");

-- CreateIndex
CREATE INDEX "PrestadorServico_nome_idx" ON "PrestadorServico"("nome");

-- CreateIndex
CREATE INDEX "PrestadorServico_tipo_idx" ON "PrestadorServico"("tipo");

-- CreateIndex
CREATE INDEX "Repasse_advogadoId_idx" ON "Repasse"("advogadoId");

-- CreateIndex
CREATE INDEX "Repasse_ordemPagamentoId_idx" ON "Repasse"("ordemPagamentoId");

-- CreateIndex
CREATE INDEX "Repasse_referenciaCompetencia_idx" ON "Repasse"("referenciaCompetencia");

-- CreateIndex
CREATE INDEX "Repasse_dataPagamento_idx" ON "Repasse"("dataPagamento");
