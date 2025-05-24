const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Verificar se o banco de dados precisa ser inicializado
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const dbExists = fs.existsSync(dbPath);

// Se não estamos usando Supabase e o banco de dados não existe, inicializar
if (!process.env.SUPABASE_URL && !process.env.SUPABASE_KEY && !dbExists) {
  console.log('Banco de dados SQLite não encontrado. Inicializando...');
  require('./init_database');
}

// Importar configuração do banco de dados (SQLite ou Supabase)
const db = require('./src/config/database');

// Importar configuração do Supabase
const { supabase, testConnection } = require('./src/config/supabase');
const { authMiddleware } = require('./src/utils/authUtils');

// Testar conexão com Supabase se as credenciais estiverem disponíveis
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  console.log('[STARTUP] Verificando conexão com Supabase na inicialização');
  console.log('[STARTUP] SUPABASE_URL:', process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 15) + '...' : 'não configurado');
  console.log('[STARTUP] SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'configurado (primeiro 5 caracteres: ' + process.env.SUPABASE_KEY.substring(0, 5) + '...)' : 'não configurado');
  
  testConnection()
    .then(connected => {
      if (connected) {
        console.log('[STARTUP] Usando Supabase como banco de dados - CONEXÃO BEM-SUCEDIDA');
      } else {
        console.warn('[STARTUP] FALHA ao conectar com Supabase, usando SQLite como fallback');
      }
    })
    .catch(err => {
      console.error('[STARTUP] ERRO ao testar conexão com Supabase:', err.message);
      console.error('[STARTUP] Detalhes do erro:', JSON.stringify(err));
      if (err.stack) console.error('[STARTUP] Stack:', err.stack);
    });
} else {
  console.log('[STARTUP] Credenciais do Supabase não encontradas, usando SQLite');
  console.log('[STARTUP] SUPABASE_URL configurado:', !!process.env.SUPABASE_URL);
  console.log('[STARTUP] SUPABASE_KEY configurado:', !!process.env.SUPABASE_KEY);
}

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

// View engine - Configuração simplificada
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Usar EJS Layout de forma mais simples
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));
app.use(methodOverride('_method'));
app.use(cookieParser());

// Segurança e otimização
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "*", "data:"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "*"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
        connectSrc: ["'self'", "*"],
        objectSrc: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use(compression());
  app.use(morgan('combined'));
}

// Configuração de sessão simplificada
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: false, // Alterado para false para permitir HTTP e HTTPS
    sameSite: 'lax' // Adicionado para melhorar compatibilidade com navegadores móveis
  }
};
app.use(session(sessionConfig));
app.use(flash());

// CSRF simplificado
app.use((req, res, next) => {
  req.csrfToken = function() {
    return 'csrf-disabled';
  };
  next();
});

// Variáveis globais para views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.usuario = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.title = 'App Empreiteiros';
  res.locals.csrfToken = 'csrf-disabled';
  next();
});

// Middleware para verificar conexão com o banco de dados
app.use((req, res, next) => {
  // Verificar se a rota é estática ou de autenticação
  if (req.path.startsWith('/css') || 
      req.path.startsWith('/js') || 
      req.path.startsWith('/img') || 
      req.path === '/health' ||
      req.path === '/auth/login') {
    return next();
  }
  
  // Log de diagnóstico para todas as requisições
  console.log(`[DB-CHECK] Verificando conexão para rota: ${req.path}`);
  console.log(`[DB-CHECK] Configuração: SUPABASE_URL=${process.env.SUPABASE_URL ? 'configurado' : 'não configurado'}, SUPABASE_KEY=${process.env.SUPABASE_KEY ? 'configurado' : 'não configurado'}`);
  
  // Verificar conexão com o banco de dados
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    // Usando Supabase
    console.log('[DB-CHECK] Usando Supabase, testando conexão...');
    testConnection()
      .then(connected => {
        if (connected) {
          console.log('[DB-CHECK] Conexão com Supabase bem-sucedida');
          next();
        } else {
          console.error('[DB-CHECK] Falha na conexão com Supabase');
          return res.status(503).render('error', {
            title: 'Erro de Conexão',
            message: 'Não foi possível conectar ao banco de dados Supabase. Tente novamente mais tarde.',
            details: isDev ? 'Falha na conexão com Supabase' : undefined
          });
        }
      })
      .catch(err => {
        console.error('[DB-CHECK] Erro ao verificar conexão com Supabase:', err);
        console.error('[DB-CHECK] Detalhes do erro:', err.message);
        if (err.stack) console.error('[DB-CHECK] Stack:', err.stack);
        
        return res.status(503).render('error', {
          title: 'Erro de Conexão',
          message: 'Não foi possível conectar ao banco de dados. Tente novamente mais tarde.',
          details: isDev ? err.message : undefined
        });
      });
  } else {
    // Usando SQLite
    console.log('[DB-CHECK] Usando SQLite, testando conexão...');
    db.get("SELECT 1 as test", [], (err, row) => {
      if (err) {
        console.error('[DB-CHECK] Erro de conexão com o banco de dados SQLite:', err.message);
        return res.status(503).render('error', {
          title: 'Erro de Conexão',
          message: 'Não foi possível conectar ao banco de dados. Tente novamente mais tarde.',
          details: isDev ? err.message : undefined
        });
      }
      console.log('[DB-CHECK] Conexão com SQLite bem-sucedida');
      next();
    });
  }
});

// Rotas
app.use('/auth', authRoutes);
app.use('/dashboard', authMiddleware, dashboardRoutes);
app.use('/projetos', authMiddleware, projetosRoutes);
app.use('/funcionarios', authMiddleware, funcionariosRoutes);
app.use('/orcamentos', authMiddleware, orcamentosRoutes);
app.use('/relatorios', authMiddleware, relatoriosRoutes);

// Rota principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Adicionar rota de health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Tratamento de erros simplificado
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  console.error('ERRO:', err);
  res.status(500).render('error', {
    title: 'Erro interno',
    message: 'Ocorreu um erro no servidor. Por favor, tente novamente mais tarde.',
    details: isDev ? err.message : undefined
  });
});

// Inicialização do servidor
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
  });
}

module.exports = app;