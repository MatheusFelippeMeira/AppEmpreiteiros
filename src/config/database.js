const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Definir caminho do banco de dados
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

// Criar diretório se não existir
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite em:', dbPath);
    
    // Habilitar chaves estrangeiras
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Registrar eventos de erro
db.on('error', (err) => {
  console.error('Erro na conexão SQLite:', err.message);
});

// Testar conexão
db.get("SELECT 1 as test", [], (err, row) => {
  if (err) {
    console.error('Erro ao testar conexão com banco de dados:', err.message);
  } else {
    console.log('Conexão com banco de dados testada com sucesso:', row);
  }
});

// Adicionar métodos de promessa para facilitar o uso com async/await
db.promiseAll = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erro em promiseAll:', err.message, 'SQL:', sql);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

db.promiseGet = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) {
        console.error('Erro em promiseGet:', err.message, 'SQL:', sql);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

db.promiseRun = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function(err) {
      if (err) {
        console.error('Erro em promiseRun:', err.message, 'SQL:', sql);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Função para verificar se uma tabela existe
db.tableExists = async function(tableName) {
  try {
    const result = await this.promiseGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!result;
  } catch (err) {
    console.error('Erro ao verificar existência da tabela:', err);
    return false;
  }
};

module.exports = db;