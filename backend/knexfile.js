require('dotenv').config()

function buildConfig() {
  if (process.env.DATABASE_URL) {
    return {
      client: 'pg',
      connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      },
      migrations: {
        directory: './migrations',
      },
    }
  }

  return {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'postgres',
    },
    migrations: {
      directory: './migrations',
    },
  }
}

const config = buildConfig()

module.exports = {
  development: config,
  production: config,
}
