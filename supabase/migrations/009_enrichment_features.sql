-- Migration 009: Enrichment features
-- Human Handoff, Team Management, Customer Intelligence, Abandoned Cart, Feedback, Recommendations, Branding

-- 1. Human Handoff: conversation status columns
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS conversation_status TEXT NOT NULL DEFAULT 'ai'
  CHECK (conversation_status IN ('ai', 'human', 'resolved')),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(conversation_status);

-- 2. Team Management: merchant_members table
CREATE TABLE IF NOT EXISTS merchant_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_members_merchant ON merchant_members(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_members_user ON merchant_members(user_id);

ALTER TABLE merchant_members ENABLE ROW LEVEL SECURITY;

-- 3. Customer Intelligence: RFM columns on users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS rfm_score JSONB DEFAULT '{"recency":0,"frequency":0,"monetary":0}'::jsonb,
ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new'
  CHECK (segment IN ('champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'));

CREATE INDEX IF NOT EXISTS idx_users_segment ON users(merchant_id, segment);

-- 4. User Preferences (smart timing)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  optimal_send_hour INT CHECK (optimal_send_hour >= 0 AND optimal_send_hour <= 23),
  timezone TEXT DEFAULT 'Europe/Istanbul',
  avg_response_time_minutes INT,
  preferred_channel TEXT DEFAULT 'whatsapp' CHECK (preferred_channel IN ('whatsapp', 'email')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 5. Feedback / Review Requests
CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  type TEXT NOT NULL DEFAULT 'review' CHECK (type IN ('review', 'nps')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'skipped')),
  rating INT CHECK (rating >= 1 AND rating <= 10),
  review_link TEXT,
  link_clicked BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_merchant ON feedback_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_requests(user_id);

ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;

-- 6. Abandoned Carts
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  integration_id UUID REFERENCES integrations(id),
  checkout_id TEXT,
  cart_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recovery_url TEXT,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'reminder_sent', 'recovered', 'expired')),
  reminder_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_id, checkout_id)
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_merchant ON abandoned_carts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(merchant_id, status);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- 7. Product Recommendations
CREATE TABLE IF NOT EXISTS product_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  recommended_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score NUMERIC(5,4) NOT NULL DEFAULT 0,
  reason TEXT DEFAULT 'co_purchase',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_id, product_id, recommended_product_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_product ON product_recommendations(merchant_id, product_id);

ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;

-- 8. Merchant Branding (White-Label)
CREATE TABLE IF NOT EXISTS merchant_branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,
  domain TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0d9488',
  secondary_color TEXT DEFAULT '#18181b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE merchant_branding ENABLE ROW LEVEL SECURITY;

-- 9. Churn prediction scores
ALTER TABLE users
ADD COLUMN IF NOT EXISTS churn_probability NUMERIC(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS churn_scored_at TIMESTAMPTZ;
