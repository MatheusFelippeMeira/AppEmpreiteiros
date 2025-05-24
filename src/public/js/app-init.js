/**
 * App Empreiteiros - Script de inicialização
 * Este script é executado antes de qualquer outro para configurar o ambiente
 */

// Configurar tratamento global de erros
window.addEventListener('error', function(event) {
  console.error('Erro global capturado:', event.error || event.message);
  
  // Evitar loops infinitos de erro
  if (event.message && (
      event.message.includes('localStorage') || 
      event.message.includes('storage') ||
      event.message.includes('Access to storage')
    )) {
    console.warn('Erro de acesso ao storage detectado. Usando modo de compatibilidade.');
    
    // Criar polyfill para localStorage
    if (typeof window.localStorage === 'undefined' || window.localStorage === null) {
      window.localStorage = {
        _data: {},
        setItem: function(id, val) { this._data[id] = String(val); },
        getItem: function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
        removeItem: function(id) { delete this._data[id]; },
        clear: function() { this._data = {}; }
      };
      console.log('Polyfill para localStorage criado');
    }
    
    // Criar polyfill para sessionStorage
    if (typeof window.sessionStorage === 'undefined' || window.sessionStorage === null) {
      window.sessionStorage = {
        _data: {},
        setItem: function(id, val) { this._data[id] = String(val); },
        getItem: function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
        removeItem: function(id) { delete this._data[id]; },
        clear: function() { this._data = {}; }
      };
      console.log('Polyfill para sessionStorage criado');
    }
  }
});

// Verificar conexão com o servidor
function checkServerConnection() {
  fetch('/health')
    .then(response => {
      if (!response.ok) {
        throw new Error('Servidor não está respondendo corretamente');
      }
      return response.text();
    })
    .then(data => {
      console.log('Conexão com o servidor OK:', data);
      document.body.classList.remove('offline-mode');
    })
    .catch(error => {
      console.error('Erro de conexão com o servidor:', error);
      document.body.classList.add('offline-mode');
      
      // Tentar reconectar após 10 segundos
      setTimeout(checkServerConnection, 10000);
    });
}

// Iniciar verificação de conexão quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Verificar conexão com o servidor
  checkServerConnection();
  
  // Adicionar classe para indicar que o JavaScript está habilitado
  document.body.classList.add('js-enabled');
  
  // Remover mensagens de erro após 5 segundos
  setTimeout(function() {
    const errorMessages = document.querySelectorAll('.alert-danger, .alert-error');
    errorMessages.forEach(function(message) {
      message.style.opacity = '0';
      setTimeout(function() {
        if (message.parentNode) {
          message.parentNode.removeChild(message);
        }
      }, 500);
    });
  }, 5000);
});

// Estilos para modo offline são definidos no error-handler.js