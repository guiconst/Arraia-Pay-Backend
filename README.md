# 🌽 Arraia Pay — Backend API

API REST para a carteira digital temática de festa junina **Arraia Pay**.
Construída com **Node.js + Express + Supabase**.

---

## Rotas disponíveis

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | — | Status da API |
| POST | `/api/auth/register` | — | Criar conta |
| POST | `/api/auth/login` | — | Fazer login |
| POST | `/api/auth/logout` | ✅ | Fazer logout |
| POST | `/api/auth/forgot-password` | — | Recuperar senha |
| POST | `/api/auth/refresh` | — | Renovar token |
| GET | `/api/auth/me` | ✅ | Dados do usuário logado |
| GET | `/api/profile` | ✅ | Perfil completo |
| PATCH | `/api/profile` | ✅ | Editar nome/data nascimento |
| PATCH | `/api/profile/hat` | ✅ | Equipar/remover chapéu |
| PATCH | `/api/profile/weather` | ✅ | Salvar último clima |
| POST | `/api/transactions/deposit` | ✅ | Fazer depósito |
| GET | `/api/transactions` | ✅ | Histórico (paginado) |
| GET | `/api/transactions/recent` | ✅ | Últimas 3 transações |
| GET | `/api/transactions/:id` | ✅ | Transação específica |
| GET | `/api/rewards` | — | Catálogo de recompensas |
| POST | `/api/rewards/buy` | ✅ | Resgatar recompensa |
| GET | `/api/weather?lat=&lon=` | — | Buscar clima |
| GET | `/api/weather/by-ip` | — | Clima pelo IP |

---

## Configuração local

```bash
# 1. Clone e instale
git clone https://github.com/SEU_USER/arraia-pay-backend.git
cd arraia-pay-backend
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves do Supabase

# 3. Rode o servidor
npm run dev
# Acesse: http://localhost:3001/health
```

---

## Variáveis de ambiente necessárias

Crie um arquivo `.env` na raiz com:

```
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_KEY=sua_service_role_key
FRONTEND_URL=https://arraia-pay.vercel.app
PORT=3001
NODE_ENV=production
```

> ⚠️ **Nunca commite o `.env` no GitHub.** O `.gitignore` já está configurado para ignorá-lo.

---

## Deploy na Vercel

1. Crie um novo projeto na Vercel apontando para este repositório
2. Adicione todas as variáveis de ambiente nas configurações do projeto
3. O `vercel.json` já está configurado corretamente

---

## Banco de dados (Supabase)

Execute o arquivo `supabase/schema.sql` no **SQL Editor** do seu projeto Supabase para criar as tabelas, políticas de RLS e funções necessárias.
