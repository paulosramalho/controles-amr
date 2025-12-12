import React, { useEffect, useState } from "react";

function useHealth() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: "erro" }));
  }, []);

  return status;
}

export default function App() {
  const health = useHealth();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <header
        style={{
          padding: "1rem 2rem",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            Controles-AMR
          </h1>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
            Controle de recebimentos, repasses e obrigações internas – AMR Advogados
          </p>
        </div>
        <div style={{ fontSize: "0.8rem", color: "#666" }}>
          Backend:{" "}
          <strong>
            {health ? health.status : "verificando..."}
          </strong>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex" }}>
        <nav
          style={{
            width: "260px",
            borderRight: "1px solid #eee",
            padding: "1rem",
            fontSize: "0.9rem"
          }}
        >
          <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Módulos</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li><strong>1.</strong> Pagamentos de clientes</li>
            <li><strong>2.</strong> Clientes &amp; ordens de pagamento</li>
            <li><strong>3.</strong> Repasses a advogados</li>
            <li><strong>4.</strong> Estagiários</li>
            <li><strong>5.</strong> Prestadores de serviço</li>
            <li><strong>6.</strong> Modelos de cálculo</li>
            <li><strong>7.</strong> Controle de acesso</li>
            <li><strong>8.</strong> Relatórios (PDF)</li>
          </ul>

          <hr style={{ margin: "1rem 0" }} />

          <p style={{ fontSize: "0.8rem", color: "#777" }}>
            Filtros por advogado, intervalo de datas e cliente serão incluídos nas telas de listagem
            (Dashboard, pagamentos, repasses, etc.).
          </p>
        </nav>

        <section style={{ flex: 1, padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>
            Bem-vinda ao protótipo do Controles-AMR
          </h2>
          <p style={{ fontSize: "0.9rem", maxWidth: "720px", lineHeight: 1.5 }}>
            Este é o esqueleto inicial da aplicação web que irá controlar:
          </p>
          <ul style={{ fontSize: "0.9rem", maxWidth: "720px" }}>
            <li>Pagamentos efetuados pelos clientes (à vista, entrada + parcelas, apenas parcelas);</li>
            <li>Cadastro de clientes e sequência de controle de pagamentos (ordens de pagamento);</li>
            <li>Repasses de honorários aos advogados, com saldos a receber;</li>
            <li>Pagamentos recorrentes (fixos mensais) a advogados, estagiários e prestadores;</li>
            <li>Modelos de cálculo de distribuição (advogado, sócio, fundo de reserva, escritório);</li>
            <li>Login, criação de usuários e recuperação de senha;</li>
            <li>Relatórios em PDF para administração e conferência.</li>
          </ul>

          <p style={{ fontSize: "0.9rem", maxWidth: "720px", marginTop: "1rem" }}>
            Toda a lógica de cálculo e distribuição deverá ser parametrizada em tabelas de configuração,
            permitindo alteração sem mexer diretamente no código.
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "0.85rem",
              background: "#fafafa"
            }}
          >
            <strong>Próximos passos sugeridos:</strong>
            <ol>
              <li>Definir modelo de dados inicial (tabelas: clientes, advogados, pagamentos, repasses, etc.).</li>
              <li>Configurar banco de dados (ex.: Postgres) e camada de acesso.</li>
              <li>Implementar rotas REST para cada módulo principal.</li>
              <li>Criar as primeiras telas de cadastro e listagem (clientes, advogados, pagamentos).</li>
              <li>Implementar login e perfis de acesso (administrativo x operacional).</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}