-- Migration: Add transaction_hash column to nfts table
-- Created: 2026-03-20
-- Purpose: Store blockchain transaction hash/digest for each NFT mint/transfer operation

-- Add transaction_hash column
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255);

-- Create index for transaction_hash lookups
CREATE INDEX IF NOT EXISTS idx_nfts_transaction_hash ON nfts(transaction_hash);

-- Add comment
COMMENT ON COLUMN nfts.transaction_hash IS 'Sui blockchain transaction digest for NFT mint/transfer';
