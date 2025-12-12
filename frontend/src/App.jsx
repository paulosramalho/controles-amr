import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useBackendStatus() {
  const [status, setStatus] = useState({ loading: true, ok: false });

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setStatus({ loading: false, ok: true, data });
      } catch (err) {
        console.error("Erro ao falar com backend:", err);
        setStatus({ loading: false, ok: false });
      }
    }
    check();
  }, []);

  return status;
}

function App() {
  const backend = useBackendStatus();

  const backendLabel = backend.loading
    ? "verificando..."
    : backend.ok
    ? "ok"
    : "erro";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="w-full border-b bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Controles-AMR</h1>
          <p className="text-sm text-slate-500">
            Controle de recebimentos, repasses e obrigações internas – AMR Advogados
          </p>
        </div>
        <div className="text-sm">
          <span className="text-slate-500 mr-2">Backend:</span>
          <span
            className={
              backendLabel === "ok"
                ? "text-green-600 font-semibold"
                : backendLabel === "erro"
                ? "text-red-600 font-semibold"
                : "text-slate-500"
            }
          >
            {backendLabel}
          </span>
        </div>
      </header>

      {/* Layout principal */}
      <main className="flex">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-white px-6 py-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Módulos</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
            <li>Pagamentos de clientes</li>
            <li>Clientes &amp; ordens de pagamento</li>
            <li>Repasses a advogados</li>
            <li>Estagiários</li>
            <li>Prestadores de serviço</li>
            <li>Modelos de cálculo</li>
            <li>Controle de acesso</li>
            <li>Relatórios (PDF)</li>
          </ol>

          <p className="mt-4 text-xs text-slate-500">
            Filtros por advogado, intervalo de datas e cliente serão incluídos nas telas de
            listagem (Dashboard, pagamentos, repasses, etc.).
          </p>
        </aside>

        {/* Conteúdo */}
        <section className="flex-1 px-8 py-8">
          <h2 className="text-lg font-semibold mb-2">
            Bem-vinda ao protótipo do Controles-AMR
          </h2>

          <p className="text-sm text-slate-700 mb-4">
            Este é o esqueleto inicial da aplicação web que irá controlar:
          </p>

          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
            <li>Pagamentos efetuados pelos clientes (à vista, entrada + parcelas, apenas parcelas);</li>
            <li>Cadastro de clientes e sequência de controle de pagamentos (ordens de pagamento);</li>
            <li>Repasses de honorários aos advogados, com saldos a receber;</li>
            <li>Pagamentos recorrentes (fixos mensais) a advogados, estagiários e prestadores;</li>
            <li>Modelos de cálculo de distribuição (advogado, sócio, fundo de reserva, escritório);</li>
            <li>Login, criação de usuários e recuperação de senha;</li>
            <li>Relatórios em PDF para administração e conferência.</li>
          </ul>

          <p className="text-sm text-slate-700 mb-4">
            Toda a lógica de cálculo e distribuição deverá ser parametrizada em tabelas de configuração,
            permitindo alteração sem mexer diretamente no código.
          </p>

          <h3 className="text-sm font-semibold mb-2">Próximos passos sugeridos:</h3>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            <li>Definir modelo de dados inicial (tabelas: clientes, advogados, pagamentos, repasses, etc.).</li>
            <li>Configurar banco de dados (ex.: Postgres) e camada de acesso.</li>
            <li>Implementar rotas REST para cada módulo principal.</li>
            <li>Criar as primeiras telas de cadastro e listagem (clientes, advogados, pagamentos).</li>
            <li>Implementar login e perfis de acesso (administrativo x operacional).</li>
          </ul>

          <div className="mt-6 text-xs text-slate-500">
            <p>
              API base utilizada: <code>{API_BASE}</code>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
