
-- ============================================================
-- PHASE 0: Drop EventSpark schema
-- ============================================================
DROP FUNCTION IF EXISTS public.register_for_event(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.get_registration_count(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.form_fields CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.event_status CASCADE;
DROP TYPE IF EXISTS public.registration_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================
-- PHASE 1: Foundation — shared trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: user_settings (one row per user, auto-seeded)
-- ============================================================
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_generation_mode text NOT NULL DEFAULT 'MANUAL_UPLOAD_ONLY',
  api_mode_enabled boolean NOT NULL DEFAULT false,
  low_model_mode boolean NOT NULL DEFAULT true,
  redacted_logs_enabled boolean NOT NULL DEFAULT true,
  output_language_default text NOT NULL DEFAULT 'Indonesia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-seed user_settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE: runs (parent of everything)
-- ============================================================
CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_request_id text NOT NULL,
  adapter text NOT NULL,
  generation_mode text NOT NULL DEFAULT 'MANUAL_UPLOAD_ONLY',
  status text NOT NULL DEFAULT 'DRAFT_INPUT',
  marketplaces text[] NOT NULL DEFAULT '{}',
  approval_token text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs" ON public.runs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_runs_updated BEFORE UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_runs_owner_created ON public.runs(owner_id, created_at DESC);

-- ============================================================
-- Helper macro pattern: child tables scoped to a run; access via run ownership
-- ============================================================

-- seller_inputs
CREATE TABLE public.seller_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text,
  language text,
  target_market text,
  niche text,
  audience text,
  description text,
  prompt_count integer,
  tone text,
  key_anchors text[] NOT NULL DEFAULT '{}',
  license text,
  target_price text,
  original_description text,
  corrected_description text,
  confirmed_product_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_inputs TO authenticated;
GRANT ALL ON public.seller_inputs TO service_role;
ALTER TABLE public.seller_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own seller_inputs" ON public.seller_inputs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_seller_inputs_updated BEFORE UPDATE ON public.seller_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_seller_inputs_run ON public.seller_inputs(run_id);

-- marketplace_selections
CREATE TABLE public.marketplace_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_selections TO authenticated;
GRANT ALL ON public.marketplace_selections TO service_role;
ALTER TABLE public.marketplace_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mp_selections" ON public.marketplace_selections FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- architecture_outputs
CREATE TABLE public.architecture_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.architecture_outputs TO authenticated;
GRANT ALL ON public.architecture_outputs TO service_role;
ALTER TABLE public.architecture_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own arch" ON public.architecture_outputs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_arch_updated BEFORE UPDATE ON public.architecture_outputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- assumptions
CREATE TABLE public.assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  type text NOT NULL DEFAULT 'normal',
  impact text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'pending',
  correction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assumptions TO authenticated;
GRANT ALL ON public.assumptions TO service_role;
ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assumptions" ON public.assumptions FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_assumptions_updated BEFORE UPDATE ON public.assumptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- manifests
CREATE TABLE public.manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manifests TO authenticated;
GRANT ALL ON public.manifests TO service_role;
ALTER TABLE public.manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own manifests" ON public.manifests FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_manifests_updated BEFORE UPDATE ON public.manifests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- output_modules
CREATE TABLE public.output_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  validation text NOT NULL DEFAULT 'unknown',
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.output_modules TO authenticated;
GRANT ALL ON public.output_modules TO service_role;
ALTER TABLE public.output_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own modules" ON public.output_modules FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.output_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_modules_run ON public.output_modules(run_id);

-- batch_chunks
CREATE TABLE public.batch_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.output_modules(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  validation text NOT NULL DEFAULT 'unknown',
  acked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_chunks TO authenticated;
GRANT ALL ON public.batch_chunks TO service_role;
ALTER TABLE public.batch_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks" ON public.batch_chunks FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_chunks_updated BEFORE UPDATE ON public.batch_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_chunks_run ON public.batch_chunks(run_id);

-- marketplace_bundle_results
CREATE TABLE public.marketplace_bundle_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  validation text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_bundle_results TO authenticated;
GRANT ALL ON public.marketplace_bundle_results TO service_role;
ALTER TABLE public.marketplace_bundle_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mp_bundle" ON public.marketplace_bundle_results FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- qc_results
CREATE TABLE public.qc_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  blocking_errors integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_results TO authenticated;
GRANT ALL ON public.qc_results TO service_role;
ALTER TABLE public.qc_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own qc" ON public.qc_results FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_qc_updated BEFORE UPDATE ON public.qc_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- exports
CREATE TABLE public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exports TO authenticated;
GRANT ALL ON public.exports TO service_role;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exports" ON public.exports FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- redacted_logs
CREATE TABLE public.redacted_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redacted_logs TO authenticated;
GRANT ALL ON public.redacted_logs TO service_role;
ALTER TABLE public.redacted_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.redacted_logs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- description_corrections
CREATE TABLE public.description_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original text NOT NULL,
  corrected text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.description_corrections TO authenticated;
GRANT ALL ON public.description_corrections TO service_role;
ALTER TABLE public.description_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own corrections" ON public.description_corrections FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
