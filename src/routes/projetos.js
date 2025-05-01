const express = require('express');
const router = express.Router();
const Projeto = require('../models/Projeto');
const Cliente = require('../models/Cliente');
const Funcionario = require('../models/Funcionario');
const multer = require('multer');
const path = require('path');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../src/public/uploads/comprovantes'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Listar todos os projetos
router.get('/', isAuthenticated, (req, res) => {
  Projeto.getAll((err, projetos) => {
    if (err) {
      console.error('Erro ao buscar projetos:', err);
      return res.status(500).render('error', { 
        title: 'Erro', 
        message: 'Erro ao buscar projetos'
      });
    }
    
    res.render('projetos/index', {
      title: 'Projetos/Obras',
      projetos
    });
  });
});

// Formulário para novo projeto
router.get('/novo', isAuthenticated, (req, res) => {
  // Buscar todos os clientes para o formulário
  Cliente.getAll((err, clientes) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      clientes = [];
    }
    
    res.render('projetos/form', {
      title: 'Novo Projeto/Obra',
      projeto: {},
      clientes
    });
  });
});

// Criar novo projeto
router.post('/', isAuthenticated, (req, res) => {
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          valor_receber, deslocamento_incluido } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    // Buscar todos os clientes novamente para o formulário
    Cliente.getAll((err, clientes) => {
      if (err) {
        console.error('Erro ao buscar clientes:', err);
        clientes = [];
      }
      
      return res.status(400).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    });
    return;
  }
  
  Projeto.create(req.body, (err, id) => {
    if (err) {
      console.error('Erro ao criar projeto:', err);
      
      // Buscar todos os clientes novamente para o formulário
      Cliente.getAll((err, clientes) => {
        if (err) {
          console.error('Erro ao buscar clientes:', err);
          clientes = [];
        }
        
        return res.status(500).render('projetos/form', {
          title: 'Novo Projeto/Obra',
          projeto: req.body,
          clientes,
          error: 'Erro ao criar projeto'
        });
      });
      return;
    }
    
    res.redirect(`/projetos/${id}`);
  });
});

// Visualizar um projeto específico
router.get('/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  
  Projeto.getById(id, (err, projeto) => {
    if (err || !projeto) {
      console.error('Erro ao buscar projeto:', err);
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar gastos do projeto
    Projeto.getGastos(id, (err, gastos) => {
      if (err) {
        console.error('Erro ao buscar gastos do projeto:', err);
        gastos = [];
      }
      
      // Buscar trabalhos do projeto
      Projeto.getTrabalhos(id, (err, trabalhos) => {
        if (err) {
          console.error('Erro ao buscar trabalhos do projeto:', err);
          trabalhos = [];
        }
        
        // Calcular lucratividade
        Projeto.calcularLucratividade(id, (err, lucratividade) => {
          if (err) {
            console.error('Erro ao calcular lucratividade:', err);
            lucratividade = {
              nome: projeto.nome,
              valor_receber: projeto.valor_receber,
              total_gastos: 0,
              custo_mao_obra: 0
            };
          }
          
          // Buscar todos os funcionários para o formulário de registro de trabalho
          Funcionario.getAll((err, funcionarios) => {
            if (err) {
              console.error('Erro ao buscar funcionários:', err);
              funcionarios = [];
            }
            
            // Agrupar gastos por categoria
            const gastosPorCategoria = {};
            gastos.forEach(gasto => {
              if (!gastosPorCategoria[gasto.categoria]) {
                gastosPorCategoria[gasto.categoria] = 0;
              }
              gastosPorCategoria[gasto.categoria] += gasto.valor;
            });
            
            res.render('projetos/detalhes', {
              title: `Projeto - ${projeto.nome}`,
              projeto,
              gastos,
              trabalhos,
              funcionarios,
              lucratividade,
              gastosPorCategoria
            });
          });
        });
      });
    });
  });
});

// Formulário para editar projeto
router.get('/:id/editar', isAuthenticated, (req, res) => {
  const id = req.params.id;
  
  Projeto.getById(id, (err, projeto) => {
    if (err || !projeto) {
      console.error('Erro ao buscar projeto:', err);
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar todos os clientes para o formulário
    Cliente.getAll((err, clientes) => {
      if (err) {
        console.error('Erro ao buscar clientes:', err);
        clientes = [];
      }
      
      res.render('projetos/form', {
        title: `Editar - ${projeto.nome}`,
        projeto,
        clientes
      });
    });
  });
});

// Atualizar projeto
router.post('/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          data_fim_real, valor_receber, deslocamento_incluido, status } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    // Buscar todos os clientes novamente para o formulário
    Cliente.getAll((err, clientes) => {
      if (err) {
        console.error('Erro ao buscar clientes:', err);
        clientes = [];
      }
      
      return res.status(400).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    });
    return;
  }
  
  Projeto.update(id, req.body, (err) => {
    if (err) {
      console.error('Erro ao atualizar projeto:', err);
      
      // Buscar todos os clientes novamente para o formulário
      Cliente.getAll((err, clientes) => {
        if (err) {
          console.error('Erro ao buscar clientes:', err);
          clientes = [];
        }
        
        return res.status(500).render('projetos/form', {
          title: 'Editar Projeto/Obra',
          projeto: { id, ...req.body },
          clientes,
          error: 'Erro ao atualizar projeto'
        });
      });
      return;
    }
    
    res.redirect(`/projetos/${id}`);
  });
});

// Excluir projeto
router.post('/:id/excluir', isAuthenticated, (req, res) => {
  const id = req.params.id;
  
  Projeto.delete(id, (err) => {
    if (err) {
      console.error('Erro ao excluir projeto:', err);
      return res.status(500).render('error', { 
        title: 'Erro', 
        message: 'Erro ao excluir projeto'
      });
    }
    
    res.redirect('/projetos');
  });
});

// Registrar gasto
router.post('/:id/gasto', isAuthenticated, upload.single('comprovante'), (req, res) => {
  const projeto_id = req.params.id;
  const { categoria, descricao, valor, data } = req.body;
  
  // Validação simples
  if (!categoria || !descricao || !valor || !data) {
    return res.status(400).json({ 
      error: 'Categoria, descrição, valor e data são obrigatórios'
    });
  }
  
  const gasto = {
    projeto_id,
    categoria,
    descricao,
    valor,
    data,
    comprovante_url: req.file ? `/uploads/comprovantes/${req.file.filename}` : null
  };
  
  Projeto.registrarGasto(gasto, (err, id) => {
    if (err) {
      console.error('Erro ao registrar gasto:', err);
      return res.status(500).json({ 
        error: 'Erro ao registrar gasto'
      });
    }
    
    res.redirect(`/projetos/${projeto_id}`);
  });
});

// Finalizar projeto
router.post('/:id/finalizar', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const { data_fim_real } = req.body;
  
  // Validação simples
  if (!data_fim_real) {
    return res.status(400).json({ 
      error: 'Data de finalização é obrigatória'
    });
  }
  
  Projeto.update(id, { data_fim_real, status: 'concluido' }, (err) => {
    if (err) {
      console.error('Erro ao finalizar projeto:', err);
      return res.status(500).json({ 
        error: 'Erro ao finalizar projeto'
      });
    }
    
    res.redirect(`/projetos/${id}`);
  });
});

module.exports = router;