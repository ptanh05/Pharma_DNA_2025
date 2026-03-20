-- Migration: Add missing columns to nfts and transfer_requests tables
-- Created: 2026-03-20
-- Purpose: Fix columns referenced in code but missing from table definitions

-- ============================================================
-- NFTS TABLE
-- ============================================================

-- Add quantity column for tracking batch quantities
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add receipt confirmation tracking
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS receipt_confirmed_at TIMESTAMPTZ;
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS receipt_notes TEXT;

-- Add dispensing tracking
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_dispensed_at TIMESTAMPTZ;

-- Add transfer timestamp
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

-- Add transaction digest (separate from transaction_hash)
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS tx_digest VARCHAR(255);

-- Add description (already used in code but not in migration)
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS description TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_nfts_quantity ON nfts(quantity);
CREATE INDEX IF NOT EXISTS idx_nfts_receipt_confirmed ON nfts(receipt_confirmed_at);
CREATE INDEX IF NOT EXISTS idx_nfts_last_dispensed ON nfts(last_dispensed_at);
CREATE INDEX IF NOT EXISTS idx_nfts_transferred_at ON nfts(transferred_at);
CREATE INDEX IF NOT EXISTS idx_nfts_tx_digest ON nfts(tx_digest);

-- Comments
COMMENT ON COLUMN nfts.quantity IS 'Number of units in this batch';
COMMENT ON COLUMN nfts.receipt_confirmed_at IS 'Timestamp when pharmacy confirmed receipt';
COMMENT ON COLUMN nfts.receipt_notes IS 'Notes from pharmacy during receipt confirmation';
COMMENT ON COLUMN nfts.last_dispensed_at IS 'Timestamp of last dispensing action';
COMMENT ON COLUMN nfts.transferred_at IS 'Timestamp of last transfer to next party';
COMMENT ON COLUMN nfts.tx_digest IS 'Sui transaction digest for mint operation (separate from transfer tx)';
COMMENT ON COLUMN nfts.description IS 'NFT/metadata description field';

-- ============================================================
-- TRANSFER_REQUESTS TABLE
-- ============================================================

-- Add pharmacy_address (referenced in distributor/transfer-to-pharmacy)
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS pharmacy_address VARCHAR(100);

-- Add transfer_note (referenced in distributor/transfer-to-pharmacy)
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS transfer_note TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_transfer_requests_pharmacy ON transfer_requests(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_updated ON transfer_requests(updated_at);

-- Comments
COMMENT ON COLUMN transfer_requests.pharmacy_address IS 'Target pharmacy address for transfer';
COMMENT ON COLUMN transfer_requests.transfer_note IS 'Optional note for transfer request';

-- ============================================================
-- MILESTONES TABLE
-- ============================================================

-- Add created_at index for performance (column exists but not indexed)
CREATE INDEX IF NOT EXISTS idx_milestones_created_at ON milestones(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_nft_timestamp ON milestones(nft_id, timestamp DESC);
