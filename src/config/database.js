const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

// Criar e exportar a conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err);
  } else {
    console.log(`Conectado ao banco de dados SQLite em: ${dbPath}`);
  }
});

// Configurar para usar Promise em algumas operações
db.promiseAll = (query, params) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
};

db.promiseGet = (query, params) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
};

db.promiseRun = (query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

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