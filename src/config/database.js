const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let db;

// Verificar se estamos em ambiente de produção de forma mais robusta
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;
// Verificar se devemos forçar SQLite mesmo em produção (útil para debugging)
const forceSqlite = process.env.FORCE_SQLITE === 'true';

console.log(`Ambiente: ${isProduction ? 'produção' : 'desenvolvimento'}`);
if (forceSqlite) {
  console.log('⚠️ AVISO: SQLite está sendo forçado mesmo em produção (FORCE_SQLITE=true)');
}

// Função auxiliar para criar conexão SQLite
const setupSQLite = (dbPath) => {
  // Garantir que o diretório para o banco de dados exista
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Diretório criado para o banco de dados: ${dbDir}`);
  }
  
  console.log(`🔄 Usando SQLite em: ${dbPath}`);
  
  // Criar a conexão com o banco de dados SQLite
  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Erro ao conectar ao banco de dados SQLite:', err);
    } else {
      console.log(`✅ Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
  });

  // Configurar para usar Promise em algumas operações
  return {
    promiseAll: (query, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(query, params, (err, rows) => {
          if (err) {
            console.error(`Erro em SQLite promiseAll: ${err.message}`);
            console.error(`Query: ${query}`);
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
            console.error(`Erro em SQLite promiseGet: ${err.message}`);
            console.error(`Query: ${query}`);
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
            console.error(`Erro em SQLite promiseRun: ${err.message}`);
            console.error(`Query: ${query}`);
            return reject(err);
          }
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },

    close: (callback) => sqliteDb.close(callback)
  };
};

// Se estamos em produção E não estamos forçando SQLite
if (isProduction && !forceSqlite) {
  try {
    // Verificar disponibilidade da URL do banco de dados em produção
    if (!process.env.DATABASE_URL) {
      console.error('⚠️ ERRO CRÍTICO: Variável DATABASE_URL não definida, mas aplicação está em produção!');
      throw new Error('DATABASE_URL não definida');
    }

    // Configuração para PostgreSQL em produção
    const connectionString = process.env.DATABASE_URL;
    console.log(`Usando DATABASE_URL: ${connectionString ? 'definido (não exibido por segurança)' : 'não definido'}`);
    
    // Tentar extrair host e porta da URL para diagnóstico
    try {
      const urlParts = new URL(connectionString);
      console.log(`Tentando conectar a: ${urlParts.hostname}:${urlParts.port || 'default'}`);
    } catch (e) {
      console.error('⚠️ Não foi possível analisar a URL de conexão. Formato incorreto?');
    }
    
    const pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      // Adicionar configurações para melhorar a estabilidade da conexão
      max: 20, // máximo de conexões no pool
      idleTimeoutMillis: 30000, // tempo máximo que uma conexão pode ficar inativa (30 segundos)
      connectionTimeoutMillis: 10000, // tempo limite para tentativas de conexão (10 segundos)
    });

    // Testar a conexão com PostgreSQL imediatamente
    const testConnection = async () => {
      try {
        const client = await pool.connect();
        console.log('✅ Conectado ao PostgreSQL com sucesso!');
        console.log(`   Host: ${client.connectionParameters.host}`);
        console.log(`   Database: ${client.connectionParameters.database}`);
        console.log(`   User: ${client.connectionParameters.user}`);
        client.release();
        return true;
      } catch (error) {
        console.error('❌ Erro ao conectar ao PostgreSQL:');
        console.error(`   Mensagem: ${error.message}`);
        console.error(`   Código: ${error.code}`);
        
        if (error.code === 'ECONNREFUSED') {
          console.error(`   A conexão foi recusada. Verificando se o Postgres está acessível...`);
        }
        
        throw error;
      }
    };
    
    // Criar uma interface compatível com o resto do código usando PostgreSQL
    db = {
      async promiseAll(query, params) {
        try {
          const result = await pool.query(query, params);
          return result.rows;
        } catch (error) {
          console.error(`Erro ao executar query (promiseAll): ${error.message}`);
          console.error(`Query: ${query}`);
          console.error(`Params: ${JSON.stringify(params)}`);
          throw error;
        }
      },
      async promiseGet(query, params) {
        try {
          const result = await pool.query(query, params);
          return result.rows[0];
        } catch (error) {
          console.error(`Erro ao executar query (promiseGet): ${error.message}`);
          console.error(`Query: ${query}`);
          console.error(`Params: ${JSON.stringify(params)}`);
          throw error;
        }
      },
      async promiseRun(query, params) {
        try {
          const result = await pool.query(query, params);
          return { changes: result.rowCount, lastID: null };
        } catch (error) {
          console.error(`Erro ao executar query (promiseRun): ${error.message}`);
          console.error(`Query: ${query}`);
          console.error(`Params: ${JSON.stringify(params)}`);
          throw error;
        }
      },
      close: () => pool.end()
    };
    
    // Tentar testar a conexão inicialmente
    testConnection().catch(err => {
      console.error('Erro no teste de conexão inicial ao PostgreSQL:', err);
      console.error('⚠️ Alternando para SQLite como fallback...');
      
      // Se falhar, usar SQLite como fallback
      const dbPath = path.join(__dirname, '../../data_prod.db');
      db = setupSQLite(dbPath);
    });
  } catch (error) {
    // Em caso de qualquer erro na configuração do PostgreSQL, usar SQLite como fallback
    console.error('❌ Erro na configuração do PostgreSQL:', error.message);
    console.error('⚠️ Usando SQLite como fallback em produção');
    
    const dbPath = path.join(__dirname, '../../data_prod.db');
    db = setupSQLite(dbPath);
  }
} else {
  // Ambiente de desenvolvimento OU forçando SQLite
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH 
    : path.join(__dirname, '../../data.db');
  
  db = setupSQLite(dbPath);
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