const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');

// Importação de rotas
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const projetosRoutes = require('./src/routes/projetos');
const funcionariosRoutes = require('./src/routes/funcionarios');
const orcamentosRoutes = require('./src/routes/orcamentos');
const relatoriosRoutes = require('./src/routes/relatorios');

// Configurações
const app = express();
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

// Segurança e otimização
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(helmet());
  app.use(compression());
  app.use(morgan('combined'));
}

// Configuração de sessão
let sessionConfig;

if (isDev) {
  // Configuração para desenvolvimento
  sessionConfig = {
    secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
  };
} else {
  // Configuração para produção com PostgreSQL
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000, // 10 segundos de timeout para conexão
      max: 20, // limite máximo de conexões no pool
      idleTimeoutMillis: 30000 // tempo máximo de inatividade de uma conexão
    });
    
    // Teste rápido de conexão
    pool.query('SELECT NOW()')
      .then(() => console.log('✅ Banco de dados conectado com sucesso'))
      .catch(err => console.error('⚠️ Aviso: Erro ao testar conexão com o banco de dados:', err.message));
    
    sessionConfig = {
      store: new PgSession({
        pool,
        tableName: 'session', // Tabela para armazenar sessões
        createTableIfMissing: true // Cria a tabela se não existir
      }),
      secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret_production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        secure: true,
        httpOnly: true
      }
    };
  } catch (error) {
    console.error('❌ Erro ao configurar sessão com PostgreSQL:', error);
    console.log('⚠️ Utilizando configuração de sessão em memória como fallback...');
    
    // Configuração fallback em caso de erro
    sessionConfig = {
      secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret_fallback',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        secure: false // Desativa secure cookie em caso de fallback
      }
    };
  }
}

app.use(session(sessionConfig));
app.use(flash());

// Middleware para disponibilizar variáveis globais para as views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Health check melhorado para o Render
app.get('/health', (req, res) => {
  // Informações básicas de saúde do aplicativo
  const healthInfo = {
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: isDev ? 'development' : 'production',
    memory: process.memoryUsage(),
  };
  
  // Verificando conexão com o banco de dados
  if (!isDev) {
    const healthCheckPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000 // 5 segundos de timeout para health check
    });
    
    healthCheckPool.query('SELECT 1')
      .then(() => {
        healthInfo.database = 'connected';
        res.status(200).json(healthInfo);
        healthCheckPool.end();
      })
      .catch(err => {
        healthInfo.database = 'disconnected';
        healthInfo.databaseError = err.message;
        // Ainda retornamos 200 para evitar que o Render reinicie desnecessariamente
        res.status(200).json(healthInfo);
        healthCheckPool.end();
      });
  } else {
    res.status(200).json(healthInfo);
  }
});

// Rotas
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/projetos', projetosRoutes);
app.use('/funcionarios', funcionariosRoutes);
app.use('/orcamentos', orcamentosRoutes);
app.use('/relatorios', relatoriosRoutes);

// Rota principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Middleware de tratamento de erros
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Erro no servidor',
    message: isDev ? err.message : 'Ocorreu um erro no servidor.'
  });
});

// Inicialização do servidor
if (require.main === module) {
  // Testar a conexão com o banco de dados antes de iniciar o servidor
  if (!isDev) {
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    testPool.connect()
      .then(client => {
        console.log('Conexão com o banco de dados estabelecida com sucesso!');
        client.release();
        
        // Iniciar o servidor após confirmar conexão com o banco
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
        });
      })
      .catch(err => {
        console.error('Erro na conexão com o banco de dados:', err);
        console.log('Tentando iniciar o servidor mesmo assim...');
        
        // Tentar iniciar o servidor mesmo com erro na conexão com o banco
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'} (Aviso: problemas na conexão com o banco de dados)`);
        });
      });
  } else {
    // Em desenvolvimento, iniciar normalmente
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
    });
  }
}

module.exports = app;