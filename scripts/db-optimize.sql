-- Database Optimization Script
-- Add indexes for frequently queried columns
-- Run this script to optimize database performance

-- Indexes for nfts table
CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number);
CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer_address ON nfts(manufacturer_address);
CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status);
CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id);
CREATE INDEX IF NOT EXISTS idx_nfts_name_search ON nfts USING gin(to_tsvector('english', name));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nfts_status_created ON nfts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer_status ON nfts(manufacturer_address, status);

-- Indexes for transfer_requests table
CREATE INDEX IF NOT EXISTS idx_transfer_requests_distributor ON transfer_requests(distributor_address);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_pharmacy ON transfer_requests(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_id ON transfer_requests(nft_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_created_at ON transfer_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_updated_at ON transfer_requests(updated_at DESC);

-- Composite indexes for transfer_requests
CREATE INDEX IF NOT EXISTS idx_transfer_requests_pharmacy_status ON transfer_requests(pharmacy_address, status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_distributor_status ON transfer_requests(distributor_address, status);

-- Indexes for milestones table
CREATE INDEX IF NOT EXISTS idx_milestones_nft_id ON milestones(nft_id);
CREATE INDEX IF NOT EXISTS idx_milestones_timestamp ON milestones(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_actor_address ON milestones(actor_address);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(type);

-- Composite index for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_nft_timestamp ON milestones(nft_id, timestamp DESC);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_address_role ON users(address, role);

-- Analyze tables for query planner
ANALYZE nfts;
ANALYZE transfer_requests;
ANALYZE milestones;
ANALYZE users;

-- Comments
COMMENT ON INDEX idx_nfts_batch_number IS 'Index for batch number lookups';
COMMENT ON INDEX idx_transfer_requests_pharmacy_status IS 'Index for pharmacy pending requests queries';
COMMENT ON INDEX idx_milestones_nft_timestamp IS 'Index for NFT milestone history queries';

