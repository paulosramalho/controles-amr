/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADVOGADO', 'USUARIO', 'ESTAGIARIO');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "tipoUsuario" "TipoUsuario" NOT NULL DEFAULT 'USUARIO';

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE INDEX "Usuario_tipoUsuario_idx" ON "Usuario"("tipoUsuario");
