// menu.js
const { ipcRenderer } = require('electron');

// Navegación - compatibilidad con sistema antiguo y nuevo
function irAVentas() {
  window.location.href = 'index.html';
}

function irAProductos() {
  window.location.href = 'productos.html';
}

function irAInforme() {
  window.location.href = 'historial.html';
}

function irAConfiguracion() {
  window.location.href = 'configuracion.html';
}

function cerrarApp() {
  if (window.Navigation) {
    window.Navigation.exit();
  } else {
    ipcRenderer.send('cerrar-app');
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando botones del menú principal');
  
  // Asegurarse de que los botones tengan event listeners
  const botones = {
    '.btn-venta': irAVentas,
    '.btn-productos': irAProductos,
    '.btn-ventas': irAInforme,
    '.btn-config': irAConfiguracion,
    '.btn-salir': cerrarApp
  };
  
  // Agregar event listeners a cada botón
  for (const [selector, handler] of Object.entries(botones)) {
    const elementos = document.querySelectorAll(selector);
    if (elementos.length > 0) {
      elementos.forEach(elemento => {
        // Eliminar el atributo onclick para evitar conflictos
        elemento.removeAttribute('onclick');
        // Agregar event listener
        elemento.addEventListener('click', handler);
        console.log(`Event listener agregado a ${selector}`);
      });
    } else {
      console.warn(`No se encontraron elementos con el selector: ${selector}`);
    }
  }
});

// Manejar teclas rápidas
document.addEventListener('keydown', (event) => {
  // Solo si no hay ningún campo de entrada con foco
  if (document.activeElement.tagName !== 'INPUT') {
    switch(event.key.toLowerCase()) {
      case '1':
        irAVentas();
        break;
      case '2':
        irAProductos();
        break;
      case '3':
        irAInforme();
        break;
      case '4':
        irAConfiguracion();
        break;
      case 'escape':
        cerrarApp();
        break;
    }
  }
});

// Mostrar atajos de teclado en tooltips
const tooltips = {
  'btn-venta': 'Tecla 1',
  'btn-productos': 'Tecla 2',
  'btn-ventas': 'Tecla 3',
  'btn-config': 'Tecla 4',
  'btn-salir': 'Tecla ESC'
};

// Agregar tooltips después de cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  Object.entries(tooltips).forEach(([className, text]) => {
    const element = document.querySelector(`.${className}`);
    if (element) {
      element.setAttribute('title', text);
    }
  });
});
