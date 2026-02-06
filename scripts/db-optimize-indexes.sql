/**
 * Database Optimization - Indexes
 * scripts/db-optimize-indexes.sql
 */

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status);
CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number);
CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address);
CREATE INDEX IF NOT EXISTS idx_nfts_distributor ON nfts(distributor_address);
CREATE INDEX IF NOT EXISTS idx_nfts_pharmacy ON nfts(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_nfts_expiry_date ON nfts(expiry_date);

-- Create indexes for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_nft_id ON milestones(nft_id);
CREATE INDEX IF NOT EXISTS idx_milestones_timestamp ON milestones(timestamp);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(type);

-- Create indexes for transfer requests
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests_v2(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_id ON transfer_requests_v2(nft_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_expires_at ON transfer_requests_v2(expires_at);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_result ON agent_audit_logs(result);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nfts_status_expiry ON nfts(status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_milestones_nft_timestamp ON milestones(nft_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_status ON transfer_requests_v2(nft_id, status);

