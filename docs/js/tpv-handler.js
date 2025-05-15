/**
 * Manejador específico para el TPV (Terminal Punto de Venta)
 * Este archivo garantiza que todas las funcionalidades del TPV funcionen correctamente
 */

const TPVHandler = {
    // Estado del carrito
    carrito: {
        items: [],
        subtotal: 0,
        iva: 0,
        total: 0,
        descuentoTotal: 0,
        descuentoTotalPorcentaje: 0,
        metodoPago: 'efectivo',
        montoRecibido: 0,
        cambio: 0
    },
    
    // Configuración (se cargará desde la configuración global)
    config: {
        moneda: 'EUR',
        tasaIVA: 21,
        simboloMoneda: '€'
    },
    
    // Referencias a elementos del DOM
    elements: {},
    
    /**
     * Inicializa el manejador del TPV
     */
    init() {
        console.log('Inicializando manejador de TPV...');
        
        // Cargar configuración
        this.loadConfig();
        
        // Cargar referencias a elementos del DOM
        this.loadElements();
        
        // Configurar eventos
        this.setupEvents();
        
        // Cargar productos
        this.loadProducts();
        
        // Inicializar carrito vacío
        this.renderCarrito();
        
        console.log('Manejador de TPV inicializado correctamente');
    },
    
    /**
     * Carga la configuración global
     */
    loadConfig() {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('obtener-config')
                .then(config => {
                    this.config.moneda = config.moneda || 'EUR';
                    this.config.tasaIVA = config.tasaIVA || 21;
                    this.config.simboloMoneda = config.moneda === 'EUR' ? '€' : config.moneda;
                    
                    console.log('Configuración cargada:', this.config);
                })
                .catch(error => {
                    console.error('Error al cargar configuración:', error);
                });
        }
    },
    
    /**
     * Carga referencias a elementos del DOM
     */
    loadElements() {
        this.elements = {
            // Sección de productos
            productosGrid: document.getElementById('productos-grid'),
            buscarProducto: document.getElementById('buscar-producto'),
            searchResults: document.getElementById('search-results'),
            
            // Sección de carrito
            carritoItems: document.getElementById('carrito-items'),
            carritoVacio: document.getElementById('carrito-vacio'),
            
            // Resumen de venta
            subtotal: document.getElementById('subtotal'),
            iva: document.getElementById('iva'),
            totalDescuento: document.getElementById('total-descuento'),
            total: document.getElementById('total'),
            
            // Descuento total
            descuentoTotalInput: document.getElementById('descuento-total'),
            descuentoTotalPorcentaje: document.getElementById('descuento-total-porcentaje'),
            aplicarDescuentoTotal: document.getElementById('aplicar-descuento-total'),
            
            // Método de pago
            metodoPago: document.getElementById('metodoPago'),
            efectivoCampos: document.getElementById('efectivo-campos'),
            
            // Campos de efectivo
            efectivoEntregado: document.getElementById('efectivoEntregado'),
            cambioCalculado: document.getElementById('cambioCalculado'),
            
            // Acciones
            btnPagar: document.getElementById('btn-pagar'),
            btnCancelar: document.getElementById('btn-cancelar')
        };
        
        // Verificar si se encontraron los elementos
        const missingElements = Object.entries(this.elements)
            .filter(([key, el]) => !el)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.warn('Elementos no encontrados:', missingElements.join(', '));
        }
    },
    
    /**
     * Configura eventos para los elementos
     */
    setupEvents() {
        console.log('Configurando eventos del TPV...');
        
        // Búsqueda de productos
        if (this.elements.buscarProducto) {
            this.elements.buscarProducto.addEventListener('input', () => {
                this.searchProducts();
            });
        }
        
        // Delegación de eventos para la grid de productos
        if (this.elements.productosGrid) {
            this.elements.productosGrid.addEventListener('click', (e) => {
                const productoCard = e.target.closest('.producto-card');
                if (productoCard) {
                    const id = parseInt(productoCard.dataset.id);
                    this.addToCart(id);
                }
            });
        }
        
        // Delegación de eventos para el carrito
        if (this.elements.carritoItems) {
            this.elements.carritoItems.addEventListener('click', (e) => {
                const btnMas = e.target.closest('.btn-cantidad-mas');
                const btnMenos = e.target.closest('.btn-cantidad-menos');
                const btnEliminar = e.target.closest('.btn-eliminar');
                const btnDescuento = e.target.closest('.btn-descuento');
                
                if (!btnMas && !btnMenos && !btnEliminar && !btnDescuento) return;
                
                const carritoItem = e.target.closest('.carrito-item');
                if (!carritoItem) return;
                
                const index = parseInt(carritoItem.dataset.index);
                
                if (btnMas) {
                    this.increaseQuantity(index);
                } else if (btnMenos) {
                    this.decreaseQuantity(index);
                } else if (btnEliminar) {
                    this.removeFromCart(index);
                } else if (btnDescuento) {
                    this.showDiscountModal(index);
                }
            });
        }
        
        // Método de pago
        if (this.elements.metodoPago) {
            this.elements.metodoPago.addEventListener('change', () => {
                this.toggleEfectivoInput();
            });
        }
        
        // Monto recibido (cálculo de cambio)
        if (this.elements.montoRecibido) {
            this.elements.montoRecibido.addEventListener('input', () => {
                this.calculateChange();
            });
        }
        
        // Descuento total
        if (this.elements.aplicarDescuentoTotal) {
            this.elements.aplicarDescuentoTotal.addEventListener('click', () => {
                this.applyTotalDiscount();
            });
        }
        
        // Finalizar venta
        if (this.elements.btnPagar) {
            this.elements.btnPagar.addEventListener('click', () => {
                this.finalizeSale();
            });
        }
        
        // Cancelar venta
        if (this.elements.btnCancelar) {
            this.elements.btnCancelar.addEventListener('click', () => {
                this.clearCart();
            });
        }
    },
    
    /**
     * Establece el método de pago
     */
    setPaymentMethod(method) {
        // Actualizar carrito
        this.carrito.metodoPago = method;
        console.log('Método de pago establecido:', method);
        
        // Mostrar/ocultar campos de efectivo
        this.toggleEfectivoInput();
    },
    
    /**
     * Muestra/oculta los campos de efectivo según el método de pago
     */
    toggleEfectivoInput() {
        if (!this.elements.metodoPago || !this.elements.efectivoCampos) {
            console.error('Elementos metodoPago o efectivoCampos no encontrados');
            return;
        }
        
        const metodo = this.elements.metodoPago.value;
        console.log('Método seleccionado:', metodo);
        
        // Actualizar el método de pago en el carrito
        this.carrito.metodoPago = metodo;
        
        // Mostrar u ocultar los campos de efectivo
        this.elements.efectivoCampos.style.display = metodo === "efectivo" ? "block" : "none";
        
        // Limpiar campos de efectivo cuando se cambia el método
        if (metodo !== "efectivo") {
            this.carrito.montoRecibido = 0;
            this.carrito.cambio = 0;
            if (this.elements.efectivoEntregado) {
                this.elements.efectivoEntregado.value = "";
            }
            if (this.elements.cambioCalculado) {
                this.elements.cambioCalculado.textContent = this.formatCurrency(0);
            }
        }
        
        // Actualizar estado del botón de pagar
        if (this.elements.btnPagar) {
            this.elements.btnPagar.disabled = metodo === "efectivo" && 
                                           (!this.carrito.montoRecibido || 
                                            this.carrito.montoRecibido < this.carrito.total);
        }
    },
    
    /**
     * Carga los productos disponibles
     */
    loadProducts() {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('obtener-productos')
                .then(productos => {
                    this.renderProductos(productos);
                })
                .catch(error => {
                    console.error('Error al cargar productos:', error);
                });
        }
    },
    
    /**
     * Renderiza los productos en la grid
     */
    renderProductos(productos) {
        if (!this.elements.productosGrid) return;
        
        this.elements.productosGrid.innerHTML = '';
        
        if (!productos || productos.length === 0) {
            this.elements.productosGrid.innerHTML = `
                <div class="productos-vacio">
                    <i class="fas fa-box-open"></i>
                    <p>No hay productos disponibles</p>
                    <p class="text-muted">Agrega productos desde la sección de gestión de productos</p>
                </div>
            `;
            return;
        }
        
        productos.forEach(producto => {
            const imagenHTML = producto.imagen 
                ? `<img src="${producto.imagen}" alt="${producto.nombre}" class="producto-imagen">` 
                : `<div class="producto-imagen"><i class="fas fa-shoe-prints"></i></div>`;
                
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.dataset.id = producto.id;
            card.innerHTML = `
                ${imagenHTML}
                <div class="producto-nombre">${producto.nombre}</div>
                <div class="producto-precio">${this.formatCurrency(producto.precio)}</div>
                <div class="producto-stock">Stock: ${producto.cantidad || 0}</div>
            `;
            
            this.elements.productosGrid.appendChild(card);
        });
    }
};

