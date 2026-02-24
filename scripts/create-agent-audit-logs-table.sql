-- Create agent_audit_logs table
CREATE TABLE IF NOT EXISTS agent_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    agent_id VARCHAR(255),
    tool VARCHAR(255),
    action TEXT,
    request_data JSONB,
    response_data JSONB,
    result VARCHAR(50) CHECK (result IN ('success', 'failure', 'pending')),
    error TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_agent_id ON agent_audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_tool ON agent_audit_logs(tool);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_result ON agent_audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_error ON agent_audit_logs(error);

-- Add comments
COMMENT ON TABLE agent_audit_logs IS 'Audit logs for AI agent actions';
COMMENT ON COLUMN agent_audit_logs.user_id IS 'User ID who triggered the action';
COMMENT ON COLUMN agent_audit_logs.agent_id IS 'Agent ID performing the action';
COMMENT ON COLUMN agent_audit_logs.tool IS 'Name of the tool being used';
COMMENT ON COLUMN agent_audit_logs.action IS 'Description of the action performed';
COMMENT ON COLUMN agent_audit_logs.request_data IS 'JSON data of the request';
COMMENT ON COLUMN agent_audit_logs.response_data IS 'JSON data of the response';
COMMENT ON COLUMN agent_audit_logs.result IS 'Result status: success, failure, pending';
COMMENT ON COLUMN agent_audit_logs.error IS 'Error message if failure';
COMMENT ON COLUMN agent_audit_logs.timestamp IS 'When the action was performed';
COMMENT ON COLUMN agent_audit_logs.updated_at IS 'Last update timestamp';
