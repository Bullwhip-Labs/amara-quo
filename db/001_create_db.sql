-- db/001_create_db.sql
-- Initial database schema for email processing pipeline
-- Multi-tenant SaaS model with RLS (Row Level Security) ready structure

-- Enable UUID extension for better distributed systems support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TENANT MANAGEMENT
-- ============================================

-- Tenants table - core of multi-tenancy
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    settings JSONB DEFAULT '{}', -- Flexible tenant-specific settings
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, starter, pro, enterprise
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant users association (for future auth integration)
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Will reference auth.users when Supabase auth is added
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- ============================================
-- EMAIL THREADS MANAGEMENT
-- ============================================

-- Email threads - groups related emails together
CREATE TABLE email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Thread identifiers
    external_thread_id VARCHAR(255), -- Thread ID from external system (Gmail, etc.)
    subject TEXT, -- Common subject for the thread
    
    -- Thread metadata
    participant_emails TEXT[], -- Array of all email addresses in thread
    first_email_date TIMESTAMPTZ,
    last_email_date TIMESTAMPTZ,
    email_count INTEGER DEFAULT 0,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'active', -- active, resolved, archived
    priority INTEGER DEFAULT 5, -- 1-10, inherited by emails unless overridden
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_thread_id)
);

-- ============================================
-- EMAIL PROCESSING CORE
-- ============================================

-- Email requests table - stores all incoming emails from Upstash
CREATE TABLE email_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL,
    
    -- Email identifiers from Upstash
    external_id VARCHAR(255) NOT NULL, -- The 'id' from Upstash
    external_thread_id VARCHAR(255), -- Thread ID from source system
    history_id BIGINT,
    
    -- Email metadata
    subject TEXT,
    from_email VARCHAR(500) NOT NULL,
    to_email VARCHAR(500),
    cc_emails TEXT[], -- Array of CC recipients
    bcc_emails TEXT[], -- Array of BCC recipients
    date TIMESTAMPTZ,
    snippet TEXT,
    body TEXT,
    
    -- Categorization
    topics TEXT[], -- Array of topic strings for categorization
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, archived
    priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL, -- When received in Upstash
    fetched_at TIMESTAMPTZ DEFAULT NOW(), -- When we fetched from Upstash
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for common queries
    UNIQUE(tenant_id, external_id)
);

-- Email attachments - for future use
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_request_id UUID NOT NULL REFERENCES email_requests(id) ON DELETE CASCADE,
    
    -- Attachment metadata
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(255), -- MIME type: application/pdf, image/png, etc.
    file_size_bytes BIGINT,
    
    -- Storage information
    storage_provider VARCHAR(50) DEFAULT 'r2', -- r2, s3, supabase_storage
    storage_path TEXT, -- Path in storage system
    storage_url TEXT, -- Direct URL if publicly accessible
    
    -- Processing status
    is_processed BOOLEAN DEFAULT false,
    extracted_text TEXT, -- Extracted text from PDFs/docs
    metadata JSONB DEFAULT '{}', -- Additional metadata (dimensions for images, page count for PDFs, etc.)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing logs - audit trail for email processing
