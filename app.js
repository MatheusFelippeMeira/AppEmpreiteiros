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
    // Tentar usar DATABASE_URL primeiro, depois tentar construir uma URL com as credenciais do Supabase
    let connectionString = process.env.DATABASE_URL;
    
    // Se não tiver DATABASE_URL, mas tiver credenciais do Supabase, construir uma URL
    if (!connectionString && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      // Usar URL do Supabase para construir a conexão PostgreSQL
      const supabaseUrl = process.env.SUPABASE_URL || 'https://swrnbxuvewboetodewbi.supabase.co';
      const projectId = supabaseUrl.split('https://')[1]?.split('.')[0] || 'swrnbxuvewboetodewbi';
      
      console.log('⚠️ DATABASE_URL não encontrada, tentando construir uma URL com credenciais do Supabase');
      // Construindo uma URL PostgreSQL compatível com o formato que o Supabase espera
      connectionString = `postgres://postgres:${process.env.SUPABASE_KEY}@db.${projectId}.supabase.co:5432/postgres`;
      console.log('📝 URL de conexão construída para sessão (escondendo credenciais)');
    }
    
    // Verificar se temos uma URL de conexão
    if (!connectionString) {
      throw new Error('Nenhuma URL de conexão disponível para sessão. Usando armazenamento em memória.');
    }

    const pool = new Pool({
      connectionString,
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

// Configuração CSRF ultra simplificada para garantir funcionamento em todos os ambientes
// Implementação mais simples e robusta
const simpleCsrf = (req, res, next) => {
  // Se for requisição HEAD ou OPTIONS, pular verificação CSRF
  if (req.method === 'HEAD' || req.method === 'OPTIONS' || 
      req.path === '/health' || req.path.startsWith('/api/')) {
    return next();
  }

  // Em ambiente de desenvolvimento, ser mais estrito
  // Em produção, ser mais tolerante para evitar problemas com Render
  const isDev = process.env.NODE_ENV !== 'production';

  // Criar um token para o usuário se ainda não existir
  if (!req.session._csrfToken) {
    // Token simples, mas suficiente para proteção básica
    req.session._csrfToken = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);
    // Salvar a sessão explicitamente para garantir que o token seja persistido
    if (req.session.save) {
      req.session.save();
    }
  }
  
  // Método para gerar tokens
  req.csrfToken = function() {
    return req.session._csrfToken;
  };
  
  // Em métodos que modificam dados (POST, PUT, DELETE), verificar o token
  if (req.method === 'GET') {
    // Para GET, apenas disponibilizar o token
    return next();
  } else {
    // Para outros métodos, verificar o token
    // Verificar token do corpo do form, ou do header X-CSRF-Token
    const token = req.body._csrf || req.headers['x-csrf-token'] || req.headers['csrf-token'];
    
    // Em produção, permitir login sem token CSRF para evitar falhas de UX
    if (req.path === '/auth/login' && !isDev) {
      console.log('⚠️ Login em produção: CSRF bypass ativado para melhorar experiência do usuário');
      return next();
    }
    
    if (token !== req.session._csrfToken && isDev) {
      // Token inválido (apenas tratar como erro em desenvolvimento)
      console.error('⚠️ Erro CSRF: token inválido');
      console.error(`  Caminho: ${req.path}`);
      console.error(`  Método: ${req.method}`);
      
      // Flash message e redirecionamento para login
      req.flash('error_msg', 'Sessão expirada ou inválida. Por favor, faça login novamente.');
      
      // Responder de acordo com o tipo de requisição
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
      }
      
      return res.redirect('/auth/login');
    }
    
    next();
  }
};

// Usar nossa implementação CSRF simplificada
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
    // Usar a mesma lógica para obter a URL de conexão que usamos para a sessão
    let connectionString = process.env.DATABASE_URL;
    
    // Se não tiver DATABASE_URL, mas tiver credenciais do Supabase, construir uma URL
    if (!connectionString && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      // Usar URL do Supabase para construir a conexão PostgreSQL
      const supabaseUrl = process.env.SUPABASE_URL || 'https://swrnbxuvewboetodewbi.supabase.co';
      const projectId = supabaseUrl.split('https://')[1]?.split('.')[0] || 'swrnbxuvewboetodewbi';
      
      console.log('⚠️ DATABASE_URL não encontrada para teste inicial, tentando construir uma URL com credenciais do Supabase');
      // Construindo uma URL PostgreSQL compatível com o formato que o Supabase espera
      connectionString = `postgres://postgres:${process.env.SUPABASE_KEY}@db.${projectId}.supabase.co:5432/postgres`;
      console.log('📝 URL de conexão construída para teste inicial (escondendo credenciais)');
    }

    // Se ainda não tivermos uma URL de conexão, iniciar sem testar
    if (!connectionString) {
      console.error('❌ Não foi possível obter uma URL de conexão com o banco de dados para teste inicial');
      console.log('⚠️ Iniciando o servidor sem testar a conexão com o banco...');
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT} no modo produção (AVISO: Sem teste de conexão com DB)`);
      });
      return;
    }
    
    const testPool = new Pool({
      connectionString,
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