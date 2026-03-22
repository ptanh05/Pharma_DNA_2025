-- Migration: Create quality_alerts table for AI agent sensor analysis
-- This table is used by analyze_sensor_data and predict_quality tools

CREATE TABLE IF NOT EXISTS quality_alerts (
    id SERIAL PRIMARY KEY,
    nft_id INTEGER REFERENCES nfts(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    message TEXT NOT NULL,
    sensor_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255)
);

-- Index for querying alerts by NFT
CREATE INDEX IF NOT EXISTS idx_quality_alerts_nft_id ON quality_alerts(nft_id);

-- Index for querying by severity and time
CREATE INDEX IF NOT EXISTS idx_quality_alerts_severity_created ON quality_alerts(severity, created_at DESC);

-- Index for unresolved alerts
CREATE INDEX IF NOT EXISTS idx_quality_alerts_unresolved ON quality_alerts(resolved_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE quality_alerts IS 'Stores AI-generated quality alerts from sensor data analysis';
