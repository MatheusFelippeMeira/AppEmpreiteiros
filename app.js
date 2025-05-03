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
const methodOverride = require('method-override'); // Importar method-override
const csrf = require('csurf'); // Importar proteção CSRF

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
app.use(methodOverride('_method')); // Usar method-override

// Segurança e otimização
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true
    },
  }));
  app.use(compression());
  app.use(morgan('combined'));
}

// Configuração de sessão
let sessionConfig;
const sessionSecret = process.env.SESSION_SECRET;
const forceSqliteSession = process.env.FORCE_SQLITE === 'true';

// Definir um secret padrão para produção (não ideal, mas evita erros fatais)
const defaultProductionSecret = 'app_empreiteiros_secret_production_' + new Date().getFullYear();

// Avisos sobre variáveis de ambiente
if (!isDev && !sessionSecret) {
  console.error('⚠️ AVISO: SESSION_SECRET não definida no ambiente de produção! Usando secret temporário.');
  console.error('⚠️ RECOMENDAÇÃO: Configure a variável de ambiente SESSION_SECRET no seu servidor Render.');
}

if (forceSqliteSession) {
  console.log('⚠️ AVISO: Sessão baseada em SQLite forçada por variável de ambiente FORCE_SQLITE=true');
}

// Função para configuração básica da sessão, sem armazenamento no banco de dados
const getBasicSessionConfig = () => ({
  secret: sessionSecret || (isDev ? 'app_empreiteiros_secret_dev' : defaultProductionSecret),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: !isDev,
    httpOnly: true,
    sameSite: !isDev ? 'lax' : false
  }
});

// Em ambiente de desenvolvimento ou quando forçado SQLite
if (isDev || forceSqliteSession) {
  sessionConfig = getBasicSessionConfig();
  console.log('Usando armazenamento de sessão em memória (ambiente de desenvolvimento ou FORCE_SQLITE=true)');
} else {
  // Em produção, tentar usar PgSession, mas com fallback
  try {
    // Verificar se a variável DATABASE_URL está definida
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não definida para sessão. Usando armazenamento em memória.');
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      // Adicionar configurações para melhorar a estabilidade da conexão
      max: 10, // máximo de conexões no pool para a sessão
      idleTimeoutMillis: 30000, // tempo máximo que uma conexão pode ficar inativa
      connectionTimeoutMillis: 5000 // tempo limite menor para sessões
    });

    // Configuração com armazenamento PostgreSQL
    sessionConfig = {
      ...getBasicSessionConfig(),
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
        errorLog: console.error // Adicionar log de erros explícito
      }),
    };

    // Teste de conexão para sessão (assíncrono)
    pool.query('SELECT NOW()')
      .then(result => {
        const timestamp = result.rows[0].now;
        console.log(`✅ Banco de dados conectado com sucesso para sessão (${timestamp})`);
      })
      .catch(err => {
        console.error('⚠️ Erro ao conectar ao banco para sessão:', err.message);
        console.error('⚠️ Usando armazenamento de sessão em memória como fallback');
        
        // Em caso de erro de conexão, reverter para sessão em memória
        sessionConfig = getBasicSessionConfig();
      });
  } catch (error) {
    console.error('❌ Erro ao configurar PgSession:', error.message);
    console.error('⚠️ Usando sessão em memória como fallback');
    
    // Usar configuração básica (memória) em caso de erro
    sessionConfig = getBasicSessionConfig();
  }
}

app.use(session(sessionConfig));
app.use(flash());

// Configuração de proteção CSRF
const csrfProtection = csrf({ cookie: false }); // Usa a sessão para armazenar o token
app.use(csrfProtection);

// Middleware para disponibilizar variáveis globais para as views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.usuario = req.session.user || null; // Adicionando variável usuario para compatibilidade
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.title = 'App Empreiteiros';
  res.locals.csrfToken = req.csrfToken(); // Disponibiliza o token CSRF para todas as views
  next();
});

// Health check melhorado para o Render
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: isDev ? 'development' : 'production',
    memory: process.memoryUsage(),
  };

  if (!isDev) {
    const healthCheckPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
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
  console.error('==================== ERRO DO SERVIDOR ====================');
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Rota: ${req.method} ${req.originalUrl}`);
  console.error(`Usuário: ${req.session?.user?.id || 'Não autenticado'}`);
  console.error(`Erro: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  
  if (err.code) console.error(`Código do erro: ${err.code}`);
  if (err.errno) console.error(`Errno: ${err.errno}`);
  if (err.syscall) console.error(`Syscall: ${err.syscall}`);
  if (err.address) console.error(`Endereço: ${err.address}`);
  if (err.port) console.error(`Porta: ${err.port}`);
  console.error('=========================================================');
  
  res.status(500).render('error', {
    title: 'Erro no servidor',
    message: isDev ? err.message : 'Ocorreu um erro no servidor. Nossa equipe foi notificada.'
  });
});

// Inicialização do servidor
if (require.main === module) {
  if (!isDev) {
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    testPool.connect()
      .then(client => {
        console.log('✅ Conexão inicial com o banco de dados estabelecida com sucesso!');
        client.release();
        testPool.end();

        app.listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo produção`);
        });
      })
      .catch(err => {
        console.error('❌ Erro CRÍTICO na conexão inicial com o banco de dados:', err.message);
        testPool.end();
        console.log('⚠️ Tentando iniciar o servidor mesmo com falha na conexão inicial com o banco...');
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo produção (AVISO: Falha na conexão inicial com DB)`);
        });
      });
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo desenvolvimento`);
    });
  }
}

module.exports = app;