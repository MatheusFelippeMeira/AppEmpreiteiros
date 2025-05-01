const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let db;

// Verificar se estamos em ambiente de produção
if (process.env.NODE_ENV === 'production') {
  // Configuração para PostgreSQL em produção
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Conectar ao PostgreSQL
  pool.connect()
    .then(() => console.log('Conectado ao PostgreSQL'))
    .catch(err => console.error('Erro ao conectar ao PostgreSQL:', err));

  // Criar uma interface compatível com o resto do código
  db = {
    async promiseAll(query, params) {
      const result = await pool.query(query, params);
      return result.rows;
    },
    async promiseGet(query, params) {
      const result = await pool.query(query, params);
      return result.rows[0];
    },
    async promiseRun(query, params) {
      const result = await pool.query(query, params);
      return { changes: result.rowCount, lastID: null };
    },
    close: () => pool.end()
  };
} else {
  // Usar SQLite em ambiente de desenvolvimento
  // Usar o caminho do banco de dados definido nas variáveis de ambiente ou um caminho padrão
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH 
    : path.join(__dirname, '../../data.db');

  // Garantir que o diretório para o banco de dados exista
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Diretório criado para o banco de dados: ${dbDir}`);
  }

  // Criar a conexão com o banco de dados SQLite
  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados SQLite:', err);
    } else {
      console.log(`Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
  });

  // Configurar para usar Promise em algumas operações
  db = {
    promiseAll: (query, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(query, params, (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve(rows);
        });
      });
    },

    promiseGet: (query, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.get(query, params, (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve(row);
        });
      });
    },

    promiseRun: (query, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.run(query, params, function(err) {
          if (err) {
            return reject(err);
          }
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },

    close: (callback) => sqliteDb.close(callback)
  };
}

// Fechar a conexão quando o processo terminar
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar o banco de dados:', err);
    } else {
      console.log('Conexão com o banco de dados fechada');
    }
    process.exit(0);
  });
});

module.exports = db;