const { pool } = require('../lib/db');

async function checkTable() {
  try {
    // Check if agent_audit_logs table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agent_audit_logs'
      )
    `);
    
    const tableExists = result.rows[0].exists;
    console.log('Table exists:', tableExists);
    
    if (!tableExists) {
      console.log('Creating table...');
      // Create the table
      await pool.query(`
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
      `);
      console.log('Table created successfully!');
      
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_agent_id ON agent_audit_logs(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_tool ON agent_audit_logs(tool);
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_result ON agent_audit_logs(result);
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_error ON agent_audit_logs(error);
      `);
      console.log('Indexes created successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTable();
