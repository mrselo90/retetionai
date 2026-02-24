-- Structured product facts extracted from scraped product pages (cosmetics-focused MVP)

CREATE TABLE IF NOT EXISTS public.product_facts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  detected_language text,
  facts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'scrape_enrich',
  source_url text,
  extraction_model text,
  validation_status text NOT NULL DEFAULT 'validated', -- validated | invalid | draft
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_fact_evidence (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_fact_id uuid NOT NULL REFERENCES public.product_facts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  fact_key text NOT NULL DEFAULT 'general',
  quote text NOT NULL,
  quote_language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_facts_product_id ON public.product_facts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_facts_merchant_id ON public.product_facts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_product_facts_active ON public.product_facts(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_fact_evidence_product_fact_id ON public.product_fact_evidence(product_fact_id);
CREATE INDEX IF NOT EXISTS idx_product_fact_evidence_product_id ON public.product_fact_evidence(product_id);

-- Maintain single active fact snapshot per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_facts_one_active_per_product
ON public.product_facts(product_id)
WHERE is_active = true;

COMMENT ON TABLE public.product_facts IS 'Validated structured product facts extracted from scraped product content';
COMMENT ON TABLE public.product_fact_evidence IS 'Evidence quotes supporting structured product facts';

