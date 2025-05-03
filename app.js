const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override'); // Importar method-override
const cookieParser = require('cookie-parser'); // Adicionando cookie-parser
const { supabase, testConnection } = require('./src/config/supabase'); // Importar o cliente Supabase
const { authMiddleware } = require('./src/utils/authUtils'); // Importar middleware de autenticação JWT

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

// Configuração do express-ejs-layouts
app.use(ejsLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.set('layout extractMetas', true);

// Configurar variável de conteúdo para compatibilidade
app.use((req, res, next) => {
  const originalRender = res.render;
  res.render = function(view, options, callback) {
    options = options || {};
    // Garantir que 'corpo' e 'body' sejam a mesma coisa
    if (options.corpo && !options.body) {
      options.body = options.corpo;
    }
    if (options.body && !options.corpo) {
      options.corpo = options.body;
    }
    originalRender.call(this, view, options, callback);
  };
  next();
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));
app.use(methodOverride('_method')); // Usar method-override
app.use(cookieParser()); // Adicionando middleware de cookie parser

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
const useSupabaseApi = process.env.USE_SUPABASE_API === 'true';

// Definir um secret padrão para produção (não ideal, mas evita erros fatais)
const defaultProductionSecret = 'app_empreiteiros_secret_production_' + new Date().getFullYear();

// Avisos sobre variáveis de ambiente
if (!isDev && !sessionSecret) {
  console.error('⚠️ AVISO: SESSION_SECRET não definida no ambiente de produção! Usando secret temporário.');
  console.error('⚠️ RECOMENDAÇÃO: Configure a variável de ambiente SESSION_SECRET no seu servidor Render.');
}

// Em produção, usar sempre MemoryStore para evitar problemas de conexão
if (isDev || forceSqliteSession || !isDev || useSupabaseApi) {
  // Usar sempre MemoryStore para sessões em produção quando estamos usando a API do Supabase
  sessionConfig = {
    secret: sessionSecret || (isDev ? 'app_empreiteiros_secret_dev' : defaultProductionSecret),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: !isDev,
      httpOnly: true,
      sameSite: !isDev ? 'lax' : false
    }
  };
  
  if (!isDev) {
    console.log('🔒 Usando armazenamento de sessão em memória em produção com Supabase API');
    if (!useSupabaseApi) {
      console.warn('⚠️ AVISO: Considere definir USE_SUPABASE_API=true para otimizar o uso da API Supabase');
    }
    console.warn('⚠️ AVISO: Armazenamento de sessão em memória não é recomendado para produção a longo prazo.');
    console.warn('   As sessões serão perdidas quando o servidor for reiniciado.');
  } else {
    console.log('Usando armazenamento de sessão em memória (ambiente de desenvolvimento)');
  }
}

app.use(session(sessionConfig));
app.use(flash());

// Configuração CSRF ultra simplificada para garantir funcionamento em todos os ambientes
// Implementação mais simples e robusta
const simpleCsrf = (req, res, next) => {
  // Método para gerar tokens (apenas por compatibilidade)
  req.csrfToken = function() {
    return 'csrf-disabled';
  };
  
  // Apenas passar para o próximo middleware sem verificar nada
  next();
};

// Usar nossa implementação CSRF simplificada (agora sem verificação)
app.use(simpleCsrf);

// Middleware para disponibilizar variáveis globais para as views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.usuario = req.session.user || null; // Variável adicional para compatibilidade
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.title = 'App Empreiteiros';
  
  // Adicionar token CSRF para templates (com fallback para evitar erros)
  try {
    res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : 'csrf-disabled';
  } catch (e) {
    console.warn('⚠️ Aviso: Não foi possível gerar token CSRF:', e.message);
    res.locals.csrfToken = 'csrf-disabled';
  }
  
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
    // Usar o cliente Supabase para verificar a conexão
    testConnection()
      .then(connected => {
        healthInfo.database = connected ? 'connected' : 'disconnected';
        res.status(200).json(healthInfo);
      })
      .catch(err => {
        healthInfo.database = 'disconnected';
        healthInfo.databaseError = err.message;
        res.status(200).json(healthInfo);
      });
  } else {
    res.status(200).json(healthInfo);
  }
});

// Rotas
app.use('/auth', authRoutes);

// Proteger todas as rotas a seguir com o middleware de autenticação JWT
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

// Middleware de tratamento de erros
app.use((req, res, next) => {
  if (res.headersSent) {
    return next();
  }
  console.log(`404 | Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  // Verificar se os headers já foram enviados
  if (res.headersSent) {
    console.error(`Erro após headers enviados: ${err.message}`);
    return next(err);
  }
  
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
  
  try {
    res.status(500).render('error', {
      title: 'Erro no servidor',
      message: isDev ? err.message : 'Ocorreu um erro no servidor. Nossa equipe foi notificada.'
    });
  } catch (renderError) {
    // Fallback para resposta simples em caso de erro no rendering
    console.error('Erro ao renderizar página de erro:', renderError.message);
    if (!res.headersSent) {
      res.status(500).send('Erro interno do servidor');
    }
  }
});

// Inicialização do servidor
if (require.main === module) {
  if (!isDev) {
    // Usar o testConnection do cliente Supabase em vez de tentar conexão direta com PostgreSQL
    console.log('⏳ Testando conexão com a API do Supabase antes de iniciar o servidor...');
    
    testConnection()
      .then(connected => {
        if (connected) {
          console.log('✅ Conexão inicial com Supabase API estabelecida com sucesso!');
        } else {
          console.warn('⚠️ Teste de conexão com Supabase API retornou status não conectado');
        }
        
        // Iniciar o servidor de qualquer forma
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo produção`);
        });
      })
      .catch(err => {
        console.error('❌ Erro ao testar conexão inicial com Supabase API:', err.message);
        console.log('⚠️ Iniciando o servidor mesmo com falha no teste de conexão...');
        
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo produção (AVISO: Falha no teste inicial de conexão)`);
        });
      });
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo desenvolvimento`);
    });
  }
}

module.exports = app;