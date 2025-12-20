// src/pages/Pagamentos.jsx
import { useEffect, useState } from "react";
import api from "../api";
import ContratoPagamentoModal from "../components/ContratoPagamentoModal";
import ParcelasModal from "../components/ParcelasModal";

export default function PagamentosPage({ user }) {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  const [modalContrato, setModalContrato] = useState(false);
  const [modalParcelas, setModalParcelas] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/contratos", {
        params: busca ? { q: busca } : {},
      });
      setContratos(res.data || []);
    } catch (e) {
      alert("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (user?.role !== "ADMIN") {
    return <p>Acesso restrito.</p>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Pagamentos</h1>

        <button
          className="btn-primary"
          onClick={() => setModalContrato(true)}
        >
          + Novo Contrato
        </button>
      </header>

      <div className="card">
        <div className="card-actions">
          <input
            placeholder="Buscar por contrato, cliente, CPF/CNPJ…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button onClick={load}>Atualizar</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Cliente</th>
              <th>Valor Total</th>
              <th>Forma</th>
              <th>Parcelas</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {contratos.map((c) => (
              <tr key={c.id}>
                <td>{c.numeroContrato}</td>
                <td>{c.cliente?.nomeRazaoSocial}</td>
                <td>
                  R$ {Number(c.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td>{c.formaPagamento}</td>
                <td>
                  {c.resumo.qtdRecebidas}/{c.resumo.qtdParcelas}
                </td>
                <td>
                  {c.ativo ? <span className="tag ativo">Ativo</span> : "Inativo"}
                </td>
                <td>
                  <button onClick={() => setModalParcelas(c)}>
                    Parcelas
                  </button>
                </td>
              </tr>
            ))}

            {!contratos.length && (
              <tr>
                <td colSpan="7">Nenhum contrato encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalContrato && (
        <ContratoPagamentoModal
          onClose={() => setModalContrato(false)}
          onSaved={() => {
            setModalContrato(false);
            load();
          }}
        />
      )}

      {modalParcelas && (
        <ParcelasModal
          contrato={modalParcelas}
          onClose={() => setModalParcelas(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
