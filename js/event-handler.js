/**
 * Sistema centralizado de manejo de eventos
 * Este archivo proporciona una capa de abstracción para manejar todos los eventos de la aplicación
 * de forma consistente y robusta, resistente a cambios en el código.
 */

// Objeto para almacenar todos los manejadores de eventos
const EventHandler = {
    // Almacena todos los listeners registrados
    listeners: {},
    
    // Almacena referencias a elementos DOM
    elements: {},
    
    /**
     * Inicializa el sistema de eventos
     * @param {string} page - Nombre de la página actual
     */
    init(page) {
        console.log(`Inicializando manejador de eventos para: ${page}`);
        
        // Limpiamos los listeners anteriores
        this.listeners = {};
        this.elements = {};
        
        // Configuramos listeners específicos de cada página
        switch(page) {
            case 'menu':
                this.setupMenuEvents();
                break;
            case 'ventas':
                this.setupVentasEvents();
                break;
            case 'productos':
                this.setupProductosEvents();
                break;
            case 'configuracion':
                this.setupConfiguracionEvents();
                break;
            case 'historial':
                this.setupHistorialEvents();
                break;
            default:
                console.warn('Página no reconocida para configurar eventos');
        }
        
        console.log('Manejador de eventos inicializado correctamente');
    },
    
    /**
     * Registra un elemento del DOM para su uso posterior
     * @param {string} id - ID del elemento
     * @param {HTMLElement} element - Elemento del DOM
     */
    registerElement(id, element) {
        this.elements[id] = element;
    },
    
    /**
     * Encuentra y registra un elemento del DOM por su ID
     * @param {string} id - ID del elemento
     * @returns {HTMLElement} - El elemento encontrado o null
     */
    findElement(id) {
        const element = document.getElementById(id);
        if (element) {
            this.elements[id] = element;
            return element;
        } else {
            console.warn(`Elemento con ID '${id}' no encontrado`);
            return null;
        }
    },
    
    /**
     * Agrega un event listener a un elemento
     * @param {string|HTMLElement} elementId - ID del elemento o el elemento en sí
     * @param {string} eventType - Tipo de evento (click, change, etc.)
     * @param {Function} handler - Función manejadora del evento
     * @param {boolean} useCapture - Usar fase de captura
     */
    addListener(elementId, eventType, handler, useCapture = false) {
        let element;
        
        if (typeof elementId === 'string') {
            element = this.elements[elementId] || this.findElement(elementId);
        } else {
            element = elementId;
        }
        
        if (!element) {
            console.warn(`No se pudo agregar listener: elemento '${elementId}' no encontrado`);
            return false;
        }
        
        // Crear un ID único para este listener
        const listenerId = `${elementId}_${eventType}_${Date.now()}`;
        
        // Almacenar el listener para poder eliminarlo después
        this.listeners[listenerId] = {
            element,
            eventType,
            handler,
            useCapture
        };
        
        // Agregar el listener al elemento
        element.addEventListener(eventType, handler, useCapture);
        
        console.log(`Listener agregado: ${listenerId}`);
        return listenerId;
    },
    
    /**
     * Elimina un listener específico
     * @param {string} listenerId - ID del listener a eliminar
     */
    removeListener(listenerId) {
        const listener = this.listeners[listenerId];
        if (listener) {
            const { element, eventType, handler, useCapture } = listener;
            element.removeEventListener(eventType, handler, useCapture);
            delete this.listeners[listenerId];
            console.log(`Listener eliminado: ${listenerId}`);
            return true;
        }
        return false;
    },
    
    /**
     * Elimina todos los listeners registrados
     */
    removeAllListeners() {
        Object.keys(this.listeners).forEach(id => {
            this.removeListener(id);
        });
        console.log('Todos los listeners han sido eliminados');
    },
    
    /**
     * Configura eventos para la página de menú
     */
    setupMenuEvents() {
        // Botones del menú principal
        const menuButtons = {
            'irAVentas': () => window.location.href = 'index.html',
            'irAProductos': () => window.location.href = 'productos.html',
            'irAInforme': () => window.location.href = 'historial.html',
            'irAConfiguracion': () => window.location.href = 'configuracion.html',
            'salir': () => {
                if (window.electron) {
                    window.electron.close();
                } else {
                    window.close();
                }
            }
        };
        
        // Agregar listeners a los botones del menú
        Object.keys(menuButtons).forEach(funcName => {
            const elements = document.querySelectorAll(`[onclick="${funcName}()"]`);
            elements.forEach(el => {
                // Remover el onclick para prevenir conflictos
                el.removeAttribute('onclick');
                // Agregar el nuevo event listener
                this.addListener(el, 'click', menuButtons[funcName]);
            });
        });
    },
    
    /**
     * Configura eventos para la página de ventas
     */
    setupVentasEvents() {
        // Botones principales
        this.addListenerIfElementExists('btnVaciarCarrito', 'click', () => {
            if (typeof vaciarCarrito === 'function') vaciarCarrito();
        });
        
        this.addListenerIfElementExists('btnFinalizarVenta', 'click', () => {
            if (typeof procesarVenta === 'function') procesarVenta();
        });
        
        this.addListenerIfElementExists('btnCancelarVenta', 'click', () => {
            if (typeof vaciarCarrito === 'function') vaciarCarrito();
        });
        
        // Botones de método de pago
        this.setupPaymentMethodButtons();
        
        // Búsqueda de productos
        this.addListenerIfElementExists('buscarProductoInput', 'keyup', (e) => {
            if (e.key === 'Enter' && typeof buscarProductoPorCodigo === 'function') {
                buscarProductoPorCodigo(e.target.value);
            }
        });
        
        this.addListenerIfElementExists('btnBuscarProducto', 'click', () => {
            const input = document.getElementById('buscarProductoInput');
            if (input && typeof buscarProductoPorCodigo === 'function') {
                buscarProductoPorCodigo(input.value);
            }
        });
        
        // Delegación de eventos para botones de productos
        this.addListenerIfElementExists('productos-grid', 'click', (e) => {
            const productoElement = e.target.closest('.producto');
            if (productoElement && typeof agregarAlCarrito === 'function') {
                const productoId = productoElement.dataset.id;
                const producto = window.productos ? window.productos.find(p => p.id === parseInt(productoId)) : null;
                if (producto) {
                    agregarAlCarrito(producto);
                }
            }
        });
        
        // Delegación de eventos para botones del carrito
        this.addListenerIfElementExists('carrito-items', 'click', (e) => {
            const btnMas = e.target.closest('.btn-mas');
            const btnMenos = e.target.closest('.btn-menos');
            const btnEliminar = e.target.closest('.btn-eliminar');
            
            if (!btnMas && !btnMenos && !btnEliminar) return;
            
            const carritoItem = e.target.closest('.carrito-item');
            if (!carritoItem) return;
            
            const index = parseInt(carritoItem.dataset.index);
            
            if (btnMas && typeof modificarCantidad === 'function') {
                modificarCantidad(index, 1);
            } else if (btnMenos && typeof modificarCantidad === 'function') {
                modificarCantidad(index, -1);
            } else if (btnEliminar && typeof eliminarDelCarrito === 'function') {
                eliminarDelCarrito(index);
            }
        });
    },
    
    /**
     * Configura los botones de método de pago
     */
    setupPaymentMethodButtons() {
        const paymentMethods = ['efectivo', 'tarjeta', 'transferencia'];
        
        paymentMethods.forEach(method => {
            this.addListenerIfElementExists(`btn-${method}`, 'click', () => {
                // Actualizar botones
                paymentMethods.forEach(m => {
                    const btn = document.getElementById(`btn-${m}`);
                    if (btn) {
                        if (m === method) {
                            btn.classList.add('activo');
                        } else {
                            btn.classList.remove('activo');
                        }
                    }
                });
                
                // Actualizar método de pago global
                if (window.metodoPago !== undefined) {
                    window.metodoPago = method;
                }
                
                // Actualizar vista si existe la función
                if (typeof actualizarTotales === 'function') {
                    actualizarTotales();
                }
            });
        });
    },
    
    /**
     * Configura eventos para la página de productos
     */
    setupProductosEvents() {
        // Botón volver
        this.addListenerIfElementExists('btnVolver', 'click', () => {
            window.location.href = 'menu.html';
        });
        
        // Botón nuevo producto
        this.addListenerIfElementExists('btnNuevo', 'click', () => {
            if (typeof mostrarFormularioProducto === 'function') {
                mostrarFormularioProducto();
            }
        });
        
        // Botones de búsqueda y filtros
        this.addListenerIfElementExists('btnBuscar', 'click', () => {
            if (typeof buscarProducto === 'function') {
                buscarProducto();
            }
        });
        
        this.addListenerIfElementExists('buscarProducto', 'keyup', (e) => {
            if (e.key === 'Enter' && typeof buscarProducto === 'function') {
                buscarProducto();
            }
        });
        
        this.addListenerIfElementExists('btnAplicarFiltros', 'click', () => {
            if (typeof buscarProducto === 'function') {
                buscarProducto();
            }
        });
        
        this.addListenerIfElementExists('btnLimpiarFiltros', 'click', () => {
            // Limpiar filtros
            const filtroCategoria = document.getElementById('filtroCategoria');
            const ordenarPor = document.getElementById('ordenarPor');
            const buscarProductoInput = document.getElementById('buscarProducto');
            
            if (filtroCategoria) filtroCategoria.value = '';
            if (ordenarPor) ordenarPor.value = 'nombre';
            if (buscarProductoInput) buscarProductoInput.value = '';
            
            // Ejecutar búsqueda
            if (typeof buscarProducto === 'function') {
                buscarProducto();
            }
        });
        
        // Formulario de producto
        this.addListenerIfElementExists('form-producto', 'submit', (e) => {
            e.preventDefault();
            if (typeof guardarProducto === 'function') {
                guardarProducto(e);
            }
        });
        
        // Cerrar modal de producto
        const closeModal = () => {
            const modal = document.getElementById('modal-producto');
            if (modal) {
                modal.style.display = 'none';
            }
        };
        
        // Evento para cerrar el modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('modal-producto');
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Delegación de eventos para botones de editar/eliminar productos
        this.addListenerIfElementExists('lista-productos', 'click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            const btnEliminar = e.target.closest('.btn-eliminar');
            
            if (!btnEditar && !btnEliminar) return;
            
            const productoElement = e.target.closest('.producto-item');
            if (!productoElement) return;
            
            const id = parseInt(productoElement.dataset.id);
            
            if (btnEditar && typeof editarProducto === 'function') {
                editarProducto(id);
            } else if (btnEliminar && typeof eliminarProducto === 'function') {
                eliminarProducto(id);
            }
        });
    },
    
    /**
     * Configura eventos para la página de configuración
     */
    setupConfiguracionEvents() {
        // Botón volver
        this.addListenerIfElementExists('btn-volver', 'click', () => {
            window.location.href = 'menu.html';
        });
        
        // Cambio de pestañas
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            this.addListener(tab, 'click', () => {
                const targetTab = tab.getAttribute('data-target');
                
                // Actualizar pestaña activa
                tabs.forEach(t => t.classList.remove('activo'));
                tab.classList.add('activo');
                
                // Mostrar contenido de la pestaña
                document.querySelectorAll('.tab-contenido').forEach(content => {
                    content.classList.remove('activo');
                });
                
                const tabContent = document.getElementById(targetTab);
                if (tabContent) {
                    tabContent.classList.add('activo');
                }
            });
        });
        
        // Manejar cambios en formularios
        const formInputs = document.querySelectorAll('#form-config input, #form-config select, #form-config textarea');
        formInputs.forEach(input => {
            ['change', 'input'].forEach(eventType => {
                this.addListener(input, eventType, () => {
                    if (typeof guardarConfigAuto === 'function') {
                        guardarConfigAuto();
                    }
                });
            });
        });
    },
    
    /**
     * Configura eventos para la página de historial
     */
    setupHistorialEvents() {
        // Botón volver
        this.addListenerIfElementExists('btn-volver', 'click', () => {
            window.location.href = 'menu.html';
        });
        
        // Filtros de búsqueda
        this.addListenerIfElementExists('btnFiltrar', 'click', () => {
            if (typeof filtrarHistorial === 'function') {
                filtrarHistorial();
            }
        });
        
        // Exportar datos
        this.addListenerIfElementExists('btnExportar', 'click', () => {
            if (typeof exportarHistorial === 'function') {
                exportarHistorial();
            }
        });
        
        // Delegación de eventos para botones de acciones de venta
        this.addListenerIfElementExists('tabla-ventas', 'click', (e) => {
            const btnVer = e.target.closest('.btn-ver');
            const btnImprimir = e.target.closest('.btn-imprimir');
            const btnDevolver = e.target.closest('.btn-devolver');
            
            if (!btnVer && !btnImprimir && !btnDevolver) return;
            
            const fila = e.target.closest('tr');
            if (!fila) return;
            
            const ventaId = fila.dataset.id;
            
            if (btnVer && typeof verDetalleVenta === 'function') {
                verDetalleVenta(ventaId);
            } else if (btnImprimir && typeof reimprimirVenta === 'function') {
                reimprimirVenta(ventaId);
            } else if (btnDevolver && typeof devolverVenta === 'function') {
                devolverVenta(ventaId);
            }
        });
    },
    
    /**
     * Agrega un listener sólo si el elemento existe
     * @param {string} elementId - ID del elemento
     * @param {string} eventType - Tipo de evento
     * @param {Function} handler - Función manejadora
     * @returns {string|boolean} - ID del listener o false
     */
    addListenerIfElementExists(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            return this.addListener(element, eventType, handler);
        } else {
            console.warn(`Elemento ${elementId} no encontrado para agregar listener`);
            return false;
        }
    }
};

// Exportar para su uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventHandler;
} else {
    window.EventHandler = EventHandler;
}
