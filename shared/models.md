# Modelos de dados – Controles-AMR (versão atualizada)

> Objetivo: garantir que todo o controle financeiro do escritório AMR Advogados
> (recebimentos, repasses, fixos mensais, distribuição de lucros etc.) seja
> guiado por **tabelas** e **configurações**, e não por regras fixas no código.

---

## 1. Clientes

Representa a pessoa física ou jurídica que contrata o escritório.

Campos mínimos:

- `id` – identificador interno
- `cpf_cnpj`
- `nome_razao_social`
- `email`
- `telefone`
- `observacoes` (opcional)
- `ativo` (boolean)

---

## 2. Ordens de pagamento (contratos / ocorrências por cliente)

A **ordem de pagamento** aqui NÃO é um boleto isolado, e sim a
**“sequência de ocorrência” financeira de um contrato/caso** de um cliente.

Cada contrato/caso que gera obrigações de pagamento do cliente ao escritório
deve ter **sua própria ordem de pagamento**, mesmo que existam vários contratos
concomitantes para o mesmo cliente.

Relação:

- Um **cliente** possui **várias ordens de pagamento**.
- Cada **ordem de pagamento** está ligada a **um contrato/caso específico**.

Campos sugeridos:

- `id`
- `cliente_id` – FK → `clientes`
- `sequencia_cliente` – número sequencial da ordem **dentro do cliente**
  - Ex.: cliente X → ordem 1, ordem 2, ordem 3…
- `codigo_interno` – identificador amigável (ex.: `CLI123-OP02`) (opcional)
- `descricao` – ex.: “Ação trabalhista João x Empresa Y”
- `tipo_contrato` – trabalhista, cível, consultivo, empresarial etc. (opcional)
- `valor_total_previsto`
- `modelo_pagamento` – à vista / entrada + N parcelas / N parcelas
- `data_inicio` – data de assinatura do contrato/mandato
- `data_fim_prevista` – se aplicável
- `status` – ativo, concluído, suspenso, cancelado

Essa tabela é a base para todos os cálculos posteriores, pois organiza o fluxo
financeiro por **contrato** e não apenas por cliente solto.

---

## 3. Pagamentos efetuados (parcelas, entradas, aditivos)

Cada **pagamento** representa uma parcela (ou entrada/aditivo) dentro de uma
ordem de pagamento.

Relação:

- Uma **ordem de pagamento** possui **vários pagamentos**.
- Cada pagamento pertence a **uma única ordem**.

Campos sugeridos:

- `id`
- `ordem_pagamento_id` – FK → `ordens_pagamento`
- `numero_parcela` – número da parcela (0 = entrada, 1, 2, 3…)
- `data_prevista`
- `data_efetiva` – nula enquanto não pago
- `valor_previsto`
- `valor_pago`
- `forma_pagamento` – pix, boleto, cartão, transferência, dinheiro etc.
- `status` – em_aberto, pago, parcialmente_pago, cancelado
- `observacoes`

Esses registros são a base para:

- Controle de inadimplência;
- Gatilho de cálculo de repasses para advogados;
- Dashboards de recebimentos.

---

## 4. Advogados

Advogados do escritório que podem receber repasses de honorários, fixos mensais
ou participação em distribuição de lucros.

Campos mínimos:

- `id`
- `nome`
- `cpf`
- `email`
- `telefone`
- `tipo` – sócio_patrimonial, sócio_serviço, associado, correspondente etc.
- `possui_fixo_mensal` – boolean
- `valor_fixo_mensal` – se aplicável
- `ativo` – boolean

---

## 5. Repasses a advogados

Tabela que registra o que é devido e o que foi efetivamente pago a cada
advogado, seja por contrato específico, seja por período (mensal).

Campos sugeridos:

- `id`
- `advogado_id` – FK → `advogados`
- `ordem_pagamento_id` – FK (opcional, para vincular a um contrato específico)
- `referencia_competencia` – ex.: `2025-01` (AAAAMM) ou data
- `valor_devido`
- `valor_pago`
- `data_pagamento` – se já pago
- `saldo_a_receber` – pode ser campo derivado ou armazenado
- `origem` – incidental, mensal/recorrente, distribuição_lucro etc.
- `modelo_distribuicao_codigo` – FK lógica para tabela de modelos de distribuição
- `observacoes`

Essa tabela é usada para:

- Visualizar saldos a receber por advogado;
- Controlar pagamentos parciais;
- Conferir histórico de repasses.

---

## 6. Estagiários

Controle de estagiários e seus respectivos auxílios (transporte, estágio).

Campos:

