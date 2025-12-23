-- AlterTable
ALTER TABLE "ParcelaContrato" ADD COLUMN     "canceladaEm" TIMESTAMP(3),
ADD COLUMN     "canceladaPorId" INTEGER,
ADD COLUMN     "cancelamentoMotivo" TEXT;

-- AddForeignKey
ALTER TABLE "ParcelaContrato" ADD CONSTRAINT "ParcelaContrato_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
