-- CreateEnum
CREATE TYPE "ModeloPagamento" AS ENUM ('AVISTA', 'ENTRADA_E_PARCELAS', 'PARCELAS');

-- CreateEnum
CREATE TYPE "StatusOrdem" AS ENUM ('ATIVA', 'CONCLUIDA', 'SUSPENSA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('EM_ABERTO', 'PAGO', 'PARCIAL', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAdvogado" AS ENUM ('SOCIO_PATRIMONIAL', 'SOCIO_SERVICO', 'ASSOCIADO', 'CORRESPONDENTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "OrigemRepasse" AS ENUM ('INCIDENTAL', 'MENSAL_RECORRENTE', 'DISTRIBUICAO_LUCRO', 'OUTRA');

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'FINANCEIRO', 'OPERACIONAL', 'LEITURA');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "nomeRazaoSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemPagamento" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "sequenciaCliente" INTEGER NOT NULL,
    "codigoInterno" TEXT,
    "descricao" TEXT,
    "tipoContrato" TEXT,
    "valorTotalPrevisto" DECIMAL(65,30),
    "modeloPagamento" "ModeloPagamento" NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFimPrevista" TIMESTAMP(3),
    "status" "StatusOrdem" NOT NULL,

    CONSTRAINT "OrdemPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ordemPagamentoId" INTEGER NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "dataEfetiva" TIMESTAMP(3),
    "valorPrevisto" DECIMAL(65,30) NOT NULL,
    "valorPago" DECIMAL(65,30),
    "formaPagamento" TEXT,
    "status" "StatusPagamento" NOT NULL,
    "observacoes" TEXT,

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
    "ordemPagamentoId" INTEGER,
    "referenciaCompetencia" TEXT NOT NULL,
    "valorDevido" DECIMAL(65,30) NOT NULL,
    "valorPago" DECIMAL(65,30),
    "dataPagamento" TIMESTAMP(3),
    "saldoAReceber" DECIMAL(65,30),
    "origem" "OrigemRepasse" NOT NULL,
    "modeloDistribuicaoCodigo" TEXT,
    "observacoes" TEXT,

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estagiario" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "auxilioTransporteValor" DECIMAL(65,30),
    "auxilioEstagioValor" DECIMAL(65,30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Estagiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrestadorServico" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nomeRazaoSocial" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "tipo" TEXT NOT NULL,
    "valorRecorrente" DECIMAL(65,30),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PrestadorServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoCalculo" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "codigoModelo" TEXT NOT NULL,
    "descricao" TEXT,
    "percentualAdvogado" DECIMAL(65,30) NOT NULL,
    "percentualSocio" DECIMAL(65,30) NOT NULL,
    "percentualFundoReserva" DECIMAL(65,30) NOT NULL,
    "percentualEscritorio" DECIMAL(65,30) NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConfiguracaoCalculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloDistribuicao" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "codigo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "percentual" DECIMAL(65,30) NOT NULL,
    "destinatario" TEXT NOT NULL,

    CONSTRAINT "ModeloDistribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoCalculo_codigoModelo_key" ON "ConfiguracaoCalculo"("codigoModelo");

-- AddForeignKey
ALTER TABLE "OrdemPagamento" ADD CONSTRAINT "OrdemPagamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_ordemPagamentoId_fkey" FOREIGN KEY ("ordemPagamentoId") REFERENCES "OrdemPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_advogadoId_fkey" FOREIGN KEY ("advogadoId") REFERENCES "Advogado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_ordemPagamentoId_fkey" FOREIGN KEY ("ordemPagamentoId") REFERENCES "OrdemPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
