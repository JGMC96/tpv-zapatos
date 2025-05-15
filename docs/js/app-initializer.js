/**
 * Inicializador de la aplicación TPV Zapatos
 * Este archivo se encarga de arrancar la aplicación y asegurar que todos los eventos y funcionalidades
 * están correctamente configurados, independientemente de los cambios que se hagan en el código.
 */

// Función para determinar la página actual
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);
    
    if (page === '' || page === 'index.html') {
        return 'ventas';
    } else if (page === 'productos.html') {
        return 'productos';
    } else if (page === 'configuracion.html') {
        return 'configuracion';
    } else if (page === 'historial.html') {
        return 'historial';
    } else if (page === 'menu.html') {
        return 'menu';
    } else {
        return 'desconocido';
    }
}

// Función para inicializar la aplicación
function initializeApp() {
    console.log('Inicializando aplicación TPV Zapatos...');
    
    // 1. Registramos el objeto EventHandler en el contexto global si no existe
    if (!window.EventHandler) {
        console.error('EventHandler no encontrado. Asegúrate de cargar event-handler.js antes de app-initializer.js');
        return;
    }
    
    // 2. Determinamos la página actual
    const currentPage = getCurrentPage();
    console.log(`Página actual: ${currentPage}`);
    
    // 3. Inicializamos los manejadores de eventos específicos de la página
    window.EventHandler.init(currentPage);
    
    // 4. Configuramos la funcionalidad específica de la página
    setupPageSpecificFunctionality(currentPage);
    
    console.log('Aplicación inicializada correctamente');
}

// Configuración específica para cada página
function setupPageSpecificFunctionality(page) {
    // Funcionalidad específica para cada página
    switch (page) {
        case 'ventas':
            // Cargar productos iniciales
            if (typeof cargarProductos === 'function') {
                cargarProductos();
            }
            
            // Actualizar fecha y hora
            if (typeof actualizarFechaHora === 'function') {
                actualizarFechaHora();
                // Actualizar cada minuto
                setInterval(actualizarFechaHora, 60000);
            }
            break;
            
        case 'productos':
            // Inicializar la página de productos
            if (typeof inicializarProductos === 'function') {
                inicializarProductos();
            } else {
                console.log('Cargando productos de forma alternativa...');
                // Cargar productos de forma alternativa
                if (typeof cargarProductos === 'function') {
                    setTimeout(cargarProductos, 100);
                }
                
                // Cargar categorías si existe la función
                if (typeof cargarCategorias === 'function') {
                    setTimeout(cargarCategorias, 100);
                }
            }
            break;
            
        case 'configuracion':
            // Cargar configuración actual
            if (typeof cargarConfiguracion === 'function') {
                cargarConfiguracion();
            }
            break;
            
        case 'historial':
            // Cargar historial de ventas
            if (typeof cargarHistorial === 'function') {
                cargarHistorial();
            }
            break;
            
        case 'menu':
            // No se requiere inicialización especial para el menú
            break;
            
        default:
            console.warn(`No hay configuración específica para la página: ${page}`);
    }
}

// Asegurar que la aplicación se inicialice cuando esté lista
document.addEventListener('DOMContentLoaded', initializeApp);

// Exportar funciones para testing o uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentPage,
        initializeApp,
        setupPageSpecificFunctionality
    };
}
