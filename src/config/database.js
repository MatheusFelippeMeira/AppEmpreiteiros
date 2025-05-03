const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { supabase } = require('./supabase');

let db;

// Verificar se estamos em ambiente de produção
const isProduction = process.env.NODE_ENV === 'production';
// Verificar se devemos forçar SQLite mesmo em produção
const forceSqlite = process.env.FORCE_SQLITE === 'true';
// Verificar se devemos usar a API do Supabase em vez de conexão direta
const useSupabaseApi = process.env.USE_SUPABASE_API === 'true' || true; // Por padrão, usar API

console.log(`Ambiente: ${isProduction ? 'produção' : 'desenvolvimento'}`);
console.log(`Modo de conexão: ${useSupabaseApi ? 'Supabase API' : 'Conexão direta ou SQLite'}`);

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
      
      // Criar tabelas essenciais se não existirem
      setupSqliteTables(sqliteDb);
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

// Função para configurar tabelas SQLite essenciais
const setupSqliteTables = async (sqliteDb) => {
  // Array com comandos SQL para criar tabelas essenciais
  const tableCreationCommands = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT DEFAULT 'usuario',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS session (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TIMESTAMP NOT NULL
    )`,
    // Adicione outras tabelas necessárias aqui
  ];

  // Executar cada comando em sequência
  for (const command of tableCreationCommands) {
    await new Promise((resolve, reject) => {
      sqliteDb.run(command, (err) => {
        if (err) {
          console.error(`Erro ao criar tabela: ${err.message}`);
          console.error(`Comando: ${command}`);
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch(err => console.error('Erro ao configurar tabela:', err.message));
  }
  
  console.log('✅ Tabelas essenciais verificadas/criadas no SQLite');
};

// Interface de banco de dados usando a API do Supabase
const setupSupabaseApi = () => {
  console.log('🔄 Configurando acesso via Supabase API...');
  
  return {
    async promiseAll(query, params = []) {
      try {
        console.log('Executando promiseAll:', query, params);
        
        // Extrair o nome da tabela da consulta SQL
        const tableMatch = query.match(/FROM\s+([^\s,]+)/i);
        const table = tableMatch ? tableMatch[1] : null;
        
        if (!table) {
          throw new Error('Não foi possível identificar a tabela na consulta: ' + query);
        }
        
        // Converter parâmetros do estilo ? para nomes de colunas e valores
        let supaQuery = supabase.from(table).select('*');
        
        // Se a consulta tiver WHERE, convertemos para filtros do Supabase
        const whereMatch = query.match(/WHERE\s+([^\s]+)\s*\=\s*\?/i);
        if (whereMatch && params.length > 0) {
          const column = whereMatch[1];
          console.log(`Buscando em ${table} onde ${column}=${params[0]}`);
          supaQuery = supaQuery.eq(column, params[0]);
        }
        
        const { data, error } = await supaQuery;
        
        if (error) {
          console.error('Erro na consulta Supabase:', error);
          throw error;
        }
        
        console.log(`Resultado da busca em ${table}:`, data?.length > 0 ? 'Encontrados ' + data.length + ' registros' : 'Nenhum registro encontrado');
        return data || [];
      } catch (error) {
        console.error(`Erro ao executar query no Supabase (promiseAll):`, error.message);
        console.error(`Query original: ${query}`);
        console.error(`Params: ${JSON.stringify(params)}`);
        throw error;
      }
    },
    
    async promiseGet(query, params = []) {
      try {
        console.log('Executando promiseGet:', query, params);
        
        // Para consultas diretas no users, usamos uma abordagem simplificada
        // que garante compatibilidade com o Supabase
        if (query.includes('FROM users WHERE email = ?') && params.length > 0) {
          console.log('Busca especial de usuário por email:', params[0]);
          
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', params[0])
            .limit(1);
            
          if (error) {
            console.error('Erro na consulta de usuário:', error);
            throw error;
          }
          
          console.log('Resultado da busca de usuário:', data?.length > 0 ? 'Usuário encontrado' : 'Usuário NÃO encontrado');
          
          // Retornar o primeiro resultado ou null
          return data && data.length > 0 ? data[0] : null;
        }
        
        // Para outras consultas, usamos a implementação padrão
        const results = await this.promiseAll(query, params);
        console.log(`Resultado genérico promiseGet:`, results?.length > 0 ? 'Encontrado' : 'Não encontrado');
        return results && results.length > 0 ? results[0] : null;
      } catch (error) {
        console.error(`Erro ao executar query no Supabase (promiseGet):`, error.message);
        console.error(`Query original: ${query}`);
        console.error(`Params: ${JSON.stringify(params)}`);
        throw error;
      }
    },
    
    async promiseRun(query, params = []) {
      try {
        // Extrair o tipo de operação (INSERT, UPDATE, DELETE)
        const operationType = query.trim().substring(0, 6).toUpperCase();
        
        // Extrair o nome da tabela
        let tableMatch;
        if (operationType === 'INSERT') {
          tableMatch = query.match(/INTO\s+([^\s(]+)/i);
        } else if (operationType === 'UPDATE') {
          tableMatch = query.match(/UPDATE\s+([^\s]+)/i);
        } else if (operationType === 'DELETE') {
          tableMatch = query.match(/FROM\s+([^\s]+)/i);
        }
        
        const table = tableMatch ? tableMatch[1] : null;
        
        if (!table) {
          throw new Error('Não foi possível identificar a tabela na consulta: ' + query);
        }
        
        let result;
        
        if (operationType === 'INSERT') {
          // Para INSERT, precisamos extrair as colunas e valores
          // Este é um exemplo simplificado - consultas mais complexas precisariam de um parser SQL
          const data = {}; // Objeto para armazenar os pares coluna-valor
          
          // Extrair colunas da query
          const columnsMatch = query.match(/\(([^)]+)\)/);
          if (columnsMatch) {
            const columns = columnsMatch[1].split(',').map(col => col.trim());
            
            // Associar cada coluna ao valor correspondente em params
            columns.forEach((col, index) => {
              if (index < params.length) {
                data[col] = params[index];
              }
            });
            
            const { data: insertedData, error } = await supabase
              .from(table)
              .insert(data)
              .select();
              
            if (error) throw error;
            
            result = { 
              changes: insertedData ? insertedData.length : 0, 
              lastID: insertedData && insertedData[0] ? insertedData[0].id : null 
            };
          } else {
            throw new Error('Formato de INSERT não suportado: ' + query);
          }
        } else if (operationType === 'UPDATE') {
          // Para UPDATE, precisamos extrair os valores a serem atualizados e a condição
          // Este é um exemplo simplificado
          const data = {};
          
          // Extrair colunas a serem atualizadas
          const setMatch = query.match(/SET\s+([^WHERE]+)/i);
          if (setMatch) {
            const setParts = setMatch[1].split(',');
            let paramIndex = 0;
            
            setParts.forEach(part => {
              const keyValue = part.trim().split('=');
              if (keyValue.length === 2) {
                const key = keyValue[0].trim();
                // Se o valor for um placeholder '?'
                if (keyValue[1].trim() === '?') {
                  data[key] = params[paramIndex++];
                }
              }
            });
            
            // Extrair condição WHERE
            const whereMatch = query.match(/WHERE\s+([^\s]+)\s*=\s*\?/i);
            if (whereMatch && paramIndex < params.length) {
              const column = whereMatch[1];
              const value = params[paramIndex];
              
              const { data: updatedData, error } = await supabase
                .from(table)
                .update(data)
                .eq(column, value)
                .select();
                
              if (error) throw error;
              
              result = { changes: updatedData ? updatedData.length : 0 };
            } else {
              throw new Error('Condição WHERE não suportada ou faltando: ' + query);
            }
          }
        } else if (operationType === 'DELETE') {
          // Para DELETE, precisamos extrair a condição
          const whereMatch = query.match(/WHERE\s+([^\s]+)\s*=\s*\?/i);
          
          if (whereMatch && params.length > 0) {
            const column = whereMatch[1];
            const value = params[0];
            
            const { data: deletedData, error } = await supabase
              .from(table)
              .delete()
              .eq(column, value)
              .select();
              
            if (error) throw error;
            
            result = { changes: deletedData ? deletedData.length : 0 };
          } else {
            throw new Error('Condição WHERE não suportada ou faltando para DELETE: ' + query);
          }
        } else {
          throw new Error('Operação não suportada: ' + operationType);
        }
        
        return result;
      } catch (error) {
        console.error(`Erro ao executar query no Supabase (promiseRun):`, error.message);
        console.error(`Query: ${query}`);
        console.error(`Params: ${JSON.stringify(params)}`);
        throw error;
      }
    },
    
    // Função close é um no-op para a API Supabase
    close: () => console.log('Conexão com Supabase API fechada (ação virtual)')
  };
};

// Decidir qual implementação de banco de dados usar
// Para o servidor Render, vamos forçar o uso do Supabase para autenticação
if (isProduction || process.env.RENDER || useSupabaseApi) {
  try {
    // Usar a API do Supabase
    console.log('Usando Supabase API para acesso ao banco de dados');
    db = setupSupabaseApi();
  } catch (error) {
    console.error('❌ Erro ao configurar cliente da API Supabase:', error.message);
    console.error('⚠️ Usando SQLite como fallback');
    
    const dbPath = path.join(__dirname, '../../data_prod.db');
    db = setupSQLite(dbPath);
  }
} else {
  // Ambiente de desenvolvimento local sem Supabase
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH 
    : path.join(__dirname, '../../data.db');
  
  console.log('Usando SQLite para desenvolvimento local sem Supabase');
  db = setupSQLite(dbPath);
}

// Fechar a conexão quando o processo terminar
process.on('SIGINT', () => {
  if (db && typeof db.close === 'function') {
    db.close((err) => {
      if (err) {
        console.error('Erro ao fechar o banco de dados:', err);
      } else {
        console.log('Conexão com o banco de dados fechada');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = db;