CREATE TABLE processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_request_id UUID NOT NULL REFERENCES email_requests(id) ON DELETE CASCADE,
    
    -- Processing details
    status VARCHAR(50) NOT NULL, -- started, completed, failed, retrying
    processor_type VARCHAR(100) DEFAULT 'mock', -- mock, openai, anthropic, etc.
    attempt_number INTEGER DEFAULT 1,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER, -- Calculated duration in milliseconds
    
    -- Results and errors
    result JSONB, -- Flexible storage for processing results
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- Additional processing metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email responses - tracks responses sent back to senders
CREATE TABLE email_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_request_id UUID NOT NULL REFERENCES email_requests(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL,
    
    -- Response content
    response_subject TEXT,
    response_body TEXT NOT NULL,
    response_type VARCHAR(50) DEFAULT 'auto', -- auto, manual, template
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, bounced, failed
    delivery_attempts INTEGER DEFAULT 0,
    delivery_provider VARCHAR(50), -- console, resend, sendgrid, etc.
    
    -- Tracking
    provider_message_id VARCHAR(255), -- External provider's message ID
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Thread queries
CREATE INDEX idx_email_threads_tenant_status ON email_threads(tenant_id, status);
CREATE INDEX idx_email_threads_tenant_updated ON email_threads(tenant_id, updated_at DESC);

-- Tenant isolation and common queries
CREATE INDEX idx_email_requests_tenant_status ON email_requests(tenant_id, status);
CREATE INDEX idx_email_requests_tenant_created ON email_requests(tenant_id, created_at DESC);
CREATE INDEX idx_email_requests_tenant_priority ON email_requests(tenant_id, priority, created_at);
CREATE INDEX idx_email_requests_from_email ON email_requests(tenant_id, from_email);
CREATE INDEX idx_email_requests_thread ON email_requests(thread_id);
CREATE INDEX idx_email_requests_search ON email_requests USING gin(to_tsvector('english', subject || ' ' || body));

-- Topics queries using GIN for array columns
CREATE INDEX idx_email_requests_topics ON email_requests USING gin(topics);

-- Attachments queries
CREATE INDEX idx_email_attachments_request ON email_attachments(email_request_id);
CREATE INDEX idx_email_attachments_tenant ON email_attachments(tenant_id, created_at DESC);

-- Processing logs queries
CREATE INDEX idx_processing_logs_email ON processing_logs(email_request_id);
CREATE INDEX idx_processing_logs_tenant_created ON processing_logs(tenant_id, created_at DESC);
CREATE INDEX idx_processing_logs_status ON processing_logs(tenant_id, status);

-- Response tracking
CREATE INDEX idx_email_responses_email ON email_responses(email_request_id);
CREATE INDEX idx_email_responses_thread ON email_responses(thread_id);
CREATE INDEX idx_email_responses_tenant_status ON email_responses(tenant_id, delivery_status);
CREATE INDEX idx_email_responses_sent_at ON email_responses(tenant_id, sent_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES (Preparation)
-- ============================================

-- Enable RLS on all tables (to be configured with Supabase Auth later)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_requests_updated_at BEFORE UPDATE ON email_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_attachments_updated_at BEFORE UPDATE ON email_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_responses_updated_at BEFORE UPDATE ON email_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update thread statistics when emails are added
CREATE OR REPLACE FUNCTION update_thread_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update thread email count and dates
    UPDATE email_threads
    SET 
        email_count = (
            SELECT COUNT(*) 
            FROM email_requests 
            WHERE thread_id = NEW.thread_id
        ),
        last_email_date = GREATEST(
            last_email_date, 
            NEW.date
        ),
        first_email_date = LEAST(
            COALESCE(first_email_date, NEW.date), 
            NEW.date
        )
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to maintain thread statistics
CREATE TRIGGER update_thread_stats_on_email_insert
AFTER INSERT ON email_requests
FOR EACH ROW 
WHEN (NEW.thread_id IS NOT NULL)
EXECUTE FUNCTION update_thread_statistics();

-- ============================================
-- SEED DATA FOR DEVELOPMENT
-- ============================================

-- Insert a default tenant for development
INSERT INTO tenants (id, name, slug, subscription_tier, settings)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Development Tenant',
    'dev-tenant',
    'pro',
    '{"email_quota": 10000, "allow_api_access": true}'::jsonb
);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE tenants IS 'Multi-tenant organizations using the email processing system';
COMMENT ON TABLE email_threads IS 'Groups related emails into conversation threads';
COMMENT ON TABLE email_requests IS 'Core email storage from Upstash Redis with processing status';
COMMENT ON TABLE email_attachments IS 'Attachment metadata and storage references (future feature)';
COMMENT ON TABLE processing_logs IS 'Audit trail for all email processing attempts';
COMMENT ON TABLE email_responses IS 'Tracks responses sent back to original senders';

COMMENT ON COLUMN email_requests.status IS 'pending: awaiting processing, processing: currently being processed, completed: successfully processed, failed: processing failed, archived: old/inactive';
COMMENT ON COLUMN email_requests.topics IS 'Array of topic strings for categorization';
COMMENT ON COLUMN email_threads.participant_emails IS 'All unique email addresses participating in this thread';
COMMENT ON COLUMN email_attachments.content_type IS 'MIME type: application/pdf, application/msword, image/jpeg, image/png, etc.';
COMMENT ON COLUMN processing_logs.processor_type IS 'Type of processor used: mock (Phase 1), openai, anthropic, etc. (Phase 2+)';
COMMENT ON COLUMN email_responses.delivery_status IS 'Email delivery lifecycle: pending, sent, delivered, bounced, failed';