-- CreateTable
CREATE TABLE "RetificacaoContrato" (
    "id" SERIAL NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "alteracoes" JSONB NOT NULL,
    "snapshotAntes" JSONB,
    "snapshotDepois" JSONB,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetificacaoContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetificacaoParcela" (
    "id" SERIAL NOT NULL,
    "parcelaId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "alteracoes" JSONB NOT NULL,
    "snapshotAntes" JSONB,
    "snapshotDepois" JSONB,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetificacaoParcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetificacaoContrato_contratoId_idx" ON "RetificacaoContrato"("contratoId");

-- CreateIndex
CREATE INDEX "RetificacaoContrato_criadoPorId_idx" ON "RetificacaoContrato"("criadoPorId");

-- CreateIndex
CREATE INDEX "RetificacaoParcela_parcelaId_idx" ON "RetificacaoParcela"("parcelaId");

-- CreateIndex
CREATE INDEX "RetificacaoParcela_criadoPorId_idx" ON "RetificacaoParcela"("criadoPorId");

-- AddForeignKey
ALTER TABLE "RetificacaoContrato" ADD CONSTRAINT "RetificacaoContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetificacaoContrato" ADD CONSTRAINT "RetificacaoContrato_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetificacaoParcela" ADD CONSTRAINT "RetificacaoParcela_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "ParcelaContrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetificacaoParcela" ADD CONSTRAINT "RetificacaoParcela_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
