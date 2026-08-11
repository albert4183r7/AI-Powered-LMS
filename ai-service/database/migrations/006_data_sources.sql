-- Phase 12: Data Sources (Document Repository)
-- Allows users to upload documents once and reuse them across multiple module generations
-- Implements soft delete to ensure deleted documents are excluded from RAG

-- Data sources table (metadata)
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    owner_user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    latest_version_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by owner and status
CREATE INDEX idx_data_sources_owner_status 
ON data_sources(owner_user_id, status);

-- Index for searching by title
CREATE INDEX idx_data_sources_title 
ON data_sources USING gin(to_tsvector('english', title));

-- Data source versions table (actual files)
CREATE TABLE IF NOT EXISTS data_source_versions (
    id SERIAL PRIMARY KEY,
    data_source_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(200),
    file_hash VARCHAR(64),  -- SHA256 for deduplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_data_source FOREIGN KEY (data_source_id) 
        REFERENCES data_sources(id) ON DELETE CASCADE,
    CONSTRAINT unique_version UNIQUE (data_source_id, version_number)
);

-- Index for fetching versions by source
CREATE INDEX idx_versions_by_source 
ON data_source_versions(data_source_id, version_number DESC);

-- Add foreign key constraint for latest_version_id
ALTER TABLE data_sources 
ADD CONSTRAINT fk_latest_version 
FOREIGN KEY (latest_version_id) 
REFERENCES data_source_versions(id) 
ON DELETE SET NULL;

-- Comment on tables
COMMENT ON TABLE data_sources IS 'Persistent document repository for reuse across module generations';
COMMENT ON TABLE data_source_versions IS 'Version history of uploaded documents';
COMMENT ON COLUMN data_sources.status IS 'active = available for use, deleted = excluded from all operations including RAG';
