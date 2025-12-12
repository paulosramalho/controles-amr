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

/* -------------------------------------------------------------------------- */
/*                           FORM CLIENTE + ORDEM                             */
/* -------------------------------------------------------------------------- */
function ClientOrderForm() {
  const [client, setClient] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
  });

  const [order, setOrder] = useState({
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "",
    modeloPagamento: "AVISTA",
    dataInicio: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleOrderChange = (e) => {
    const { name, value } = e.target;
    setOrder((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        client,
        order: {
          ...order,
          valorTotalPrevisto: order.valorTotalPrevisto
            ? Number(order.valorTotalPrevisto.toString().replace(",", "."))
            : null,
        },
      };

      const res = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Erro ao criar cliente + ordem");
      }

      const data = await res.json();
      setResult(data);

      // resetar form
      setClient({
        cpfCnpj: "",
        nomeRazaoSocial: "",
        email: "",
        telefone: "",
      });

      setOrder({
        descricao: "",
        tipoContrato: "",
        valorTotalPrevisto: "",
        modeloPagamento: "AVISTA",
        dataInicio: "",
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" onSubmit={handleSubmit}>
      <div>
        <h4 className="font-semibold mb-2">Dados do cliente</h4>
        <div className="space-y-2">
          <input
            type="text"
            name="cpfCnpj"
            placeholder="CPF/CNPJ"
            value={client.cpfCnpj}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
            required
          />
          <input
            type="text"
            name="nomeRazaoSocial"
            placeholder="Nome / Razão Social"
            value={client.nomeRazaoSocial}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="E-mail"
            value={client.email}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="telefone"
            placeholder="Telefone"
            value={client.telefone}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
          />
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Dados da ordem de pagamento</h4>
        <div className="space-y-2">
          <input
            type="text"
            name="descricao"
            placeholder="Descrição / Objeto"
            value={order.descricao}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="tipoContrato"
            placeholder="Tipo de contrato"
            value={order.tipoContrato}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="valorTotalPrevisto"
            placeholder="Valor total previsto"
            value={order.valorTotalPrevisto}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <select
            name="modeloPagamento"
            value={order.modeloPagamento}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          >
            <option value="AVISTA">À vista</option>
            <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
            <option value="PARCELAS">Somente parcelas</option>
          </select>
          <input
            type="date"
            name="dataInicio"
            value={order.dataInicio}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
      </div>

      <div className="md:col-span-2 flex gap-4 items-center">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar cliente + ordem"}
        </button>

        {error && <span className="text-xs text-red-600">{error}</span>}
        {result && (
          <span className="text-xs text-green-700">
            Criado! Cliente #{result.cliente.id}, Ordem #{result.ordem.id} (sequência {result.ordem.sequenciaCliente})
          </span>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

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

      {/* Layout */}
      <main className="flex">
        <aside className="w-80 border-r bg-white px-6 py-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Módulos</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
            <li>Pagamentos de clientes</li>
            <li>Clientes & ordens de pagamento</li>
            <li>Repasses a advogados</li>
            <li>Estagiários</li>
            <li>Prestadores de serviço</li>
            <li>Modelos de cálculo</li>
            <li>Controle de acesso</li>
            <li>Relatórios (PDF)</li>
          </ol>
        </aside>

        <section className="flex-1 px-8 py-8">
          <h2 className="text-lg font-semibold mb-4">
            Cadastro rápido: Cliente + Ordem de Pagamento
          </h2>

          <ClientOrderForm />

          <div className="mt-10 text-xs text-slate-500">
            <p>API base utilizada: <code>{API_BASE}</code></p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
