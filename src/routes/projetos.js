const express = require('express');
const router = express.Router();
const Projeto = require('../models/Projeto');
const Cliente = require('../models/Cliente');
const Funcionario = require('../models/Funcionario');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadDir = path.join(__dirname, '../../src/public/uploads/comprovantes');
      cb(null, uploadDir);
    } catch (err) {
      console.error('Erro ao configurar destino de upload:', err);
      cb(new Error('Erro ao configurar destino de upload'));
    }
  },
  filename: function (req, file, cb) {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    } catch (err) {
      console.error('Erro ao gerar nome de arquivo:', err);
      cb(new Error('Erro ao gerar nome de arquivo'));
    }
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    // Verificar tipos de arquivo permitidos
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas arquivos de imagem (jpeg, jpg, png) e PDF são permitidos'));
  }
}).single('comprovante');

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.userId || req.session.user) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Listar todos os projetos
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Tentar usar o método do modelo
    try {
      const projetos = await Projeto.getAll();
      return res.render('projetos/index', {
        title: 'Projetos/Obras',
        projetos
      });
    } catch (modelErr) {
      console.error('Erro no método do modelo, tentando consulta direta:', modelErr);
      
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('projetos');
      if (!tableExists) {
        return res.render('projetos/index', {
          title: 'Projetos/Obras',
          projetos: [],
          error: 'Tabela de projetos não encontrada. Verifique a configuração do banco de dados.'
        });
      }
      
      // Fallback: consulta direta ao banco
      const projetos = await db.promiseAll(
        `SELECT p.*, c.nome as cliente_nome 
        FROM projetos p 
        LEFT JOIN clientes c ON p.cliente_id = c.id 
        ORDER BY p.data_inicio DESC`
      );
      
      return res.render('projetos/index', {
        title: 'Projetos/Obras',
        projetos: projetos || []
      });
    }
  } catch (err) {
    console.error('Erro ao buscar projetos:', err);
    
    // Em caso de erro, renderizar a página com lista vazia
    res.render('projetos/index', { 
      title: 'Projetos/Obras', 
      projetos: [],
      error: 'Erro ao buscar projetos. Tente novamente mais tarde.'
    });
  }
});

// Formulário para novo projeto
router.get('/novo', isAuthenticated, async (req, res) => {
  try {
    // Buscar todos os clientes para o formulário
    let clientes = [];
    try {
      clientes = await Cliente.getAll();
    } catch (clienteErr) {
      console.error('Erro ao buscar clientes:', clienteErr);
      // Tentar consulta direta
      try {
        const tableExists = await db.tableExists('clientes');
        if (tableExists) {
          clientes = await db.promiseAll('SELECT * FROM clientes ORDER BY nome');
        }
      } catch (dbErr) {
        console.error('Erro na consulta direta a clientes:', dbErr);
      }
    }
    
    res.render('projetos/form', {
      title: 'Novo Projeto/Obra',
      projeto: {},
      clientes
    });
  } catch (err) {
    console.error('Erro ao preparar formulário:', err);
    res.render('projetos/form', {
      title: 'Novo Projeto/Obra',
      projeto: {},
      clientes: [],
      error: 'Erro ao carregar dados de clientes'
    });
  }
});

// Criar novo projeto
router.post('/', isAuthenticated, async (req, res) => {
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          valor_receber, deslocamento_incluido } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    try {
      // Buscar todos os clientes novamente para o formulário
      let clientes = [];
      try {
        clientes = await Cliente.getAll();
      } catch (clienteErr) {
        console.error('Erro ao buscar clientes:', clienteErr);
        // Tentar consulta direta
        try {
          const tableExists = await db.tableExists('clientes');
          if (tableExists) {
            clientes = await db.promiseAll('SELECT * FROM clientes ORDER BY nome');
          }
        } catch (dbErr) {
          console.error('Erro na consulta direta a clientes:', dbErr);
        }
      }
      
      return res.status(400).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(400).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes: [],
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    }
  }
  
  try {
    const id = await Projeto.create(req.body);
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    
    try {
      // Buscar todos os clientes novamente para o formulário
      let clientes = [];
      try {
        clientes = await Cliente.getAll();
      } catch (clienteErr) {
        console.error('Erro ao buscar clientes:', clienteErr);
      }
      
      return res.status(500).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes,
        error: 'Erro ao criar projeto: ' + (err.message || 'Erro desconhecido')
      });
    } catch (clienteErr) {
      return res.status(500).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes: [],
        error: 'Erro ao criar projeto'
      });
    }
  }
});

