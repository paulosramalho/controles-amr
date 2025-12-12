# Controles-AMR

Protótipo inicial do sistema de controle de recebimentos de honorários e repasses do escritório **Amanda Maia Ramalho Advogados (AMR Advogados)**.

## Estrutura do projeto

- `backend/` – API Node/Express (futura integração com banco de dados e geração de relatórios em PDF).
- `frontend/` – Interface web em React (Vite) para uso 100% via navegador.
- `shared/` – Documentação de modelos de dados e regras de negócio, para garantir que tudo fique baseado em **tabelas**, e não em regras estáticas no código.

> Observação: este é apenas o esqueleto inicial. As tabelas, regras, cálculos e telas serão detalhadas e implementadas aos poucos.

## Como rodar

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

API padrão em `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicação em `http://localhost:5173` (com proxy configurado para `/api` → `localhost:4000`).

---

## Módulos previstos

1. **Pagamentos efetuados pelos clientes**
2. **Cadastro de clientes e “ordens de pagamento”**
3. **Controle de repasses a advogados**
4. **Controle de pagamentos de estagiários**
5. **Controle de prestadores de serviço (ex.: secretária virtual)**
6. **Modelos de cálculo de percentuais e destinatários**
7. **Controle de acesso (login, esqueci minha senha, criar usuário)**
8. **Relatórios em PDF**

Todas as regras de cálculo e distribuição serão configuradas em tabelas (no banco ou em tabelas de configuração), evitando lógica fixa no código.