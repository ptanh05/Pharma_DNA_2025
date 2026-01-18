-- Migration script to add Sui support to database
-- Adds object_id column for Sui object IDs

-- Add object_id column for Sui object IDs
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS object_id VARCHAR(66);

-- Create index for object_id
CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id);

-- Update transfer_requests to support object_id
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS object_id VARCHAR(66);

-- Create index for object_id in transfer_requests
CREATE INDEX IF NOT EXISTS idx_transfer_requests_object_id ON transfer_requests(object_id);

-- Add comments
COMMENT ON COLUMN nfts.object_id IS 'Sui object ID (for Sui blockchain)';
COMMENT ON COLUMN transfer_requests.object_id IS 'Sui object ID (for Sui blockchain)';

-- Note: token_id column remains for backward compatibility
-- Both columns can coexist - object_id for Sui, token_id for legacy support

