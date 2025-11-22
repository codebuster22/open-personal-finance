// Database schema as a string constant for bundling
export const SCHEMA_SQL = `-- Personal Finance App Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OAuth credentials table
CREATE TABLE IF NOT EXISTS oauth_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_name VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_uri VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, credential_name)
);

-- Gmail accounts table
CREATE TABLE IF NOT EXISTS gmail_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    oauth_credential_id UUID NOT NULL REFERENCES oauth_credentials(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    total_emails INTEGER DEFAULT 0,
    processed_emails INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email)
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255) NOT NULL,
    subject TEXT,
    sender_email VARCHAR(255),
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    is_subscription BOOLEAN DEFAULT false,
    subscription_confidence DECIMAL(5,4) DEFAULT 0,
    extracted_data JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gmail_account_id, gmail_message_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    service_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'USD',
    billing_cycle VARCHAR(50),
    next_billing_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    confidence_score DECIMAL(5,4) DEFAULT 0,
    user_verified BOOLEAN DEFAULT false,
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    category_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#10B981',
    icon VARCHAR(50),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Add foreign key for category
ALTER TABLE subscriptions
ADD CONSTRAINT IF NOT EXISTS fk_subscription_category
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_oauth_credentials_user ON oauth_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_user ON gmail_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_account ON emails(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (user_id, name, color, icon, is_system) VALUES
        (NEW.id, 'Entertainment', '#F59E0B', 'tv', true),
        (NEW.id, 'Software', '#3B82F6', 'code', true),
        (NEW.id, 'Cloud Services', '#8B5CF6', 'cloud', true),
        (NEW.id, 'Music', '#EC4899', 'music', true),
        (NEW.id, 'News', '#6B7280', 'newspaper', true),
        (NEW.id, 'Fitness', '#10B981', 'activity', true),
        (NEW.id, 'Productivity', '#F97316', 'briefcase', true),
        (NEW.id, 'Other', '#9CA3AF', 'folder', true);
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS create_user_default_categories ON users;
CREATE TRIGGER create_user_default_categories
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_categories();
`;
