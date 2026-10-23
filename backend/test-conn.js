const { Client } = require('pg');

const url = "postgresql://postgres.jxxhmerspdtfvodaxfsh:%40Du3li3n301@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function testConnection() {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log("Connected successfully to pooler on 5432!");
    const res = await client.query('SELECT current_user, version()');
    console.log(res.rows);
  } catch (err) {
    console.error("Connection error on 5432:", err);
  } finally {
    await client.end();
  }
}

testConnection();
