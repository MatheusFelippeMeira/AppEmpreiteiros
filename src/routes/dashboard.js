const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  
  return res.redirect('/auth/login');
};

// Rota principal - Dashboard
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Dados para o dashboard (valores simulados para demonstração)
    const indicadores = {
      projetos_andamento: 3,
      receita_total: 25000.00,
      lucro_liquido: 8500.00,
      gastos_totais: 12000.00,
      total_mao_obra: 4500.00,
      total_funcionarios: 8
    };
    
    // Sugestões geradas pelo sistema
    const sugestoes = [
      {
        tipo: 'alerta',
        titulo: 'Projeto atrasado',
        mensagem: 'O projeto "Reforma Apto 302" está 7 dias atrasado em relação ao prazo previsto.'
      },
      {
        tipo: 'info',
        titulo: 'Funcionário destaque',
        mensagem: 'O funcionário João Silva teve a maior produtividade este mês.'
      },
      {
        tipo: 'aviso',
        titulo: 'Gastos acima do orçado',
        mensagem: 'O projeto "Construção Comércial ABC" está com gastos 15% acima do orçado.'
      }
    ];
    
    // Lista de projetos em andamento
    const projetosAndamento = [
      {
        id: 1,
        nome: 'Reforma Apto 302',
        cliente_nome: 'Maria Oliveira',
        data_inicio: '2025-04-05',
        data_fim_prevista: '2025-05-15'
      },
      {
        id: 2,
        nome: 'Construção Comércial ABC',
        cliente_nome: 'Empresa ABC Ltda',
        data_inicio: '2025-03-10',
        data_fim_prevista: '2025-07-20'
      },
      {
        id: 3,
        nome: 'Ampliação Residencial',
        cliente_nome: 'Carlos Mendes',
        data_inicio: '2025-04-20',
        data_fim_prevista: '2025-06-01'
      }
    ];
    
    // Renderizar dashboard
    res.render('dashboard/index', { 
      title: 'Dashboard',
      indicadores,
      sugestoes, 
      projetosAndamento
    });
  } catch (err) {
    console.error('Erro ao carregar Dashboard:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao carregar o Dashboard', 
      error: err 
    });
  }
});

// Rota para análise de projeto específico
router.get('/analise/:id', isAuthenticated, async (req, res) => {
  try {
    // Aqui viria a lógica para buscar dados detalhados do projeto
    const projetoId = req.params.id;
    
    res.render('dashboard/analise-projeto', {
      title: 'Análise de Projeto',
      projetoId
    });
  } catch (err) {
    console.error('Erro ao carregar análise do projeto:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao carregar a análise do projeto', 
      error: err 
    });
  }
});

module.exports = router;