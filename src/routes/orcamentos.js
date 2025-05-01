const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const IA = require('../models/IA');
const path = require('path');
const fs = require('fs');

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Listar orçamentos
router.get('/', isAuthenticated, (req, res) => {
  const db = require('../config/database');
  
  db.all(
    `SELECT o.*, c.nome as cliente_nome 
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id = c.id
    ORDER BY o.data_criacao DESC`,
    [],
    (err, orcamentos) => {
      if (err) {
        console.error('Erro ao buscar orçamentos:', err);
        return res.status(500).render('error', {
          title: 'Erro',
          message: 'Erro ao buscar orçamentos'
        });
      }
      
      res.render('orcamentos/index', {
        title: 'Orçamentos',
        orcamentos
      });
    }
  );
});

// Formulário para novo orçamento
router.get('/novo', isAuthenticated, (req, res) => {
  // Buscar todos os clientes para o formulário
  Cliente.getAll((err, clientes) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      clientes = [];
    }
    
    res.render('orcamentos/form', {
      title: 'Novo Orçamento',
      orcamento: {},
      clientes
    });
  });
});

// Criar novo orçamento
router.post('/', isAuthenticated, (req, res) => {
  const { cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade } = req.body;
  
  // Validação simples
  if (!titulo) {
    // Buscar todos os clientes novamente para o formulário
    Cliente.getAll((err, clientes) => {
      if (err) {
        console.error('Erro ao buscar clientes:', err);
        clientes = [];
      }
      
      return res.status(400).render('orcamentos/form', {
        title: 'Novo Orçamento',
        orcamento: req.body,
        clientes,
        error: 'Título é obrigatório'
      });
    });
    return;
  }
  
  const db = require('../config/database');
  
  db.run(
    `INSERT INTO orcamentos (cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade],
    function(err) {
      if (err) {
        console.error('Erro ao criar orçamento:', err);
        
        // Buscar todos os clientes novamente para o formulário
        Cliente.getAll((err, clientes) => {
          if (err) {
            console.error('Erro ao buscar clientes:', err);
            clientes = [];
          }
          
          return res.status(500).render('orcamentos/form', {
            title: 'Novo Orçamento',
            orcamento: req.body,
            clientes,
            error: 'Erro ao criar orçamento'
          });
        });
        return;
      }
      
      res.redirect(`/orcamentos/${this.lastID}`);
    }
  );
});

// Visualizar um orçamento específico
router.get('/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const db = require('../config/database');
  
  db.get(
    `SELECT o.*, c.nome as cliente_nome, c.contato as cliente_contato
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id = c.id
    WHERE o.id = ?`,
    [id],
    (err, orcamento) => {
      if (err || !orcamento) {
        console.error('Erro ao buscar orçamento:', err);
        return res.status(404).render('error', {
          title: 'Erro',
          message: 'Orçamento não encontrado'
        });
      }
      
      res.render('orcamentos/detalhes', {
        title: `Orçamento - ${orcamento.titulo}`,
        orcamento
      });
    }
  );
});

// Formulário para editar orçamento
router.get('/:id/editar', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const db = require('../config/database');
  
  db.get(
    `SELECT * FROM orcamentos WHERE id = ?`,
    [id],
    (err, orcamento) => {
      if (err || !orcamento) {
        console.error('Erro ao buscar orçamento:', err);
        return res.status(404).render('error', {
          title: 'Erro',
          message: 'Orçamento não encontrado'
        });
      }
      
      // Buscar todos os clientes para o formulário
      Cliente.getAll((err, clientes) => {
        if (err) {
          console.error('Erro ao buscar clientes:', err);
          clientes = [];
        }
        
        res.render('orcamentos/form', {
          title: `Editar - ${orcamento.titulo}`,
          orcamento,
          clientes
        });
      });
    }
  );
});

// Atualizar orçamento
router.post('/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const { cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade, status } = req.body;
  
  // Validação simples
  if (!titulo) {
    // Buscar todos os clientes novamente para o formulário
    Cliente.getAll((err, clientes) => {
      if (err) {
        console.error('Erro ao buscar clientes:', err);
        clientes = [];
      }
      
      return res.status(400).render('orcamentos/form', {
        title: 'Editar Orçamento',
        orcamento: { id, ...req.body },
        clientes,
        error: 'Título é obrigatório'
      });
    });
    return;
  }
  
  const db = require('../config/database');
  
  db.run(
    `UPDATE orcamentos SET 
    cliente_id = ?,
    titulo = ?,
    descricao = ?,
    valor_estimado = ?,
    tipo_obra = ?,
    localidade = ?,
    status = ?,
    data_atualizacao = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade, status, id],
    function(err) {
      if (err) {
        console.error('Erro ao atualizar orçamento:', err);
        
        // Buscar todos os clientes novamente para o formulário
        Cliente.getAll((err, clientes) => {
          if (err) {
            console.error('Erro ao buscar clientes:', err);
            clientes = [];
          }
          
          return res.status(500).render('orcamentos/form', {
            title: 'Editar Orçamento',
            orcamento: { id, ...req.body },
            clientes,
            error: 'Erro ao atualizar orçamento'
          });
        });
        return;
      }
      
      res.redirect(`/orcamentos/${id}`);
    }
  );
});

