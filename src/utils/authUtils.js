const jwt = require('jsonwebtoken');

// Segredo para assinar tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'app_empreiteiros_jwt_secret';
// Tempo de expiração do token (1 dia em segundos)
const JWT_EXPIRES = 86400;

/**
 * Middleware para verificar autenticação do usuário
 * Utiliza tanto JWT em cookie quanto session para robustez
 */
const authMiddleware = (req, res, next) => {
  // Primeiro verifica se o usuário está autenticado via sessão
  if (req.session && req.session.user) {
    return next();
  }
  
  // Se não estiver autenticado via sessão, tenta autenticar via JWT no cookie
  try {
    const token = req.cookies.authToken;
    if (!token) {
      return res.redirect('/auth/login?error=Sessão expirada. Por favor, faça login novamente.');
    }
    
    // Verificar token JWT
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Erro ao verificar token JWT:', err.message);
        return res.redirect('/auth/login?error=Sessão inválida. Por favor, faça login novamente.');
      }
      
      // Token válido, restaurar sessão do usuário
      req.session.user = decoded.user;
      next();
    });
  } catch (err) {
    console.error('Erro ao autenticar usuário:', err.message);
    return res.redirect('/auth/login?error=Erro na autenticação. Por favor, faça login novamente.');
  }
};

/**
 * Define cookie de autenticação JWT e salva usuário na sessão
 */
const setAuthCookie = (res, req, user) => {
  // Criar token JWT
  const token = jwt.sign({ 
    user, 
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES 
  }, JWT_SECRET);
  
  // Definir cookie seguro
  res.cookie('authToken', token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: JWT_EXPIRES * 1000, // Em milissegundos
    sameSite: 'lax'
  });
  
  // Salvar na sessão também para dupla garantia
  req.session.user = user;
};

/**
 * Limpa cookie de autenticação e sessão
 */
const clearAuthCookie = (res, req) => {
  // Remover cookie
  res.clearCookie('authToken');
  
  // Destruir sessão
  if (req.session) {
    req.session.destroy();
  }
};

/**
 * Verifica se o usuário tem permissão para acessar recursos restritos
 * Níveis: admin, gerente, usuario
 */
const checkPermission = (requiredRole) => {
  return (req, res, next) => {
    const user = req.session.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const roles = {
      'admin': 3,
      'gerente': 2,
      'usuario': 1
    };
    
    const userRoleLevel = roles[user.perfil] || 0;
    const requiredRoleLevel = roles[requiredRole] || 3; // Por padrão, requer admin
    
    if (userRoleLevel >= requiredRoleLevel) {
      next();
    } else {
      res.status(403).json({ error: 'Permissão negada' });
    }
  };
};

/**
 * Verifica token JWT de API para uso em integrações
 */
const verifyApiToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de API ausente ou inválido' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.apiUser = decoded.user;
    next();
  } catch (err) {
    console.error('Erro ao verificar token API:', err.message);
    res.status(401).json({ error: 'Token de API inválido ou expirado' });
  }
};

module.exports = {
  authMiddleware,
  setAuthCookie,
  clearAuthCookie,
  checkPermission,
  verifyApiToken,
  JWT_SECRET
};