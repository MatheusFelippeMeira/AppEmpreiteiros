const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
const ejsLayouts = require('express-ejs-layouts');

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
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

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
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
  };
} else {
  // Configuração para produção
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Testar conexão
    pool.query('SELECT NOW()')
      .then(() => console.log('✅ Banco de dados conectado com sucesso'))
      .catch(err => console.error('⚠️ Erro na conexão com o banco de dados:', err.message));
    
    // Mesmo que dê erro na consulta acima, tentamos configurar o store
    // Se falhar, o catch abaixo pega o erro
    sessionConfig = {
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret_production',
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        secure: process.env.NODE_ENV === 'production' && !isDev,
        httpOnly: true
      }
    };
  } catch (error) {
    // Em caso de erro na configuração, usar sessão em memória
    console.error('❌ Erro ao configurar sessão com PostgreSQL. Usando sessão em memória:', error.message);
    
    sessionConfig = {
      secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret_fallback',
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        secure: false
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
  // Configurando variáveis padrão para todos os templates
  res.locals.title = 'App Empreiteiros';
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
  console.log(`404 | Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  // Log detalhado do erro
  console.error('==================== ERRO DO SERVIDOR ====================');
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Rota: ${req.method} ${req.originalUrl}`);
  console.error(`Usuário: ${req.session?.user?.id || 'Não autenticado'}`);
  console.error(`Erro: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  
  // Tentar capturar informações adicionais do erro
  if (err.code) console.error(`Código do erro: ${err.code}`);
  if (err.errno) console.error(`Errno: ${err.errno}`);
  if (err.syscall) console.error(`Syscall: ${err.syscall}`);
  if (err.address) console.error(`Endereço: ${err.address}`);
  if (err.port) console.error(`Porta: ${err.port}`);
  console.error('=========================================================');
  
  // Renderizar página de erro para o usuário
  res.status(500).render('error', {
    title: 'Erro no servidor',
    message: isDev ? err.message : 'Ocorreu um erro no servidor. Nossa equipe foi notificada.'
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