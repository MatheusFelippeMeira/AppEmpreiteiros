/**
 * App Empreiteiros - Sistema de Gerenciamento para Empreiteiros
 * Script principal com funções compartilhadas
 */

// Quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  // Inicializa os tooltips do Bootstrap
  initTooltips();
  
  // Inicializa máscaras de input se a biblioteca estiver disponível
  initInputMasks();
  
  // Configura botões de confirmação
  initConfirmButtons();
  
  // Configura o retorno automático após uploads em mobile
  initMobileUpload();
  
  // Inicializa verificações de formulários
  initFormValidation();
});

// Inicializar tooltips do Bootstrap
function initTooltips() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Inicializar máscaras de input (dependendo da biblioteca jQuery Mask)
function initInputMasks() {
  if (typeof $.fn.mask === 'function') {
    $('.mask-cpf').mask('000.000.000-00');
    $('.mask-cnpj').mask('00.000.000/0000-00');
    $('.mask-telefone').mask('(00) 00000-0000');
    $('.mask-cep').mask('00000-000');
    $('.mask-data').mask('00/00/0000');
    $('.mask-dinheiro').mask('#.##0,00', {reverse: true});
  }
}

// Configurar botões que precisam de confirmação
function initConfirmButtons() {
  const confirmButtons = document.querySelectorAll('.confirm-action');
  
  confirmButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      const message = this.getAttribute('data-confirm') || 'Tem certeza que deseja realizar esta ação?';
      
      if (!confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  });
}

// Melhoria para uploads em dispositivos móveis
function initMobileUpload() {
  const mobileUploads = document.querySelectorAll('.mobile-upload');
  
  mobileUploads.forEach(input => {
    input.addEventListener('change', function() {
      if (this.files && this.files.length > 0) {
        const label = this.nextElementSibling;
        if (label && label.classList.contains('upload-label')) {
          label.textContent = this.files[0].name;
        }
      }
    });
  });
}

// Validações de formulário
function initFormValidation() {
  // Busca todos os formulários que precisam de validação
  const forms = document.querySelectorAll('.needs-validation');
  
  // Loop pelos formulários e previne submissão se inválidos
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      form.classList.add('was-validated');
    }, false);
  });
}

// Formatadores de números e datas
const formatters = {
  // Formata um valor para moeda brasileira
  currency: function(value) {
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },
  
  // Formata uma data para o formato brasileiro
  date: function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
  },
  
  // Formata um número com precisão específica
  number: function(value, precision = 2) {
    return parseFloat(value).toLocaleString('pt-BR', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
  }
};

// Funções para manipulação de status
const statusHelpers = {
  // Retorna a classe CSS para um dado status
  getStatusClass: function(status) {
    const statusMap = {
      'em_andamento': 'status-em-andamento',
      'concluido': 'status-concluido',
      'pendente': 'status-pendente',
      'cancelado': 'status-cancelado',
      'ativo': 'status-em-andamento',
      'inativo': 'status-cancelado',
      'aprovado': 'status-concluido'
    };
    
    return statusMap[status] || 'status-pendente';
  },
  
  // Retorna o texto de exibição para um dado status
  getStatusText: function(status) {
    const statusMap = {
      'em_andamento': 'Em andamento',
      'concluido': 'Concluído',
      'pendente': 'Pendente',
      'cancelado': 'Cancelado',
      'ativo': 'Ativo',
      'inativo': 'Inativo',
      'aprovado': 'Aprovado'
    };
    
    return statusMap[status] || status;
  }
};

// Função para exibir notificações na interface
function showNotification(message, type = 'success', duration = 5000) {
  // Criar elemento de notificação
  const notification = document.createElement('div');
  notification.className = `toast align-items-center text-white bg-${type} border-0`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');
  notification.setAttribute('aria-atomic', 'true');
  
  // HTML interno
  notification.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  // Adicionar à página
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
  }
  
  document.getElementById('toast-container').appendChild(notification);
  
  // Inicializar e mostrar o toast
  const toast = new bootstrap.Toast(notification, { 
    autohide: true,
    delay: duration
  });
  toast.show();
  
  // Remover da DOM após fechar
  notification.addEventListener('hidden.bs.toast', function() {
    notification.remove();
  });
}