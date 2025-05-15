/**
 * Continuación del TPVHandler (Parte 3)
 * Esta parte contiene las funciones de pago, finalización de venta y generación de tickets
 */

// Extendemos TPVHandler con más métodos
Object.assign(TPVHandler, {
    
    /**
     * Establece el método de pago
     */
    setPaymentMethod(method) {
        this.carrito.metodoPago = method;
        
        // Actualizar UI
        this.elements.efectivoBtn.classList.toggle('activo', method === 'efectivo');
        this.elements.tarjetaBtn.classList.toggle('activo', method === 'tarjeta');
        this.elements.efectivoCampos.classList.toggle('mostrar', method === 'efectivo');
        
        if (method === 'efectivo') {
            this.elements.montoRecibido.focus();
        }
    },
    
    /**
     * Calcula el cambio a devolver
     */
    calculateChange() {
        const montoRecibido = parseFloat(this.elements.efectivoEntregado.value) || 0;
        if (isNaN(montoRecibido)) {
            this.elements.efectivoEntregado.value = '';
            this.carrito.montoRecibido = 0;
            this.carrito.cambio = 0;
            this.elements.cambioCalculado.textContent = this.formatCurrency(0);
            return;
        }
        
        this.carrito.montoRecibido = montoRecibido;
        this.carrito.cambio = Math.max(0, montoRecibido - this.carrito.total);
        
        // Actualizar UI
        if (this.elements.cambioCalculado) {
            this.elements.cambioCalculado.textContent = this.formatCurrency(this.carrito.cambio);
        }
        
        // Actualizar estado del botón de pago
        this.elements.btnPagar.disabled = this.carrito.metodoPago === 'efectivo' && montoRecibido < this.carrito.total;
    },

    // Añadir método para manejar el input del monto recibido
    handleMontoRecibido() {
        // Comprobar que el elemento existe
        const input = this.elements.efectivoEntregado;
        if (!input) {
            console.error('Elemento efectivoEntregado no encontrado');
            return;
        }
        
        console.log('Configurando evento para efectivoEntregado');
        
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^0-9.]/g, '');
            const parts = value.split('.');
            if (parts.length > 1) {
                parts[1] = parts[1].slice(0, 2); // Limitar a 2 decimales
            }
            e.target.value = parts.join('.');
            this.calculateChange();
        });
    },
    
    /**
     * Finaliza la venta actual
     */
    async finalizeSale() {
        console.log('🧯 finalizeSale triggered');
        console.log('Estado del carrito:', this.carrito);
        
        if (this.carrito.items.length === 0) {
            alert('El carrito está vacío. Agrega productos para finalizar la venta.');
            return;
        }
        
        // Verificar si se ha seleccionado un método de pago
        if (!this.carrito.metodoPago) {
            // Establecer efectivo como predeterminado si no se ha seleccionado
            this.carrito.metodoPago = 'efectivo';
            if (this.elements.metodoPago) {
                this.elements.metodoPago.value = 'efectivo';
                this.toggleEfectivoInput();
            }
        }
        
        // Si el método es efectivo, verificar monto recibido
        if (this.carrito.metodoPago === 'efectivo') {
            const montoRecibido = parseFloat(this.elements.efectivoEntregado.value) || 0;
            
            if (montoRecibido < this.carrito.total) {
                alert('El monto recibido es menor que el total a pagar.');
                this.elements.efectivoEntregado.focus();
                return;
            }
            
            // Actualizar montoRecibido en el carrito
            this.carrito.montoRecibido = montoRecibido;
            this.carrito.cambio = Math.max(0, montoRecibido - this.carrito.total);
        }
        
        // Preparar los datos de venta en un formato serializable
        const venta = {
            fecha: new Date().toISOString(),
            items: this.carrito.items.map(item => ({
                id: item.id,
                codigo: item.codigo,
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad,
                descuento: item.descuento,
                descuentoPorcentaje: item.descuentoPorcentaje,
                subtotal: item.subtotal
            })),
            subtotal: this.carrito.subtotal,
            descuento: this.carrito.descuentoTotal,
            descuentoPorcentaje: this.carrito.descuentoTotalPorcentaje,
            iva: this.carrito.iva,
            iva_porcentaje: this.config.tasaIVA, // Añadimos el porcentaje de IVA
            baseImponible: this.carrito.baseImponible, // Base imponible (precio sin IVA)
            total: this.carrito.total, // El total ya incluye IVA
            metodoPago: this.carrito.metodoPago,
            montoRecibido: this.carrito.montoRecibido,
            cambio: this.carrito.cambio
        };
        
        // Guardar la venta en ambos sistemas
        try {
            const success = await guardarVenta(venta);
            if (success) {
                alert('Venta registrada correctamente');
                this.printTicket(venta.fecha); // Usamos la fecha como ID temporal
                this.clearCart();
            }
        } catch (error) {
            console.error('Error al registrar venta:', error);
            alert('Error al registrar la venta: ' + error.message);
        }
    },
    
    /**
     * Imprime el ticket de venta
     */
    printTicket(ventaId) {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('imprimir-ticket', { ventaId })
                .then(result => {
                    // Mostrar una visualización del ticket
                    const ticketHTML = this.generateTicketHTML(result.venta, result.detalles);
                    this.showTicketPreview(ticketHTML);
                })
                .catch(error => {
                    console.error('Error al imprimir ticket:', error);
                });
        }
    },
    
    /**
     * Genera el HTML del ticket
     */
    generateTicketHTML(venta, detalles) {
        const fecha = new Date(venta.fecha).toLocaleString();
        const moneda = venta.moneda || 'EUR';
        const simbolo = moneda === 'EUR' ? '€' : moneda;
        
        let detallesHTML = '';
        detalles.forEach(detalle => {
            detallesHTML += `
                <tr>
                    <td>${detalle.nombre}</td>
                    <td>${detalle.cantidad}</td>
                    <td>${detalle.precio_unitario.toFixed(2)} ${simbolo}</td>
                    <td>${detalle.subtotal.toFixed(2)} ${simbolo}</td>
                </tr>
            `;
        });
        
        return `
            <div class="ticket">
                <div class="ticket-header">
                    <h2>ZAPATERÍA TPV</h2>
                    <p>Ticket de venta #${venta.id}</p>
                    <p>${fecha}</p>
                </div>
                
                <div class="ticket-body">
                    <table>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cant.</th>
                                <th>Precio</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detallesHTML}
                        </tbody>
                    </table>
                </div>
                
                <div class="ticket-footer">
                    <div class="ticket-summary">
                        <div class="summary-row total">
                            <span>TOTAL:</span>
                            <span>${venta.total.toFixed(2)} ${simbolo}</span>
                        </div>
                        ${venta.descuento > 0 ? `
                        <div class="summary-row">
                            <span>Descuento aplicado:</span>
                            <span>-${venta.descuento.toFixed(2)} ${simbolo}</span>
                        </div>
                        ` : ''}
                        <div class="summary-row">
                            <span>Base imponible:</span>
                            <span>${(venta.total - venta.iva).toFixed(2)} ${simbolo}</span>
                        </div>
                        <div class="summary-row">
                            <span>IVA (${venta.iva_porcentaje || '21'}%):</span>
                            <span>${venta.iva.toFixed(2)} ${simbolo}</span>
                        </div>
                        <div class="summary-info" style="font-size: 0.8em; margin-top: 5px; font-style: italic; text-align: center;">
                            <span>IVA incluido en el precio</span>
                        </div>
                        ${venta.forma_pago === 'efectivo' ? `
                        <div class="summary-row">
                            <span>Pagado:</span>
                            <span>${venta.monto_recibido.toFixed(2)} ${simbolo}</span>
                        </div>
                        <div class="summary-row">
                            <span>Cambio:</span>
                            <span>${venta.cambio.toFixed(2)} ${simbolo}</span>
                        </div>
                        ` : `
                        <div class="summary-row">
                            <span>Forma de pago:</span>
                            <span>Tarjeta</span>
                        </div>
                        `}
                    </div>
                    
                    <div class="ticket-message">
                        <p>¡Gracias por su compra!</p>
                        <p>Vuelva pronto</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Muestra una vista previa del ticket
     */
    showTicketPreview(ticketHTML) {
        // Crear un modal para mostrar el ticket
        const modalHTML = `
            <div class="modal-ticket" id="modal-ticket">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Vista previa del ticket</h3>
                        <button id="cerrar-ticket">×</button>
                    </div>
                    <div class="ticket-container">
                        ${ticketHTML}
                    </div>
                    <div class="modal-actions">
                        <button id="imprimir-ticket">Imprimir</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insertar el modal en el DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstChild);
        
        // Configurar eventos
        document.getElementById('cerrar-ticket').addEventListener('click', () => {
            document.getElementById('modal-ticket').remove();
        });
        
        document.getElementById('imprimir-ticket').addEventListener('click', () => {
            // Imprimir el ticket
            const ticketWindow = window.open('', '_blank');
            ticketWindow.document.write(`
                <html>
                    <head>
                        <title>Ticket de venta</title>
                        <style>
                            body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; }
                            .ticket { padding: 5mm; }
                            .ticket-header { text-align: center; margin-bottom: 5mm; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { text-align: left; padding: 1mm; }
                            .summary-row { display: flex; justify-content: space-between; margin: 1mm 0; }
                            .total { font-weight: bold; border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; }
                            .ticket-message { text-align: center; margin-top: 5mm; }
                        </style>
                    </head>
                    <body>
                        ${ticketHTML}
                    </body>
                </html>
            `);
            ticketWindow.document.close();
            ticketWindow.focus();
            ticketWindow.print();
        });
    },
    
    /**
     * Limpia el carrito actual
     */
    clearCart() {
        this.carrito = {
            items: [],
            subtotal: 0,
            iva: 0,
            total: 0,
            descuentoTotal: 0,
            descuentoTotalPorcentaje: 0,
            metodoPago: 'efectivo',
            montoRecibido: 0,
            cambio: 0
        };
        
        // Limpiar campos
        if (this.elements.montoRecibido) {
            this.elements.montoRecibido.value = '';
        }
        
        if (this.elements.descuentoTotalInput) {
            this.elements.descuentoTotalInput.value = '';
        }
        
        this.renderCarrito();
    },
    
    /**
     * Renderiza el contenido del carrito
     */
    renderCarrito() {
        if (!this.elements.carritoItems) return;
        
        // Mostrar mensaje si el carrito está vacío
        if (this.carrito.items.length === 0) {
            this.elements.carritoItems.innerHTML = '';
            if (this.elements.carritoVacio) {
                this.elements.carritoVacio.style.display = 'flex';
            }
        } else {
            if (this.elements.carritoVacio) {
                this.elements.carritoVacio.style.display = 'none';
            }
            
            this.elements.carritoItems.innerHTML = '';
            
            this.carrito.items.forEach((item, index) => {
                const itemElement = document.createElement('div');
                itemElement.className = 'carrito-item';
                itemElement.dataset.index = index;
                
                // Mostrar descuento si existe
                const descuentoHTML = item.descuento > 0 
                    ? `<div class="carrito-item-descuento">
                        <span>Descuento: -${this.formatCurrency(item.descuento)}</span>
                        <span>(${item.descuentoPorcentaje}%)</span>
                       </div>`
                    : '';
                
                itemElement.innerHTML = `
                    <div class="carrito-item-info">
                        <div class="carrito-item-nombre">${item.nombre}</div>
                        <div class="carrito-item-detalle">
                            <span>${this.formatCurrency(item.precio)} x ${item.cantidad}</span>
                            <span>${this.formatCurrency(item.subtotal)}</span>
                        </div>
                        ${descuentoHTML}
                    </div>
                    <div class="carrito-acciones">
                        <div class="carrito-cantidad">
                            <button class="btn-cantidad btn-cantidad-menos"><i class="fas fa-minus"></i></button>
                            <span class="cantidad-valor">${item.cantidad}</span>
                            <button class="btn-cantidad btn-cantidad-mas"><i class="fas fa-plus"></i></button>
                        </div>
                        <button class="btn-descuento" title="Aplicar descuento"><i class="fas fa-percent"></i></button>
                        <button class="btn-eliminar" title="Eliminar del carrito"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                
                this.elements.carritoItems.appendChild(itemElement);
            });
        }
        
        // Actualizar resumen
        if (this.elements.subtotal) {
            this.elements.subtotal.textContent = this.formatCurrency(this.carrito.subtotal);
        }
        
        if (this.elements.iva) {
            this.elements.iva.textContent = this.formatCurrency(this.carrito.iva);
        }
        
        if (this.elements.totalDescuento) {
            this.elements.totalDescuento.textContent = this.formatCurrency(this.carrito.descuentoTotal);
        }
        
        if (this.elements.total) {
            this.elements.total.textContent = this.formatCurrency(this.carrito.total);
        }
    },
    
    /**
     * Formatea un valor como moneda
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: this.config.moneda || 'EUR'
        }).format(value);
    }
});

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado - Inicializando TPVHandler');
    
    // Cargar primero las tres partes del TPVHandler
    const script1 = document.querySelector('script[src="js/tpv-handler.js"]');
    const script2 = document.querySelector('script[src="js/tpv-handler-parte2.js"]');
    const script3 = document.querySelector('script[src="js/tpv-handler-parte3.js"]');
    
    if (script1 && script2 && script3) {
        TPVHandler.init();
    } else {
        console.error('No se pudieron cargar todas las partes del TPVHandler.');
    }
});
