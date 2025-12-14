import { useEffect, useMemo, useState } from "react";

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

/** =========================================================
 *  DIRETRIZES GERAIS (permanente)
 *  - Datas: DD/MM/AAAA
 *  - Horas: HH:MM:SS
 *  ========================================================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateBR(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTimeBR(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** =========================================================
 *  [TEMP-REST] DESCANSO — TEMPORÁRIO (REMOVER AO FINAL)
 *  ========================================================= */

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function parseTimeToHMS(timeStr = "") {
  const parts = String(timeStr).split(":").map((x) => Number(x));
  if (parts.length < 2) return null;
  const [h, m, s = 0] = parts;
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  if (s < 0 || s > 59) return null;
  return { h, m, s };
}

function buildNextTargetDate(timeStr, now = new Date()) {
  const hms = parseTimeToHMS(timeStr);
  if (!hms) return null;

  const target = new Date(now);
  target.setHours(hms.h, hms.m, hms.s, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function msToHHMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export default function App() {
  const backend = useBackendStatus();
  const now = useNow(); // [TEMP-REST] usado no descanso + footer

  const backendLabel = backend.loading ? "verificando..." : backend.ok ? "ok" : "erro";

  const moduleName = useMemo(() => {
    return "Protótipo";
  }, []);

  // [TEMP-REST] ===============================================
  // Descanso — TEMPORÁRIO (REMOVER AO FINAL)
  // [TEMP-REST] ===============================================
  const [restTime, setRestTime] = useState(""); // "HH:MM:SS"
  const [restTarget, setRestTarget] = useState(null); // Date
  const [restCountdown, setRestCountdown] = useState("00:00:00");
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [restModalStep, setRestModalStep] = useState("prompt"); // "prompt" | "postpone" | "goodnight"
  const [restPostponeTime, setRestPostponeTime] = useState(""); // "HH:MM:SS"
  const [restFiredAt, setRestFiredAt] = useState(null); // Date (trava para não re-disparar)

  // [TEMP-REST] Loop de contagem regressiva + disparo do modal
  useEffect(() => {
    if (!restTarget) return;

    const tick = () => {
      const n = new Date();
      const diff = restTarget.getTime() - n.getTime();
      setRestCountdown(msToHHMMSS(diff));

      // ✅ FIX: só dispara UMA vez por alvo e NÃO reseta modalStep a cada segundo
      if (diff <= 0 && !restFiredAt) {
        setRestFiredAt(n);
        setRestModalOpen(true);
        setRestModalStep("prompt");
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // ⚠️ Importante incluir restFiredAt nas deps para o tick respeitar a trava
  }, [restTarget, restFiredAt]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="w-full border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">
            Controles-AMR <span className="text-slate-400 font-normal">/</span>{" "}
            <span className="text-blue-900">AMR Advogados</span>
          </h1>
          <p className="text-sm text-slate-500">
            Controle de recebimentos, repasses e obrigações internas – AMR Advogados
          </p>
        </div>

        <div className="text-right text-sm">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-slate-500">Backend:</span>
            <span
              className={
                backendLabel === "ok"
                  ? "text-green-600 font-semibold"
                  : backendLabel === "erro"
                  ? "text-red-600 font-semibold"
                  : "text-slate-600"
              }
            >
              {backendLabel}
            </span>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Módulo: <span className="text-slate-800 font-medium">{moduleName}</span>
          </div>
        </div>
      </header>

      {/* Layout principal */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-white px-6 py-6 flex flex-col">
          <div>
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

            {/* [TEMP-REST] =============================================== */}
            <div className="mt-6 rounded-2xl border bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Descanso (temporário)
              </p>

              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">
                    Hora de descansar
                  </span>

                  <input
                    type="time"
                    step="1"
                    value={restTime}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRestTime(v);
                      const next = buildNextTargetDate(v, new Date());
                      setRestTarget(next);

                      // ✅ Ao definir nova meta, destrava o disparo
                      setRestFiredAt(null);

                      // Se estava em modal, fecha (novo alvo)
                      setRestModalOpen(false);
                      setRestModalStep("prompt");
                    }}
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />

                  <span className="mt-1 block text-[11px] text-slate-500">
                    (Tudo aqui é temporário e será removido ao final.)
                  </span>
                </label>

                <div className="rounded-xl border bg-white px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Hora escolhida</span>
                    <span className="font-mono text-slate-900">
                      {restTarget ? formatTimeBR(restTarget) : "—"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Regressivo</span>
                    <span className="font-mono text-slate-900">
                      {restTarget ? restCountdown : "—"}
                    </span>
                  </div>

                  {restFiredAt && (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Disparou em:{" "}
                      <span className="font-mono">{formatTimeBR(restFiredAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* [/TEMP-REST] ============================================== */}
          </div>

          {/* Footer fixo da sidebar (data/hora em tempo real) */}
          <div className="mt-auto pt-4">
            <div className="rounded-2xl border bg-white p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between font-mono">
                <span>{formatDateBR(now)}</span>
                <span>{formatTimeBR(now)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500">Usuário</span>
                <span className="text-slate-800 font-medium">Em desenvolvimento</span>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    alert("Em desenvolvimento: sair");
                  }}
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo */}
        <section className="flex-1 px-8 py-8">
          <h2 className="text-lg font-semibold mb-2">Bem-vinda ao protótipo do Controles-AMR</h2>

          <p className="text-sm text-slate-700 mb-4">
            Este é o esqueleto inicial da aplicação web que irá controlar:
          </p>

          <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
            <li>Pagamentos efetuados pelos clientes (à vista, entrada + parcelas, apenas parcelas);</li>
            <li>Cadastro de clientes e sequência de controle de pagamentos (ordens de pagamento);</li>
            <li>Repasses de honorários aos advogados, com saldos a receber;</li>
            <li>Pagamentos recorrentes (fixos mensais) a advogados, estagiários e prestadores;</li>
            <li>Modelos de cálculo de distribuição (advogado, sócio, fundo de reserva, escritório);</li>
            <li>Login, criação de usuários e recuperação de senha;</li>
            <li>Relatórios em PDF para administração e conferência.</li>
          </ul>

          <p className="mt-4 text-sm text-slate-700">
            Toda a lógica de cálculo e distribuição deverá ser parametrizada em tabelas de
            configuração, permitindo alteração sem mexer diretamente no código.
          </p>

          <div className="mt-6 rounded-2xl border bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Próximos passos sugeridos</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
              <li>Definir modelo de dados inicial (tabelas: clientes, advogados, pagamentos, repasses, etc.).</li>
              <li>Configurar banco de dados (ex.: Postgres) e camada de acesso.</li>
              <li>Implementar rotas REST para cada módulo principal.</li>
              <li>Criar as primeiras telas de cadastro e listagem (clientes, advogados, pagamentos).</li>
              <li>Implementar login e perfis de acesso (administrativo x operacional).</li>
            </ol>

            <p className="mt-4 text-xs text-slate-500">
              API base utilizada: <span className="font-mono">{API_BASE}</span>
            </p>
          </div>
        </section>
      </div>

      {/* [TEMP-REST] ===============================================
          Modal de descanso — TEMPORÁRIO (REMOVER AO FINAL)
          ========================================================= */}
      {restModalOpen && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="w-[min(520px,92vw)] rounded-2xl border bg-white shadow-lg">
            <div className="border-b px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Hora de descansar</h3>
              <p className="mt-1 text-xs text-slate-500">Alerta temporário — remover ao final.</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {restModalStep === "prompt" && (
                <>
                  <p className="text-sm text-slate-800">
                    Chegou a hora escolhida. Você deve ir descansar agora.
                  </p>

                  <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Hora alvo</span>
                      <span className="font-mono">
                        {restTarget ? formatTimeBR(restTarget) : "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span>Agora</span>
                      <span className="font-mono">{formatTimeBR(now)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200"
                      onClick={() => {
                        setRestModalStep("postpone");
                        setRestPostponeTime(restTime || "");
                      }}
                    >
                      Postergar (excepcionalmente)
                    </button>

                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => setRestModalStep("goodnight")}
                    >
                      Não, vou descansar
                    </button>
                  </div>
                </>
              )}

              {restModalStep === "postpone" && (
                <>
                  <p className="text-sm text-slate-800">
                    Ok. Informe a nova hora (HH:MM:SS) e eu volto a contar.
                  </p>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-700">Nova hora</span>
                    <input
                      type="time"
                      step="1"
                      value={restPostponeTime}
                      onChange={(e) => setRestPostponeTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200"
                      onClick={() => setRestModalStep("prompt")}
                    >
                      Voltar
                    </button>

                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => {
                        const next = buildNextTargetDate(restPostponeTime, new Date());
                        if (next) {
                          setRestTime(restPostponeTime);
                          setRestTarget(next);

                          // ✅ ao confirmar novo alvo, libera novo disparo
                          setRestFiredAt(null);

                          setRestModalOpen(false);
                          setRestModalStep("prompt");
                        }
                      }}
                    >
                      Confirmar nova hora
                    </button>
                  </div>
                </>
              )}

              {restModalStep === "goodnight" && (
                <>
                  <p className="text-sm text-slate-800">
                    Boa noite 🌙<br />
                    Descanse. Amanhã a gente continua.
                  </p>

                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => {
                        // ✅ IMPORTANTE:
                        // Não zerar restFiredAt aqui, senão o modal reabre imediatamente
                        // (restTarget está no passado). Quando você quiser rearmar,
                        // basta escolher uma nova hora na sidebar.
                        setRestModalOpen(false);
                      }}
                    >
                      Retornar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* [/TEMP-REST] ============================================== */}
    </div>
  );
}
