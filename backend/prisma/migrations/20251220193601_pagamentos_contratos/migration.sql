-- CreateEnum
CREATE TYPE "FormaPagamentoContrato" AS ENUM ('AVISTA', 'ENTRADA_PARCELAS', 'PARCELADO');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('PREVISTA', 'RECEBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MeioRecebimento" AS ENUM ('PIX', 'TED', 'BOLETO', 'CARTAO', 'DINHEIRO', 'OUTRO');

-- CreateTable
CREATE TABLE "ContratoPagamento" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "numeroContrato" VARCHAR(60) NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamentoContrato" NOT NULL,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContratoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaContrato" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valorPrevisto" DECIMAL(12,2) NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'PREVISTA',
    "dataRecebimento" TIMESTAMP(3),
    "valorRecebido" DECIMAL(12,2),
    "meioRecebimento" "MeioRecebimento",
    "observacoes" TEXT,

    CONSTRAINT "ParcelaContrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContratoPagamento_numeroContrato_key" ON "ContratoPagamento"("numeroContrato");

-- CreateIndex
CREATE INDEX "ContratoPagamento_clienteId_idx" ON "ContratoPagamento"("clienteId");

-- CreateIndex
CREATE INDEX "ContratoPagamento_formaPagamento_idx" ON "ContratoPagamento"("formaPagamento");

-- CreateIndex
CREATE INDEX "ContratoPagamento_ativo_idx" ON "ContratoPagamento"("ativo");

-- CreateIndex
CREATE INDEX "ParcelaContrato_vencimento_idx" ON "ParcelaContrato"("vencimento");

-- CreateIndex
CREATE INDEX "ParcelaContrato_status_idx" ON "ParcelaContrato"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaContrato_contratoId_numero_key" ON "ParcelaContrato"("contratoId", "numero");

-- AddForeignKey
ALTER TABLE "ContratoPagamento" ADD CONSTRAINT "ContratoPagamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaContrato" ADD CONSTRAINT "ParcelaContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoPagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
