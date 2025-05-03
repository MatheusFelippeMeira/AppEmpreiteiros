/**
 * Script de diagnóstico para conexão com banco de dados
 * 
 * Este script verifica:
 * - Variáveis de ambiente
 * - Conectividade com PostgreSQL
 * - Conectividade com SQLite
 * 
 * Use para diagnosticar problemas de conexão no Render:
 * node db-diagnostics.js
 */

const { Pool } = require('pg');
const dns = require('dns');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log('🔍 INICIANDO DIAGNÓSTICO DE BANCO DE DADOS');
console.log('=========================================');

// Checar variáveis de ambiente
console.log('📋 VARIÁVEIS DE AMBIENTE:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
console.log(`- PORT: ${process.env.PORT || 'não definido'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '***definido (ocultado)***' : 'não definido 🔴'}`);
console.log(`- SESSION_SECRET: ${process.env.SESSION_SECRET ? '***definido (ocultado)***' : 'não definido 🟡'}`);
console.log(`- FORCE_SQLITE: ${process.env.FORCE_SQLITE || 'não definido'}`);
console.log('');

// Analisar a URL do banco de dados
if (process.env.DATABASE_URL) {
  console.log('🔄 ANÁLISE DA URL DO BANCO:');
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`- Protocolo: ${url.protocol}`);
    console.log(`- Host: ${url.hostname}`);
    console.log(`- Porta: ${url.port || 'padrão'}`);
    console.log(`- Caminho: ${url.pathname}`);
    console.log(`- Username: ${url.username ? '***definido***' : 'não definido 🔴'}`);
    console.log(`- Password: ${url.password ? '***definido***' : 'não definido 🔴'}`);
    console.log(`- Parâmetros: ${url.search || 'nenhum'}`);

    // Fazer um DNS lookup para o hostname
    dns.lookup(url.hostname, (err, address, family) => {
      console.log('');
      console.log('🌐 RESOLUÇÃO DNS:');
      if (err) {
        console.log(`- ❌ Erro ao resolver DNS: ${err.message}`);
      } else {
        console.log(`- ✅ Host ${url.hostname} resolve para ${address} (IPv${family})`);
      }
      console.log('');
      
      // Continuar com o teste de conectividade PostgreSQL
      testPostgresConnection(process.env.DATABASE_URL);
    });
  } catch (error) {
    console.log(`- ❌ Erro ao analisar URL: ${error.message}`);
    console.log('- 🔴 A URL do banco de dados parece estar em um formato inválido!');
    console.log('');
    
    // Continuar com o teste mesmo assim
    testPostgresConnection(process.env.DATABASE_URL);
  }
} else {
  console.log('⚠️ DATABASE_URL não definida, pulando análise de URL.');
  console.log('');
  testSqliteConnection();
}

// Função para testar a conexão PostgreSQL
async function testPostgresConnection(url) {
  console.log('🔌 TESTE DE CONEXÃO POSTGRESQL:');
  
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  
  try {
    console.log('- Tentando conectar...');
    const client = await pool.connect();
    
    console.log('- ✅ Conexão estabelecida com sucesso!');
    
    // Verificar versão do PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log(`- Versão do PostgreSQL: ${versionResult.rows[0].version}`);
    
    // Verificar tabelas existentes
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      console.log(`- Tabelas encontradas: ${tablesResult.rowCount}`);
      if (tablesResult.rowCount > 0) {
        tablesResult.rows.forEach(row => {
          console.log(`  • ${row.table_name}`);
        });
      } else {
        console.log('  • Nenhuma tabela encontrada no schema public.');
      }
    } catch (err) {
      console.log(`- ❌ Erro ao listar tabelas: ${err.message}`);
    }
    
    client.release();
  } catch (error) {
    console.log(`- ❌ Erro na conexão: ${error.message}`);
    console.log('- 🔍 Detalhes do erro:');
    console.log(`  • Código: ${error.code || 'N/A'}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('  • O servidor recusou a conexão. Verifique:');
      console.log('    1. Se o host está correto na URL');
      console.log('    2. Se a porta está correta na URL');
      console.log('    3. Se o servidor PostgreSQL está em execução');
      console.log('    4. Se há firewall bloqueando a conexão');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('  • Tempo limite esgotado. Verifique:');
      console.log('    1. Se o endereço do host está correto');
      console.log('    2. Se há conectividade de rede com o servidor');
    } else if (error.code === 'ENOTFOUND') {
      console.log('  • Host não encontrado. Verifique:');
      console.log('    1. Se o nome do host está escrito corretamente');
      console.log('    2. Se o DNS está funcionando corretamente');
    }
  } finally {
    await pool.end();
  }

  console.log('');
  // Testar SQLite também
  testSqliteConnection();
}

// Função para testar a conexão SQLite
function testSqliteConnection() {
  console.log('🔌 TESTE DE CONEXÃO SQLITE:');
  
  const dbPath = path.join(__dirname, 'data_fallback.db');
  
  try {
    // Verificar se o diretório existe
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`- ✅ Diretório criado: ${dbDir}`);
    }
    
    // Tentar criar/abrir o banco SQLite
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.log(`- ❌ Erro ao conectar ao SQLite: ${err.message}`);
      } else {
        console.log(`- ✅ Conexão SQLite estabelecida em: ${dbPath}`);
        
        // Verificar permissões de escrita
        db.run('CREATE TABLE IF NOT EXISTS diagnostics_test (id INTEGER PRIMARY KEY, test TEXT)', (err) => {
          if (err) {
            console.log(`- ❌ Erro ao criar tabela de teste: ${err.message}`);
          } else {
            console.log('- ✅ SQLite tem permissões de escrita (tabela de teste criada)');
            
            // Inserir dado de teste
            db.run('INSERT INTO diagnostics_test (test) VALUES (?)', ['test_' + Date.now()], function(err) {
              if (err) {
                console.log(`- ❌ Erro ao inserir dados: ${err.message}`);
              } else {
                console.log(`- ✅ Dado de teste inserido com ID: ${this.lastID}`);
              }
              
              // Fechamento e conclusão
              db.close();
              console.log('');
              console.log('🏁 DIAGNÓSTICO CONCLUÍDO');
              console.log('');
              
              if (process.env.DATABASE_URL) {
                console.log('📋 RECOMENDAÇÕES:');
                console.log('1. Verifique se a URL do banco de dados está correta no painel Render');
                console.log('2. Confira se o banco PostgreSQL está ativo no Render ou seu provedor');
                console.log('3. Se os problemas persistirem, considere adicionar a variável FORCE_SQLITE=true');
                console.log('   para usar SQLite como alternativa temporária');
              } else {
                console.log('⚠️ DATABASE_URL não definida! Defina esta variável no painel do Render.');
              }
            });
          }
        });
      }
    });
  } catch (error) {
    console.log(`- ❌ Erro ao configurar SQLite: ${error.message}`);
    console.log('');
    console.log('🏁 DIAGNÓSTICO CONCLUÍDO COM ERROS');
  }
}