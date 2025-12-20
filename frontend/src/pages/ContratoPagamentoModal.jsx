// src/components/ContratoPagamentoModal.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function ContratoPagamentoModal({ onClose, onSaved }) {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({
    clienteId: "",
    numeroContrato: "",
    valorTotal: "",
    formaPagamento: "AVISTA",
    observacoes: "",
  });

  useEffect(() => {
    api.get("/clientes").then((r) => setClientes(r.data || []));
  }, []);

  async function salvar() {
    try {
      await api.post("/contratos", form);
      onSaved();
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao salvar contrato");
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Novo Contrato de Pagamento</h2>

        <select
          value={form.clienteId}
          onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nomeRazaoSocial}
            </option>
          ))}
        </select>

        <input
          placeholder="Número do contrato"
          value={form.numeroContrato}
          onChange={(e) =>
            setForm({ ...form, numeroContrato: e.target.value })
          }
        />

        <input
          placeholder="Valor total (ex: 123456 → 1.234,56)"
          value={form.valorTotal}
          onChange={(e) =>
            setForm({ ...form, valorTotal: e.target.value })
          }
        />

        <select
          value={form.formaPagamento}
          onChange={(e) =>
            setForm({ ...form, formaPagamento: e.target.value })
          }
        >
          <option value="AVISTA">À vista</option>
          <option value="PARCELADO">Parcelado</option>
          <option value="ENTRADA_PARCELAS">Entrada + Parcelas</option>
        </select>

        <textarea
          placeholder="Observações"
          value={form.observacoes}
          onChange={(e) =>
            setForm({ ...form, observacoes: e.target.value })
          }
        />

        <footer>
          <button onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>
            Salvar
          </button>
        </footer>
      </div>
    </div>
  );
}