// Visualizar um projeto específico
router.get('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Projeto.getById(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar gastos e trabalhos
    let gastos = [];
    let trabalhos = [];
    let lucratividade = { valor_receber: 0, total_gastos: 0, custo_mao_obra: 0 };
    let funcionarios = [];
    
    try {
      gastos = await Projeto.getGastos(id);
    } catch (gastosErr) {
      console.error('Erro ao buscar gastos:', gastosErr);
    }
    
    try {
      trabalhos = await Projeto.getTrabalhos(id);
    } catch (trabalhosErr) {
      console.error('Erro ao buscar trabalhos:', trabalhosErr);
    }
    
    try {
      lucratividade = await Projeto.calcularLucratividade(id);
    } catch (lucratividadeErr) {
      console.error('Erro ao calcular lucratividade:', lucratividadeErr);
    }
    
    try {
      funcionarios = await Funcionario.getAll();
    } catch (funcionariosErr) {
      console.error('Erro ao buscar funcionários:', funcionariosErr);
    }
    
    // Agrupar gastos por categoria
    const gastosPorCategoria = {};
    gastos.forEach(gasto => {
      if (!gastosPorCategoria[gasto.categoria]) {
        gastosPorCategoria[gasto.categoria] = 0;
      }
      gastosPorCategoria[gasto.categoria] += parseFloat(gasto.valor) || 0;
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
  } catch (err) {
    console.error('Erro ao buscar detalhes do projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao buscar detalhes do projeto',
      details: err.message
    });
  }
});

// Formulário para editar projeto
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Projeto.getById(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar todos os clientes para o formulário
    let clientes = [];
    try {
      clientes = await Cliente.getAll();
    } catch (clienteErr) {
      console.error('Erro ao buscar clientes:', clienteErr);
    }
    
    res.render('projetos/form', {
      title: `Editar - ${projeto.nome}`,
      projeto,
      clientes
    });
  } catch (err) {
    console.error('Erro ao buscar projeto para edição:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao buscar projeto para edição',
      details: err.message
    });
  }
});

// Atualizar projeto
router.post('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          data_fim_real, valor_receber, deslocamento_incluido, status } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    try {
      // Buscar todos os clientes novamente para o formulário
      let clientes = [];
      try {
        clientes = await Cliente.getAll();
      } catch (clienteErr) {
        console.error('Erro ao buscar clientes:', clienteErr);
      }
      
      return res.status(400).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(400).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes: [],
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    }
  }
  
  try {
    await Projeto.update(id, req.body);
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao atualizar projeto:', err);
    
    try {
      // Buscar todos os clientes novamente para o formulário
      let clientes = [];
      try {
        clientes = await Cliente.getAll();
      } catch (clienteErr) {
        console.error('Erro ao buscar clientes:', clienteErr);
      }
      
      return res.status(500).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes,
        error: 'Erro ao atualizar projeto: ' + (err.message || 'Erro desconhecido')
      });
    } catch (clienteErr) {
      return res.status(500).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes: [],
        error: 'Erro ao atualizar projeto'
      });
    }
  }
});

// Excluir projeto
router.post('/:id/excluir', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    await Projeto.delete(id);
    res.redirect('/projetos');
  } catch (err) {
    console.error('Erro ao excluir projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao excluir projeto. Verifique se não há gastos ou trabalhos associados a este projeto.',
      details: err.message
    });
  }
});

// Registrar gasto
router.post('/:id/gasto', isAuthenticated, (req, res) => {
  const projeto_id = req.params.id;
  
  // Usar o middleware de upload com tratamento de erro
  upload(req, res, async function(err) {
    if (err) {
      console.error('Erro no upload:', err);
      return res.status(400).render('error', { 
        title: 'Erro no Upload', 
        message: err.message
      });
    }
    
    const { categoria, descricao, valor, data } = req.body;
    
    // Validação simples
    if (!categoria || !descricao || !valor || !data) {
      return res.status(400).render('error', { 
        title: 'Dados Incompletos', 
        message: 'Categoria, descrição, valor e data são obrigatórios'
      });
    }
    
    try {
      const gasto = {
        projeto_id,
        categoria,
        descricao,
        valor,
        data,
        comprovante_url: req.file ? `/uploads/comprovantes/${req.file.filename}` : null
      };
      
      await Projeto.registrarGasto(gasto);
      res.redirect(`/projetos/${projeto_id}`);
    } catch (err) {
      console.error('Erro ao registrar gasto:', err);
      return res.status(500).render('error', { 
        title: 'Erro', 
        message: 'Erro ao registrar gasto',
        details: err.message
      });
    }
  });
});

// Finalizar projeto
router.post('/:id/finalizar', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { data_fim_real } = req.body;
  
  // Validação simples
  if (!data_fim_real) {
    return res.status(400).render('error', { 
      title: 'Dados Incompletos', 
      message: 'Data de finalização é obrigatória'
    });
  }
  
  try {
    await Projeto.update(id, { data_fim_real, status: 'concluido' });
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao finalizar projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao finalizar projeto',
      details: err.message
    });
  }
});

module.exports = router;