// Excluir orçamento
router.post('/:id/excluir', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const db = require('../config/database');
  
  db.run(
    `DELETE FROM orcamentos WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error('Erro ao excluir orçamento:', err);
        return res.status(500).render('error', {
          title: 'Erro',
          message: 'Erro ao excluir orçamento'
        });
      }
      
      res.redirect('/orcamentos');
    }
  );
});

// Formulário para geração de orçamento com IA
router.get('/gerar-ia', isAuthenticated, (req, res) => {
  // Verificar se existe a chave da API de IA
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).render('error', {
      title: 'Erro',
      message: 'API de IA não configurada. Adicione uma chave OPENAI_API_KEY no arquivo .env'
    });
  }
  
  // Buscar todos os clientes para o formulário
  Cliente.getAll((err, clientes) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      clientes = [];
    }
    
    res.render('orcamentos/form_ia', {
      title: 'Gerar Orçamento com IA',
      clientes
    });
  });
});

// Processar geração de orçamento com IA
router.post('/gerar-ia', isAuthenticated, async (req, res) => {
  try {
    const { cliente_id, tipo_obra, localidade, tamanho, descricao } = req.body;
    
    // Verificar se existe a chave da API de IA
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).render('error', {
        title: 'Erro',
        message: 'API de IA não configurada. Adicione uma chave OPENAI_API_KEY no arquivo .env'
      });
    }
    
    // Validação simples
    if (!tipo_obra || !localidade || !tamanho) {
      // Buscar todos os clientes novamente para o formulário
      Cliente.getAll((err, clientes) => {
        if (err) {
          console.error('Erro ao buscar clientes:', err);
          clientes = [];
        }
        
        return res.status(400).render('orcamentos/form_ia', {
          title: 'Gerar Orçamento com IA',
          dados: req.body,
          clientes,
          error: 'Tipo de obra, localidade e tamanho são obrigatórios'
        });
      });
      return;
    }
    
    // Gerar orçamento com IA
    const resultado = await IA.gerarOrcamento({
      tipo_obra,
      localidade,
      tamanho,
      descricao: descricao || ''
    });
    
    if (resultado.erro) {
      return res.status(500).render('error', {
        title: 'Erro',
        message: resultado.erro
      });
    }
    
    res.render('orcamentos/resultado_ia', {
      title: 'Orçamento Gerado',
      orcamento: resultado.orcamento,
      dados: resultado.dados,
      cliente_id
    });
    
  } catch (error) {
    console.error('Erro ao gerar orçamento com IA:', error);
    res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao gerar orçamento'
    });
  }
});

// Salvar orçamento gerado com IA
router.post('/salvar-orcamento-ia', isAuthenticated, (req, res) => {
  const { cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade } = req.body;
  
  // Validação simples
  if (!titulo) {
    return res.status(400).render('error', {
      title: 'Erro',
      message: 'Título é obrigatório'
    });
  }
  
  const db = require('../config/database');
  
  db.run(
    `INSERT INTO orcamentos (cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade],
    function(err) {
      if (err) {
        console.error('Erro ao salvar orçamento gerado com IA:', err);
        return res.status(500).render('error', {
          title: 'Erro',
          message: 'Erro ao salvar orçamento'
        });
      }
      
      res.redirect(`/orcamentos/${this.lastID}`);
    }
  );
});

module.exports = router;