- `id`
- `nome`
- `cpf`
- `email`
- `telefone`
- `auxilio_transporte_valor`
- `auxilio_estagio_valor`
- `ativo` – boolean

Pagamentos a estagiários podem ficar em uma tabela à parte (ex.: `pagamentos_estagiarios`)
ou serem consolidados em uma tabela de “obrigações internas” do escritório, a depender
da estratégia.

---

## 7. Prestadores de serviço

Ex.: secretária virtual, serviços de contabilidade, TI etc.

Campos:

- `id`
- `nome_razao_social`
- `cpf_cnpj`
- `tipo` – secretária_virtual, contabilidade, ti, outros
- `valor_recorrente` – se houver mensalidade/recorrência
- `observacoes`
- `ativo` – boolean

Da mesma forma, os pagamentos podem ser controlados em tabela própria ou em uma
tabela consolidada de despesas fixas/variáveis.

---

## 8. Usuários e perfis de acesso

Controle de quem acessa o sistema (para login, esqueci minha senha, perfis
administrativos x operacionais).

Campos:

- `id`
- `nome`
- `email` – usado como login
- `senha_hash`
- `perfil` – admin, financeiro, operacional, apenas_leitura etc.
- `ativo` – boolean
- `criado_em`
- `atualizado_em`

---

## 9. Configurações de cálculo (% por tipo de caso / contrato)

Tabela de configuração que indica **como** cada tipo de caso/contrato deve
ser distribuído entre Advogado, Sócio, Fundo de Reserva e Escritório.

Exemplo de campos (conceituais):

- `id`
- `codigo_modelo` – ex.: `TRABALHISTA_PADRAO`, `CIVEL_COMPLEXO`
- `descricao`
- `percentual_advogado`
- `percentual_socio`
- `percentual_fundo_reserva`
- `percentual_escritorio`
- `vigencia_inicio`
- `vigencia_fim` (opcional)
- `ativo`

Essa tabela é conceitualmente diferente da tabela de **modelos de distribuição A–G**,
que está logo abaixo e representa “famílias” de distribuição por origem/tipo.

---

## 10. Modelos de distribuição (A, B, C, D, E, F, G)

Os modelos de distribuição A, B, C, D, E, F e G estão descritos na tabela
`shared/modelos_distribuicao.csv`, com os seguintes campos:

- `codigo` – identificador do modelo (A, B, C, ...);
- `origem` – de onde vem o valor (escritório, sócio, distribuição de lucro etc.);
- `tipo` – natureza/periodicidade (incidental, mensal/recorrente, semestral);
- `percentual` – percentual aplicado;
- `destinatario` – para onde o percentual vai (fundo de reserva, sócio, escritório, indicação etc.).

Esses modelos representam, por exemplo:

- **A** – Escritório / Incidental – 30% Fundo de Reserva, 30% Sócio, 40% Escritório;
- **B** – Escritório / Mensal/Recorrente – 30% Fundo de Reserva, 70% Escritório;
- **C** – Sócio / Incidental – 30% Fundo de Reserva, 50% Sócio, 20% Escritório;
- **D** – Sócio / Mensal/Recorrente – 30% Fundo de Reserva, 50% Sócio, 20% Escritório;
- **E** – Distribuição de lucro (fundo de reserva) / Semestral – 70% Sócio Patrimonial, 15% Sócio de Serviço, 15% Sócio de Serviço;
- **F** – Sócio para outro sócio / Incidental – 20% Indicação, 30% Sócio, 30% Fundo de Reserva, 20% Escritório;
- **G** – Sócio para outro sócio / Mensal/Recorrente – 20% Indicação, 30% Sócio, 30% Fundo de Reserva, 20% Escritório.

A aplicação desses modelos deve ser feita sempre via consulta a essa tabela
(ou tabela equivalente no banco de dados), evitando que os percentuais fiquem
fixos no código.

---

## 11. Relatórios e filtros

Relatórios em PDF e telas do sistema deverão permitir filtros combináveis:

- Por advogado;
- Por cliente;
- Por intervalo de datas (competência e/ou data de pagamento);
- Por ordem de pagamento (contrato);
- Por status (em aberto, pago, parcialmente pago etc.).

Esses filtros devem trabalhar sempre em cima das tabelas descritas acima,
para manter o app coerente e auditável.

---

Este documento é um guia conceitual. À medida que a implementação avançar
(especialmente a modelagem em banco – ex.: Postgres + Prisma), os campos,
tipos e relacionamentos podem ser refinados, mantendo sempre o princípio
central: **nada crítico de cálculo ou regra de negócio deve ficar engessado
no código, e sim em tabelas de configuração.**