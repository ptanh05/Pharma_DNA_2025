-- Performance indexes for PharmaDNA Saga 2025
-- Run this migration to add indexes for better query performance

-- NFT table indexes
CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address);
CREATE INDEX IF NOT EXISTS idx_nfts_distributor ON nfts(distributor_address);
CREATE INDEX IF NOT EXISTS idx_nfts_pharmacy ON nfts(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status);
CREATE INDEX IF NOT EXISTS idx_nfts_batch ON nfts(batch_number);
CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfts_updated_at ON nfts(updated_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nfts_distributor_status ON nfts(distributor_address, status);
CREATE INDEX IF NOT EXISTS idx_nfts_pharmacy_status ON nfts(pharmacy_address, status);
CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer_status ON nfts(manufacturer_address, status);

-- Transfer requests indexes (supplementing existing ones)
CREATE INDEX IF NOT EXISTS idx_transfer_requests_created_at ON transfer_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_updated_at ON transfer_requests(updated_at DESC);

-- Dispensing records indexes
CREATE INDEX IF NOT EXISTS idx_dispensing_records_nft_id ON dispensing_records(nft_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_records_pharmacy ON dispensing_records(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_dispensing_records_created_at ON dispensing_records(created_at DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

COMMENT ON INDEX idx_nfts_manufacturer IS 'Index for manufacturer queries';
COMMENT ON INDEX idx_nfts_distributor IS 'Index for distributor queries';
COMMENT ON INDEX idx_nfts_pharmacy IS 'Index for pharmacy queries';
COMMENT ON INDEX idx_nfts_status IS 'Index for status filtering';
COMMENT ON INDEX idx_nfts_batch IS 'Index for batch number lookups';
COMMENT ON INDEX idx_nfts_created_at IS 'Index for sorting by creation date';
COMMENT ON INDEX idx_nfts_updated_at IS 'Index for sorting by update date';
