-- ============================================================
-- ARRAIA PAY — Schema do Banco de Dados (Supabase / PostgreSQL)
-- Execute este arquivo no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU_PROJETO/sql/new
-- ============================================================

-- ============================================================
-- TABELA: profiles
-- Uma linha por usuário autenticado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT         NOT NULL DEFAULT '',
  birth_date         DATE,
  balance            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  corns              INTEGER       NOT NULL DEFAULT 0  CHECK (corns >= 0),
  has_hat            BOOLEAN       NOT NULL DEFAULT FALSE,
  hat_equipped       BOOLEAN       NOT NULL DEFAULT FALSE,
  last_temp_c        INTEGER,
  last_weather_code  INTEGER,
  last_weather_city  TEXT,
  last_weather_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: transactions
-- Histórico de depósitos, compras e resgates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           TEXT          NOT NULL CHECK (type IN ('deposit', 'purchase', 'reward')),
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT          CHECK (payment_method IN ('pix', 'card', NULL)),
  tax            NUMERIC(12,2) NOT NULL DEFAULT 0,
  corns_earned   INTEGER       NOT NULL DEFAULT 0,
  description    TEXT          NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para buscas por usuário (muito frequentes)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions (user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Garante que cada usuário só vê e edita os próprios dados
-- ============================================================

-- Habilita RLS nas tabelas
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- POLICIES — profiles
-- Usuário autenticado pode ler somente o próprio perfil
CREATE POLICY "profiles: leitura própria" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Usuário autenticado pode atualizar somente o próprio perfil
CREATE POLICY "profiles: edição própria" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Inserção via service key do backend (não pelo cliente)
-- Obs: a inserção inicial é feita pelo backend com supabaseAdmin
CREATE POLICY "profiles: inserção via service" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- POLICIES — transactions
CREATE POLICY "transactions: leitura própria" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Inserção também via service key (processDeposit no backend)
CREATE POLICY "transactions: inserção própria" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente nos profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: cria perfil automaticamente após confirmação de e-mail
-- (opcional — o backend também cria via /api/auth/register)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    (NEW.raw_user_meta_data->>'birth_date')::DATE
  )
  ON CONFLICT (id) DO NOTHING; -- idempotente
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNÇÃO RPC: deposit_atomic
-- Processa depósito de forma atômica (transação + atualização de saldo)
-- Chamada pelo backend — bypassa RLS porque é SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.deposit_atomic(
  p_user_id        UUID,
  p_amount         NUMERIC,
  p_payment_method TEXT,
  p_tax            NUMERIC,
  p_credited       NUMERIC,
  p_corns          INTEGER,
  p_description    TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance NUMERIC;
  v_current_corns   INTEGER;
  v_new_balance     NUMERIC;
  v_new_corns       INTEGER;
  v_tx_id           UUID;
BEGIN
  -- Lê saldo atual com lock para evitar race condition
  SELECT balance, corns INTO v_current_balance, v_current_corns
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado para user_id: %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_credited;
  v_new_corns   := v_current_corns + p_corns;

  -- Insere a transação
  INSERT INTO public.transactions (
    user_id, type, amount, payment_method, tax, corns_earned, description
  ) VALUES (
    p_user_id, 'deposit', p_credited, p_payment_method, p_tax, p_corns, p_description
  ) RETURNING id INTO v_tx_id;

  -- Atualiza saldo e grãos
  UPDATE public.profiles
  SET balance = v_new_balance, corns = v_new_corns, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tx_id',       v_tx_id,
    'new_balance', v_new_balance,
    'new_corns',   v_new_corns
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANTS — permite que o backend (service key) acesse tudo
-- O papel service_role já tem acesso total; isso é documentativo
-- ============================================================
GRANT ALL ON public.profiles     TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT EXECUTE ON FUNCTION public.deposit_atomic TO service_role;
