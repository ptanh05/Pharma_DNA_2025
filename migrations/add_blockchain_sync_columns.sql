-- Migration: Add blockchain sync tracking to users table
-- Created: 2025-02-11

-- Add blockchain sync columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS blockchain_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blockchain_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS blockchain_error TEXT,
ADD COLUMN IF NOT EXISTS last_sync_attempt TIMESTAMP WITH TIME ZONE;

-- Create index for blockchain sync status
CREATE INDEX IF NOT EXISTS idx_users_blockchain_synced ON users(blockchain_synced);

-- Create index for blockchain transactions
CREATE INDEX IF NOT EXISTS idx_users_blockchain_tx ON users(blockchain_tx);

COMMENT ON COLUMN users.blockchain_synced IS 'Whether role has been synced to blockchain';
COMMENT ON COLUMN users.blockchain_tx IS 'Blockchain transaction digest for role assignment';
COMMENT ON COLUMN users.blockchain_error IS 'Last blockchain sync error message';
COMMENT ON COLUMN users.last_sync_attempt IS 'Timestamp of last blockchain sync attempt';
