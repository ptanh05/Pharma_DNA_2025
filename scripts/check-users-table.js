const { pool } = require('../lib/db.ts');

async function createUsersTable() {
  try {
    // Check if users table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    const tableExists = result.rows[0].exists;
    console.log('Table exists:', tableExists);
    
    if (!tableExists) {
      console.log('Creating users table...');
      // Create the table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            address VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) CHECK (role IN ('ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY')),
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('Users table created successfully!');
      
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_assigned_at ON users(assigned_at);
      `);
      console.log('Indexes created successfully!');
    } else {
      console.log('Users table already exists.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createUsersTable();
