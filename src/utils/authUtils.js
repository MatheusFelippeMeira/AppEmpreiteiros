// Middleware para verificar autenticação do usuário
// Versão simplificada sem JWT para evitar dependências extras
const authMiddleware = (req, res, next) => {
  // Verifica se o usuário está autenticado via sessão
  if (req.session && req.session.user) {
    return next();
  }
  
  // Se não estiver autenticado, redireciona para login
  return res.redirect('/auth/login?error=Sessão expirada. Por favor, faça login novamente.');
};

/**
 * Define usuário na sessão
 */
const setAuthCookie = (res, req, user) => {
  // Salvar na sessão
  req.session.user = user;
};

/**
 * Limpa sessão
 */
const clearAuthCookie = (res, req) => {
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
 * Verifica token de API para uso em integrações
 * Versão simplificada sem JWT
 */
const verifyApiToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de API ausente ou inválido' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // Verificação simplificada - em produção usar JWT ou outro método seguro
  if (token === process.env.API_TOKEN || token === 'app_empreiteiros_api_token') {
    req.apiUser = { role: 'api' };
    next();
  } else {
    res.status(401).json({ error: 'Token de API inválido' });
  }
};

module.exports = {
  authMiddleware,
  setAuthCookie,
  clearAuthCookie,
  checkPermission,
  verifyApiToken
};