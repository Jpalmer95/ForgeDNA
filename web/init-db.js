const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set, skipping DB init');
  process.exit(0);
}

const client = new Client({ connectionString: url });

async function init() {
  await client.connect();
  console.log('Connected to PostgreSQL, creating schema...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR PRIMARY KEY,
      sess JSONB NOT NULL,
      expire TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR UNIQUE,
      first_name VARCHAR,
      last_name VARCHAR,
      profile_image_url VARCHAR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_schemas (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      version VARCHAR(50) NOT NULL DEFAULT '1.0',
      vibe_prompt TEXT NOT NULL,
      target_platforms JSONB NOT NULL DEFAULT '[]',
      goal TEXT NOT NULL,
      genre_tag VARCHAR(100),
      schema_data JSONB NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT true,
      fork_count INTEGER NOT NULL DEFAULT 0,
      forked_from_id INTEGER,
      webxr_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS schema_stars_user_schema_idx ON schema_stars (user_id, schema_id);

    CREATE TABLE IF NOT EXISTS schema_stars (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      schema_id INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schema_builds (
      id SERIAL PRIMARY KEY,
      schema_id INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      webxr_url TEXT,
      apk_url TEXT,
      build_log TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schema_versions (
      id SERIAL PRIMARY KEY,
      schema_id INTEGER NOT NULL,
      version_label VARCHAR(50) NOT NULL,
      schema_data JSONB NOT NULL,
      title VARCHAR(255),
      change_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log('DB schema initialized successfully');
  await client.end();
}

init().catch((e) => {
  console.error('DB init failed:', e.message);
  client.end();
  process.exit(1);
});
