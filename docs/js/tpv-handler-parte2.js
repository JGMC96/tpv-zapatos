/**
 * Continuación del TPVHandler (Parte 2)
 * Esta parte contiene las funciones de búsqueda y gestión del carrito
 */

// Extendemos TPVHandler con más métodos
Object.assign(TPVHandler, {
    
    /**
     * Busca productos según el texto ingresado
     */
    searchProducts() {
        const busqueda = this.elements.buscarProducto.value.trim();
        
        if (busqueda.length < 2) {
            this.hideSearchResults();
            return;
        }
        
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('buscar-productos', { termino: busqueda })
                .then(productos => {
                    this.showSearchResults(productos);
                })
                .catch(error => {
                    console.error('Error al buscar productos:', error);
                });
        }
    },
    
    /**
     * Muestra los resultados de búsqueda
     */
    showSearchResults(productos) {
        if (!this.elements.searchResults) return;
        
        this.elements.searchResults.innerHTML = '';
        this.elements.searchResults.style.display = 'block';
        
        if (productos.length === 0) {
            this.elements.searchResults.innerHTML = '<div class="search-no-results">No se encontraron productos</div>';
            return;
        }
        
        productos.forEach(producto => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.dataset.id = producto.id;
            
            item.innerHTML = `
                <div class="search-result-info">
                    <div class="search-result-name">${producto.nombre}</div>
                    <div class="search-result-price">${this.formatCurrency(producto.precio)}</div>
                </div>
                <div class="search-result-stock">Stock: ${producto.cantidad || 0}</div>
            `;
            
            item.addEventListener('click', () => {
                this.addToCart(producto.id);
                this.hideSearchResults();
                this.elements.buscarProducto.value = '';
            });
            
            this.elements.searchResults.appendChild(item);
        });
    },
    
    /**
     * Oculta los resultados de búsqueda
     */
    hideSearchResults() {
        if (this.elements.searchResults) {
            this.elements.searchResults.style.display = 'none';
        }
    },
    
    /**
     * Agrega un producto al carrito
     */
    addToCart(productoId) {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('obtener-producto', { id: productoId })
                .then(producto => {
                    if (!producto) {
                        console.error('Producto no encontrado:', productoId);
                        return;
                    }
                    
                    // Verificar stock disponible
                    if (producto.cantidad <= 0) {
                        alert('No hay stock disponible para este producto.');
                        return;
                    }
                    
                    // Crear un objeto serializable para evitar errores "An object could not be cloned"
                    const productoSerializable = {
                        id: producto.id,
                        codigo: producto.codigo || '',
                        nombre: producto.nombre || '',
                        precio: parseFloat(producto.precio) || 0,
                        cantidad: 1,
                        descuento: 0,
                        descuentoPorcentaje: 0,
                        subtotal: parseFloat(producto.precio) || 0
                    };
                    
                    // Verificar si el producto ya está en el carrito
                    const existingItemIndex = this.carrito.items.findIndex(item => item.id === productoSerializable.id);
                    
                    if (existingItemIndex !== -1) {
                        // Incrementar cantidad
                        this.carrito.items[existingItemIndex].cantidad += 1;
                        this.carrito.items[existingItemIndex].subtotal = 
                            this.carrito.items[existingItemIndex].precio * 
                            this.carrito.items[existingItemIndex].cantidad;
                    } else {
                        // Agregar nuevo item
                        this.carrito.items.push(productoSerializable);
                    }
                    
                    this.updateCartTotals();
                    this.renderCarrito();
                })
                .catch(error => {
                    console.error('Error al obtener producto:', error);
                });
        }
    },
    
    /**
     * Incrementa la cantidad de un producto en el carrito
     */
    increaseQuantity(index) {
        if (index >= 0 && index < this.carrito.items.length) {
            this.carrito.items[index].cantidad += 1;
            this.carrito.items[index].subtotal = 
                (this.carrito.items[index].precio * this.carrito.items[index].cantidad) -
                this.calculateItemDiscount(index);
            
            this.updateCartTotals();
            this.renderCarrito();
        }
    },
    
    /**
     * Decrementa la cantidad de un producto en el carrito
     */
    decreaseQuantity(index) {
        if (index >= 0 && index < this.carrito.items.length) {
            if (this.carrito.items[index].cantidad > 1) {
                this.carrito.items[index].cantidad -= 1;
                this.carrito.items[index].subtotal = 
                    (this.carrito.items[index].precio * this.carrito.items[index].cantidad) -
                    this.calculateItemDiscount(index);
                
                this.updateCartTotals();
                this.renderCarrito();
            } else {
                this.removeFromCart(index);
            }
        }
    },
    
    /**
     * Elimina un producto del carrito
     */
    removeFromCart(index) {
        if (index >= 0 && index < this.carrito.items.length) {
            this.carrito.items.splice(index, 1);
            this.updateCartTotals();
            this.renderCarrito();
        }
    },
    
    /**
     * Muestra el modal para aplicar descuento a un item
     */
    showDiscountModal(index) {
        const item = this.carrito.items[index];
        
        // Crear un modal para aplicar el descuento
        const modalHTML = `
            <div class="modal-descuento" id="modal-descuento">
                <div class="modal-content">
                    <h3>Aplicar descuento</h3>
                    <p>Producto: ${item.nombre}</p>
                    <p>Precio unitario: ${this.formatCurrency(item.precio)}</p>
                    <p>Cantidad: ${item.cantidad}</p>
                    <p>Subtotal: ${this.formatCurrency(item.precio * item.cantidad)}</p>
                    
                    <div class="discount-options">
                        <div class="discount-option">
                            <label>Descuento en valor:</label>
                            <input type="number" id="descuento-valor" min="0" step="0.01" value="${item.descuento || 0}">
                        </div>
                        <div class="discount-option">
                            <label>Descuento en %:</label>
                            <input type="number" id="descuento-porcentaje" min="0" max="100" step="0.1" value="${item.descuentoPorcentaje || 0}">
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button id="aplicar-descuento">Aplicar</button>
                        <button id="cancelar-descuento">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insertar el modal en el DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstChild);
        
        // Configurar eventos
        document.getElementById('aplicar-descuento').addEventListener('click', () => {
            const valorDescuento = parseFloat(document.getElementById('descuento-valor').value) || 0;
            const porcentajeDescuento = parseFloat(document.getElementById('descuento-porcentaje').value) || 0;
            
            if (porcentajeDescuento > 0) {
                this.applyItemDiscount(index, porcentajeDescuento, true);
            } else if (valorDescuento > 0) {
                this.applyItemDiscount(index, valorDescuento, false);
            }
            
            document.getElementById('modal-descuento').remove();
        });
        
        document.getElementById('cancelar-descuento').addEventListener('click', () => {
            document.getElementById('modal-descuento').remove();
        });
    },
    
    /**
     * Aplica un descuento a un item específico
     */
    applyItemDiscount(index, value, isPercentage) {
        if (index >= 0 && index < this.carrito.items.length) {
            const item = this.carrito.items[index];
            
            if (isPercentage) {
                item.descuentoPorcentaje = value;
                item.descuento = (item.precio * item.cantidad) * (value / 100);
            } else {
                item.descuento = value;
                item.descuentoPorcentaje = ((value / (item.precio * item.cantidad)) * 100).toFixed(2);
            }
            
            item.subtotal = (item.precio * item.cantidad) - item.descuento;
            
            this.updateCartTotals();
            this.renderCarrito();
        }
    },
    
    /**
     * Calcula el descuento aplicado a un item
     */
    calculateItemDiscount(index) {
        const item = this.carrito.items[index];
        
        if (item.descuentoPorcentaje > 0) {
            return (item.precio * item.cantidad) * (item.descuentoPorcentaje / 100);
        }
        
        return item.descuento || 0;
    },
    
    /**
     * Aplica un descuento al total de la venta
     */
    applyTotalDiscount() {
        const descuentoValue = parseFloat(this.elements.descuentoTotalInput.value) || 0;
        const isPorcentaje = this.elements.descuentoTotalPorcentaje.checked;
        
        if (isPorcentaje) {
            if (descuentoValue >= 0 && descuentoValue <= 100) {
                this.carrito.descuentoTotalPorcentaje = descuentoValue;
                this.carrito.descuentoTotal = this.carrito.subtotal * (descuentoValue / 100);
            }
        } else {
            if (descuentoValue >= 0 && descuentoValue <= this.carrito.subtotal) {
                this.carrito.descuentoTotal = descuentoValue;
                this.carrito.descuentoTotalPorcentaje = ((descuentoValue / this.carrito.subtotal) * 100).toFixed(2);
            }
        }
        
        this.updateCartTotals();
        this.renderCarrito();
    },
    
    /**
     * Actualiza los totales del carrito
     */
    updateCartTotals() {
        // Calcular subtotal (suma de subtotales de items)
        this.carrito.subtotal = this.carrito.items.reduce((total, item) => total + item.subtotal, 0);
        
        // Aplicar descuento total
        const subtotalConDescuento = this.carrito.subtotal - this.carrito.descuentoTotal;
        
        // Calculamos el total directamente (el precio ya incluye IVA)
        this.carrito.total = subtotalConDescuento;
        
        // Calcular el IVA como parte del precio (desglose)
        // El divisor es (1 + tasaIVA/100) para extraer el IVA del precio total
        // Por ejemplo: si el total es 121€ con 21% IVA, la base imponible es 100€ y el IVA es 21€
        const divisor = 1 + (this.config.tasaIVA / 100);
        const baseImponible = this.carrito.total / divisor;
        this.carrito.iva = this.carrito.total - baseImponible;
        
        // Guardamos también la base imponible para usarla en los tickets
        this.carrito.baseImponible = baseImponible;
    }
});

// Continuará en tpv-handler-parte3.js
