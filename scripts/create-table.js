const { pool } = require('../lib/db');
const fs = require('fs');
const path = require('path');

async function createTable() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-agent-audit-logs-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const result = await pool.query(sql);
    
    console.log('Table created successfully!');
  } catch (error) {
    if (error.code === '42P07') {
      console.log('Table already exists.');
    } else {
      console.error('Error creating table:', error);
    }
  } finally {
    await pool.end();
  }
}

createTable();
