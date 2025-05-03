const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Relatorio = require('../models/Relatorio'); // Importar Model Relatorio
const Projeto = require('../models/Projeto'); // Importar Model Projeto

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
    // Buscar dados reais do banco de dados
    const [indicadoresData, projetosAndamentoData] = await Promise.all([
      Relatorio.getDashboardIndicadores(),
      Projeto.getProjetosAndamento()
    ]);

    // Calcular lucro líquido (se os dados existirem)
    let lucroLiquidoCalculado = 0;
    if (indicadoresData && indicadoresData.receita_total != null && indicadoresData.gastos_totais != null && indicadoresData.total_mao_obra != null) {
      lucroLiquidoCalculado = indicadoresData.receita_total - indicadoresData.gastos_totais - indicadoresData.total_mao_obra;
    }

    // Preparar os dados para a view
    const indicadores = {
      projetos_andamento: indicadoresData?.projetos_andamento ?? 0,
      receita_total: indicadoresData?.receita_total ?? 0,
      lucro_liquido: lucroLiquidoCalculado,
      gastos_totais: indicadoresData?.gastos_totais ?? 0,
      total_mao_obra: indicadoresData?.total_mao_obra ?? 0,
      total_funcionarios: indicadoresData?.total_funcionarios ?? 0
    };

    const projetosAndamento = projetosAndamentoData || [];

    // Sugestões geradas pelo sistema (mantendo simulado por enquanto)
    const sugestoes = [
      {
        tipo: 'alerta',
        titulo: 'Projeto atrasado',
        mensagem: 'O projeto "Reforma Apto 302" está 7 dias atrasado em relação ao prazo previsto.' // Exemplo
      },
      {
        tipo: 'info',
        titulo: 'Funcionário destaque',
        mensagem: 'O funcionário João Silva teve a maior produtividade este mês.' // Exemplo
      },
      {
        tipo: 'aviso',
        titulo: 'Gastos acima do orçado',
        mensagem: 'O projeto "Construção Comércial ABC" está com gastos 15% acima do orçado.' // Exemplo
      }
    ];

    // Renderizar dashboard com dados reais
    res.render('dashboard/index', {
      title: 'Dashboard',
      indicadores,
      sugestoes,
      projetosAndamento
    });
  } catch (err) {
    console.error('Erro ao carregar Dashboard:', err);
    res.status(500).render('error', {
      title: 'Erro no Dashboard',
      message: 'Não foi possível carregar os dados do Dashboard. Tente novamente mais tarde.',
      // Não passar o erro completo em produção
      error: process.env.NODE_ENV === 'development' ? err : null
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