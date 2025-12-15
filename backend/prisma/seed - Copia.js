import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do Controles-AMR...");

  // Modelos de distribuição A–G (baseados na planilha)
  const modelos = [
    // A – ESCRITÓRIO / INCIDENTAL
    { codigo: "A", origem: "ESCRITÓRIO", tipo: "INCIDENTAL", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "A", origem: "ESCRITÓRIO", tipo: "INCIDENTAL", percentual: 30, destinatario: "SÓCIO" },
    { codigo: "A", origem: "ESCRITÓRIO", tipo: "INCIDENTAL", percentual: 40, destinatario: "ESCRITÓRIO" },

    // B – ESCRITÓRIO / MENSAL/RECORRENTE
    { codigo: "B", origem: "ESCRITÓRIO", tipo: "MENSAL/RECORRENTE", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "B", origem: "ESCRITÓRIO", tipo: "MENSAL/RECORRENTE", percentual: 70, destinatario: "ESCRITÓRIO" },

    // C – SÓCIO / INCIDENTAL
    { codigo: "C", origem: "SÓCIO", tipo: "INCIDENTAL", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "C", origem: "SÓCIO", tipo: "INCIDENTAL", percentual: 50, destinatario: "SÓCIO" },
    { codigo: "C", origem: "SÓCIO", tipo: "INCIDENTAL", percentual: 20, destinatario: "ESCRITÓRIO" },

    // D – SÓCIO / MENSAL/RECORRENTE
    { codigo: "D", origem: "SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "D", origem: "SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 50, destinatario: "SÓCIO" },
    { codigo: "D", origem: "SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 20, destinatario: "ESCRITÓRIO" },

    // E – DISTRIBUIÇÃO DE LUCRO / SEMESTRAL
    { codigo: "E", origem: "DISTRIBUIÇÃO DE LUCRO (FUNDO DE RESERVA)", tipo: "SEMESTRAL", percentual: 70, destinatario: "S. PATRIMONIAL" },
    { codigo: "E", origem: "DISTRIBUIÇÃO DE LUCRO (FUNDO DE RESERVA)", tipo: "SEMESTRAL", percentual: 15, destinatario: "S. DE SERVIÇO" },
    { codigo: "E", origem: "DISTRIBUIÇÃO DE LUCRO (FUNDO DE RESERVA)", tipo: "SEMESTRAL", percentual: 15, destinatario: "S. DE SERVIÇO" },

    // F – SÓCIO PARA OUTRO SÓCIO / INCIDENTAL
    { codigo: "F", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "INCIDENTAL", percentual: 20, destinatario: "INDICAÇÃO" },
    { codigo: "F", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "INCIDENTAL", percentual: 30, destinatario: "SÓCIO" },
    { codigo: "F", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "INCIDENTAL", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "F", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "INCIDENTAL", percentual: 20, destinatario: "ESCRITÓRIO" },

    // G – SÓCIO PARA OUTRO SÓCIO / MENSAL/RECORRENTE
    { codigo: "G", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 20, destinatario: "INDICAÇÃO" },
    { codigo: "G", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 30, destinatario: "SÓCIO" },
    { codigo: "G", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 30, destinatario: "FUNDO DE RESERVA" },
    { codigo: "G", origem: "SÓCIO PARA OUTRO SÓCIO", tipo: "MENSAL/RECORRENTE", percentual: 20, destinatario: "ESCRITÓRIO" }
  ];

  for (const m of modelos) {
    await prisma.modeloDistribuicao.create({
      data: {
        codigo: m.codigo,
        origem: m.origem,
        tipo: m.tipo,
        percentual: m.percentual,
        destinatario: m.destinatario
      }
    });
  }

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
