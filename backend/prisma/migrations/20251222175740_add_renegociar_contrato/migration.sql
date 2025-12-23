-- AlterTable
ALTER TABLE "ContratoPagamento" ADD COLUMN     "contratoOrigemId" INTEGER,
ADD COLUMN     "renegociadoEm" TIMESTAMP(3),
ADD COLUMN     "renegociadoParaId" INTEGER,
ADD COLUMN     "renegociadoPorId" INTEGER;

-- CreateIndex
CREATE INDEX "ContratoPagamento_contratoOrigemId_idx" ON "ContratoPagamento"("contratoOrigemId");

-- CreateIndex
CREATE INDEX "ContratoPagamento_renegociadoParaId_idx" ON "ContratoPagamento"("renegociadoParaId");

-- AddForeignKey
ALTER TABLE "ContratoPagamento" ADD CONSTRAINT "ContratoPagamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "ContratoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoPagamento" ADD CONSTRAINT "ContratoPagamento_renegociadoParaId_fkey" FOREIGN KEY ("renegociadoParaId") REFERENCES "ContratoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoPagamento" ADD CONSTRAINT "ContratoPagamento_renegociadoPorId_fkey" FOREIGN KEY ("renegociadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
