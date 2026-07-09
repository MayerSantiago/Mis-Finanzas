-- ============================================================
-- MIS FINANZAS — Migración inicial
-- Ejecutar completo en: Supabase Dashboard → SQL Editor
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. FUNCIÓN GENÉRICA updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL DEFAULT '',
  moneda     TEXT NOT NULL DEFAULT 'COP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 3. TABLA: accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('efectivo','debito','credito','ahorros','otro')),
  banco           TEXT,
  ultimos_digitos TEXT,
  cupo            NUMERIC(18,2),
  saldo_actual    NUMERIC(18,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 4. TABLA: categories
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  color             TEXT NOT NULL DEFAULT '#6366f1',
  icono             TEXT,
  es_predeterminada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_tipo ON public.categories(user_id, tipo);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 5. TABLA: transactions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto           NUMERIC(18,2) NOT NULL CHECK (monto > 0),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id     UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  establecimiento TEXT,
  rubro           TEXT,
  detalle         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_fecha     ON public.transactions(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tipo      ON public.transactions(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_transactions_category  ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account   ON public.transactions(account_id);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 6. TABLA: debts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  monto_original NUMERIC(18,2) NOT NULL CHECK (monto_original > 0),
  saldo_actual   NUMERIC(18,2) NOT NULL,
  tasa_interes   NUMERIC(8,4) NOT NULL DEFAULT 0,
  tasa_tipo      TEXT NOT NULL DEFAULT 'EA' CHECK (tasa_tipo IN ('EA','EM','NM')),
  fecha_inicio   DATE NOT NULL DEFAULT CURRENT_DATE,
  cuota_estimada NUMERIC(18,2),
  plazo_meses    INTEGER,
  estado         TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','pagada')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_estado  ON public.debts(user_id, estado);

CREATE TRIGGER trg_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 7. TABLA: debt_payments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id    UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  monto      NUMERIC(18,2) NOT NULL CHECK (monto > 0),
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo       TEXT NOT NULL DEFAULT 'mixto' CHECK (tipo IN ('capital','interes','mixto')),
  nota       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON public.debt_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments(debt_id);

CREATE TRIGGER trg_debt_payments_updated_at
  BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 8. TRIGGERS DE NEGOCIO: saldo de deuda al registrar/eliminar abono
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_debt_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
  nuevo_saldo NUMERIC;
BEGIN
  SELECT GREATEST(0, saldo_actual - NEW.monto)
  INTO nuevo_saldo
  FROM public.debts
  WHERE id = NEW.debt_id;

  UPDATE public.debts
  SET saldo_actual = nuevo_saldo,
      estado       = CASE WHEN nuevo_saldo = 0 THEN 'pagada' ELSE 'activa' END,
      updated_at   = NOW()
  WHERE id = NEW.debt_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_debt_payment_insert
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION handle_debt_payment_insert();

-- Al eliminar un abono, restaurar el saldo
CREATE OR REPLACE FUNCTION handle_debt_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.debts
  SET saldo_actual = LEAST(monto_original, saldo_actual + OLD.monto),
      estado       = 'activa',
      updated_at   = NOW()
  WHERE id = OLD.debt_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_debt_payment_delete
  AFTER DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION handle_debt_payment_delete();


-- ─────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: ver el propio"        ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: actualizar el propio" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- accounts
CREATE POLICY "accounts: select" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts: insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- categories
CREATE POLICY "categories: select" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: insert" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update" ON public.categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: delete" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "transactions: select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions: insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- debts
CREATE POLICY "debts: select" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debts: insert" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts: update" ON public.debts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts: delete" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- debt_payments
CREATE POLICY "debt_payments: select" ON public.debt_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debt_payments: insert" ON public.debt_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debt_payments: update" ON public.debt_payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debt_payments: delete" ON public.debt_payments FOR DELETE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 10. CATEGORÍAS POR DEFECTO + TRIGGER AL CREAR USUARIO
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION insert_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.categories (user_id, nombre, tipo, color, icono, es_predeterminada) VALUES
    -- EGRESOS
    (p_user_id, 'Alimentación',      'egreso',  '#ef4444', '🍽️',  TRUE),
    (p_user_id, 'Hogar',             'egreso',  '#f97316', '🏠',  TRUE),
    (p_user_id, 'Arriendo',          'egreso',  '#eab308', '🔑',  TRUE),
    (p_user_id, 'Transporte',        'egreso',  '#3b82f6', '🚌',  TRUE),
    (p_user_id, 'Salud',             'egreso',  '#22c55e', '💊',  TRUE),
    (p_user_id, 'Entretenimiento',   'egreso',  '#a855f7', '🎬',  TRUE),
    (p_user_id, 'Ropa y calzado',    'egreso',  '#ec4899', '👗',  TRUE),
    (p_user_id, 'Educación',         'egreso',  '#06b6d4', '📚',  TRUE),
    (p_user_id, 'Servicios públicos','egreso',  '#64748b', '💡',  TRUE),
    (p_user_id, 'Deudas / cuotas',   'egreso',  '#dc2626', '💳',  TRUE),
    (p_user_id, 'Otros gastos',      'egreso',  '#6b7280', '📦',  TRUE),
    -- INGRESOS
    (p_user_id, 'Salario',           'ingreso', '#22c55e', '💼',  TRUE),
    (p_user_id, 'Freelance',         'ingreso', '#10b981', '💻',  TRUE),
    (p_user_id, 'Rendimientos',      'ingreso', '#059669', '📈',  TRUE),
    (p_user_id, 'Arriendo recibido', 'ingreso', '#0d9488', '🏘️', TRUE),
    (p_user_id, 'Bonificaciones',    'ingreso', '#0891b2', '🎁',  TRUE),
    (p_user_id, 'Otros ingresos',    'ingreso', '#6b7280', '💰',  TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', ''));

  PERFORM insert_default_categories(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