// Continuará en tpv-handler-parte2.js

// Inicialización cuando el DOM está completamente cargado
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔄 DOM completamente cargado, inicializando eventos...");
  
  const metodoPago = document.getElementById("metodoPago");
  const btnFinalizar = document.getElementById("btnFinalizarVenta") || document.getElementById("btn-pagar");
  const efectivoInput = document.getElementById("efectivoEntregado");

  if (metodoPago) {
    console.log("✅ metodoPago encontrado, agregando evento change");
    metodoPago.addEventListener("change", () => {
      console.log("🔄 Método de pago cambiado");
      if (typeof toggleEfectivoInput === 'function') {
        toggleEfectivoInput();
      } else if (TPVHandler && TPVHandler.toggleEfectivoInput) {
        TPVHandler.toggleEfectivoInput();
      }
    });
  } else {
    console.error("❌ metodoPago no encontrado");
  }

  if (efectivoInput) {
    console.log("✅ efectivoInput encontrado, agregando evento input");
    efectivoInput.addEventListener("input", () => {
      console.log("🔄 Monto efectivo cambiado");
      if (typeof handleMontoRecibido === 'function') {
        handleMontoRecibido();
      } else if (TPVHandler && TPVHandler.calculateChange) {
        TPVHandler.calculateChange();
      }
    });
  } else {
    console.error("❌ efectivoInput no encontrado");
  }

  if (btnFinalizar) {
    console.log("✅ btnFinalizar encontrado, agregando evento click");
    btnFinalizar.addEventListener("click", () => {
      console.log("🔄 Clic en botón finalizar");
      if (typeof finalizeSale === 'function') {
        finalizeSale();
      } else if (TPVHandler && TPVHandler.finalizeSale) {
        TPVHandler.finalizeSale();
      }
    });
  } else {
    console.error("❌ btnFinalizar no encontrado");
  }
});
