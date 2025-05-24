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
    // Inicializar valores padrão
    let indicadores = {
      projetos_andamento: 0,
      receita_total: 0,
      lucro_liquido: 0,
      gastos_totais: 0,
      total_mao_obra: 0,
      total_funcionarios: 0
    };
    
    let projetosAndamento = [];
    let sugestoes = [];
    
    // Tentar buscar dados reais do banco de dados
    try {
      // Verificar se as tabelas necessárias existem
      const projetosExists = await db.tableExists('projetos');
      const gastosExists = await db.tableExists('gastos');
      const trabalhosExists = await db.tableExists('trabalhos');
      const funcionariosExists = await db.tableExists('funcionarios');
      
      if (projetosExists && gastosExists && trabalhosExists && funcionariosExists) {
        // Buscar indicadores e projetos em andamento
        const [indicadoresData, projetosAndamentoData] = await Promise.all([
          Relatorio.getDashboardIndicadores(),
          Projeto.getProjetosAndamento()
        ]);
        
        // Calcular lucro líquido (se os dados existirem)
        let lucroLiquidoCalculado = 0;
        if (indicadoresData && indicadoresData.receita_total != null && 
            indicadoresData.gastos_totais != null && indicadoresData.total_mao_obra != null) {
          lucroLiquidoCalculado = indicadoresData.receita_total - indicadoresData.gastos_totais - indicadoresData.total_mao_obra;
        }
        
        // Atualizar indicadores com dados reais
        indicadores = {
          projetos_andamento: indicadoresData?.projetos_andamento ?? 0,
          receita_total: indicadoresData?.receita_total ?? 0,
          lucro_liquido: lucroLiquidoCalculado,
          gastos_totais: indicadoresData?.gastos_totais ?? 0,
          total_mao_obra: indicadoresData?.total_mao_obra ?? 0,
          total_funcionarios: indicadoresData?.total_funcionarios ?? 0
        };
        
        // Atualizar projetos em andamento
        projetosAndamento = projetosAndamentoData || [];
        
        // Buscar sugestões (se implementado)
        try {
          // Aqui poderia vir uma chamada para um método que gera sugestões
          // Por enquanto, usamos dados de exemplo
          sugestoes = [
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
        } catch (sugestoesErr) {
          console.error('Erro ao gerar sugestões:', sugestoesErr);
          // Manter sugestões como array vazio em caso de erro
        }
      } else {
        console.warn('Uma ou mais tabelas necessárias não existem');
      }
    } catch (dataErr) {
      console.error('Erro ao buscar dados do dashboard:', dataErr);
      // Continuar com valores padrão em caso de erro
    }

    // Renderizar dashboard com os dados disponíveis
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
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Rota para análise de projeto específico
router.get('/analise/:id', isAuthenticated, async (req, res) => {
  try {
    // Verificar se o projeto existe
    const projetoId = req.params.id;
    let projeto = null;
    
    try {
      projeto = await Projeto.getById(projetoId);
      
      if (!projeto) {
        return res.status(404).render('error', {
          title: 'Projeto não encontrado',
          message: 'O projeto solicitado não foi encontrado.'
        });
      }
    } catch (projetoErr) {
      console.error('Erro ao buscar projeto:', projetoErr);
      return res.status(404).render('error', {
        title: 'Erro ao buscar projeto',
        message: 'Não foi possível encontrar o projeto solicitado.',
        details: process.env.NODE_ENV === 'development' ? projetoErr.message : undefined
      });
    }
    
    // Renderizar página de análise com dados básicos do projeto
    res.render('dashboard/analise-projeto', {
      title: `Análise - ${projeto.nome || 'Projeto'}`,
      projeto
    });
  } catch (err) {
    console.error('Erro ao carregar análise do projeto:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao carregar a análise do projeto', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;