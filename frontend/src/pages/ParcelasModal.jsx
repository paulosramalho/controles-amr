// src/components/ParcelasModal.jsx
import api from "../api";

export default function ParcelasModal({ contrato, onClose, onUpdated }) {
  async function confirmar(parcela) {
    if (!window.confirm("Confirmar recebimento desta parcela?")) return;

    try {
      await api.patch(`/parcelas/${parcela.id}/confirmar`, {});
      onUpdated();
    } catch (e) {
      alert("Erro ao confirmar parcela");
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal large">
        <h2>Parcelas – Contrato {contrato.numeroContrato}</h2>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {contrato.parcelas.map((p) => (
              <tr key={p.id}>
                <td>{p.numero}</td>
                <td>{new Date(p.vencimento).toLocaleDateString()}</td>
                <td>
                  R$ {Number(p.valorPrevisto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td>{p.status}</td>
                <td>
                  {p.status === "PREVISTA" && (
                    <button onClick={() => confirmar(p)}>
                      Confirmar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer>
          <button onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
