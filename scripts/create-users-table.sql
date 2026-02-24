-- Create users table for role management
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_assigned_at ON users(assigned_at);

-- Add comments
COMMENT ON TABLE users IS 'User roles and permissions management';
COMMENT ON COLUMN users.address IS 'Blockchain wallet address (Ethereum or Sui)';
COMMENT ON COLUMN users.role IS 'User role: ADMIN, MANUFACTURER, DISTRIBUTOR, PHARMACY';
COMMENT ON COLUMN users.assigned_at IS 'When the role was assigned';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
