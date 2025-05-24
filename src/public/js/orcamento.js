/**
 * Funções específicas para o módulo de orçamentos
 */

document.addEventListener('DOMContentLoaded', function() {
  // Inicializar formatação de valores monetários
  initMoneyInputs();
  
  // Inicializar cálculos automáticos
  initCalculations();
  
  // Inicializar exportação para PDF
  initPdfExport();
});

// Inicializar inputs monetários
function initMoneyInputs() {
  const moneyInputs = document.querySelectorAll('.money-input');
  
  moneyInputs.forEach(input => {
    input.addEventListener('input', function(e) {
      // Remove caracteres não numéricos, exceto ponto e vírgula
      let value = this.value.replace(/[^\d.,]/g, '');
      
      // Converte para formato numérico
      value = value.replace(/,/g, '.');
      
      // Atualiza o valor do input hidden associado (se existir)
      const hiddenInput = document.getElementById(this.id + '_value');
      if (hiddenInput) {
        hiddenInput.value = parseFloat(value) || 0;
      }
      
      // Dispara evento de cálculo se necessário
      if (this.classList.contains('calc-trigger')) {
        calculateTotals();
      }
    });
  });
}

// Inicializar cálculos automáticos
function initCalculations() {
  const calcTriggers = document.querySelectorAll('.calc-trigger');
  
  calcTriggers.forEach(trigger => {
    trigger.addEventListener('change', calculateTotals);
    trigger.addEventListener('input', calculateTotals);
  });
  
  // Executar cálculo inicial
  calculateTotals();
}

// Calcular totais do orçamento
function calculateTotals() {
  const form = document.getElementById('orcamentoForm');
  if (!form) return;
  
  // Obter valores dos materiais
  const materiais = parseFloat(document.getElementById('valor_materiais')?.value || 0);
  const maoDeObra = parseFloat(document.getElementById('valor_mao_obra')?.value || 0);
  const outros = parseFloat(document.getElementById('valor_outros')?.value || 0);
  
  // Calcular subtotal
  const subtotal = materiais + maoDeObra + outros;
  
  // Obter margem de lucro
  const margemLucro = parseFloat(document.getElementById('margem_lucro')?.value || 0) / 100;
  
  // Calcular valor do lucro
  const valorLucro = subtotal * margemLucro;
  
  // Calcular total
  const total = subtotal + valorLucro;
  
  // Atualizar campos
  if (document.getElementById('subtotal')) {
    document.getElementById('subtotal').textContent = formatters.currency(subtotal);
  }
  
  if (document.getElementById('valor_lucro')) {
    document.getElementById('valor_lucro').textContent = formatters.currency(valorLucro);
  }
  
  if (document.getElementById('valor_total')) {
    document.getElementById('valor_total').value = total.toFixed(2);
  }
  
  if (document.getElementById('valor_total_display')) {
    document.getElementById('valor_total_display').textContent = formatters.currency(total);
  }
}

// Inicializar exportação para PDF
function initPdfExport() {
  const pdfButton = document.getElementById('exportPdf');
  if (!pdfButton) return;
  
  pdfButton.addEventListener('click', function() {
    const orcamentoId = this.getAttribute('data-id');
    if (!orcamentoId) return;
    
    // Mostrar indicador de carregamento
    showNotification('Gerando PDF, aguarde...', 'info');
    
    // Redirecionar para a rota de geração de PDF
    window.location.href = `/orcamentos/${orcamentoId}/pdf`;
  });
}

// Função para adicionar item ao orçamento
function adicionarItem(tipo) {
  const container = document.getElementById(`${tipo}-container`);
  if (!container) return;
  
  const itemCount = container.querySelectorAll('.item-row').length + 1;
  
  const novoItem = document.createElement('div');
  novoItem.className = 'row item-row mb-2';
  novoItem.innerHTML = `
    <div class="col-md-6">
      <input type="text" class="form-control" name="${tipo}[${itemCount}][descricao]" placeholder="Descrição" required>
    </div>
    <div class="col-md-2">
      <input type="number" class="form-control" name="${tipo}[${itemCount}][quantidade]" placeholder="Qtd" min="1" value="1" required>
    </div>
    <div class="col-md-2">
      <input type="number" step="0.01" class="form-control money-input calc-trigger" name="${tipo}[${itemCount}][valor_unitario]" placeholder="Valor" required>
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-sm" onclick="removerItem(this)">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  
  container.appendChild(novoItem);
  
  // Reinicializar inputs monetários
  initMoneyInputs();
}

// Função para remover item do orçamento
function removerItem(button) {
  const row = button.closest('.item-row');
  if (row) {
    row.remove();
    calculateTotals();
  }
}