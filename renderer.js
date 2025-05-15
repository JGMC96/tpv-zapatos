const { ipcRenderer } = require('electron');

// Variables globales
let productos = [];
let carrito = [];
let metodoPago = 'efectivo';
let moneda = {
  codigo: 'EUR',
  simbolo: '€',
  tasa: 1
};
let IVA_PORCENTAJE = 21; // 21%
const tasasMoneda = {
  EUR: { simbolo: '€', tasa: 1 },
  USD: { simbolo: '$', tasa: 1.08 },
  GBP: { simbolo: '£', tasa: 0.86 }
};

// Elementos del DOM
const elementos = {
  // Búsqueda
  buscador: document.getElementById('buscador'),
  productosGrid: document.getElementById('productos-grid'),
  
  // Carrito
  carritoItems: document.getElementById('carrito-items'),
  subtotal: document.getElementById('subtotal'),
  iva: document.getElementById('iva'),
  total: document.getElementById('total'),
  
  // Pago
  metodoPagoBtns: document.querySelectorAll('.metodo-pago-btn'),
  efectivoCampos: document.getElementById('efectivo-campos'),
  montoRecibido: document.getElementById('monto-recibido'),
  cambio: document.getElementById('cambio'),
  
  // Botones
  btnPagar: document.getElementById('btn-pagar'),
  btnCancelarVenta: document.getElementById('btn-cancelar-venta'),
  btnVolver: document.getElementById('btn-volver'),
  btnNuevoProducto: document.getElementById('btn-nuevo-producto'),
  
  // Modales
  modalNuevoProducto: document.getElementById('modal-nuevo-producto'),
  formNuevoProducto: document.getElementById('form-nuevo-producto'),
  btnCancelarProducto: document.getElementById('btn-cancelar-producto'),
  
  // Contenedores
  infoProducto: document.querySelector('.info-producto') || document.body
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración persistente
  try {
    const config = await window.electronAPI ? window.electronAPI.invoke('obtener-config') : await window.ipcRenderer.invoke('obtener-config');
    if (config) {
      moneda.codigo = config.moneda || 'EUR';
      moneda.simbolo = tasasMoneda[moneda.codigo].simbolo;
      moneda.tasa = tasasMoneda[moneda.codigo].tasa;
      IVA_PORCENTAJE = config.tasaIVA || 21;
    }
  } catch (e) {
    console.error('No se pudo cargar la configuración:', e);
  }
  cargarProductos();
  configurarEventos();
  actualizarTotales();
  actualizarHora();
  setInterval(actualizarHora, 60000); // Actualizar cada minuto
});

// Cargar productos desde la base de datos
function cargarProductos() {
  ipcRenderer.invoke('obtener-productos')
    .then(resultados => {
      productos = resultados;
      mostrarProductos(productos);
    })
    .catch(error => {
      console.error('Error al cargar productos:', error);
      mostrarMensaje('Error al cargar los productos', 'error');
    });
}

// Mostrar productos en la cuadrícula
function mostrarProductos(listaProductos) {
  // Actualizar los precios de los productos según la moneda seleccionada
  // (Asegúrate de que los precios se muestran con el símbolo correcto)

  elementos.productosGrid.innerHTML = '';
  
  if (listaProductos.length === 0) {
    elementos.productosGrid.innerHTML = '<div class="mensaje">No se encontraron productos</div>';
    return;
  }
  
  listaProductos.forEach(producto => {
    const productoElement = document.createElement('div');
    productoElement.className = 'producto-card';
    productoElement.innerHTML = `
      <div class="producto-imagen">
        <i class="fas fa-shoe-prints"></i>
      </div>
      <div class="producto-nombre" title="${producto.nombre}">${producto.nombre}</div>
      <div class="producto-precio">${moneda.simbolo}${(producto.precio * moneda.tasa).toFixed(2)}</div>
      <div class="producto-stock">Stock: ${producto.stock}</div>
    `;
    
    productoElement.addEventListener('click', () => agregarAlCarrito(producto));
    elementos.productosGrid.appendChild(productoElement);
  });
}

// Agregar producto al carrito
function agregarAlCarrito(producto) {
  const productoExistente = carrito.find(item => item.id === producto.id);
  
  if (productoExistente) {
    if (productoExistente.cantidad < producto.stock) {
      productoExistente.cantidad++;
    } else {
      mostrarMensaje('No hay suficiente stock disponible', 'error');
      return;
    }
  } else {
    if (producto.stock > 0) {
      carrito.push({
        ...producto,
        cantidad: 1
      });
    } else {
      mostrarMensaje('Producto sin stock disponible', 'error');
      return;
    }
  }
  
  actualizarCarrito();
  mostrarMensaje(`${producto.nombre} agregado al carrito`, 'success');
}

// Actualizar la vista del carrito
function actualizarCarrito() {
  elementos.carritoItems.innerHTML = '';
  
  if (carrito.length === 0) {
    elementos.carritoItems.innerHTML = `
      <div class="carrito-vacio">
        <i class="fas fa-shopping-cart"></i>
        <p>El carrito está vacío</p>
        <p class="text-muted">Busca y selecciona productos para comenzar</p>
      </div>
    `;
    
    elementos.btnPagar.disabled = true;
    actualizarTotales();
    return;
  }
  
  // Mostrar productos en el carrito
  carrito.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'carrito-item';
    itemElement.innerHTML = `
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        <div class="carrito-item-detalle">
          <span>${moneda.simbolo}${item.precio.toFixed(2)} c/u</span>
          <span>${moneda.simbolo}${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
      </div>
      <div class="carrito-cantidad">
        <button class="btn-cantidad btn-disminuir" data-index="${index}">-</button>
        <input type="number" min="1" max="${item.stock}" value="${item.cantidad}" data-index="${index}">
        <button class="btn-cantidad btn-aumentar" data-index="${index}">+</button>
      </div>
      <button class="btn-eliminar" data-index="${index}">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    elementos.carritoItems.appendChild(itemElement);
  });
  
  // Configurar eventos para los botones de cantidad
  document.querySelectorAll('.btn-disminuir').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      modificarCantidad(index, -1);
    });
  });
  
  document.querySelectorAll('.btn-aumentar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      modificarCantidad(index, 1);
    });
  });
  
  // Configurar eventos para los inputs de cantidad
  document.querySelectorAll('.carrito-cantidad input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const nuevaCantidad = parseInt(e.target.value) || 1;
      
      if (nuevaCantidad < 1) {
        e.target.value = 1;
        return;
      }
      
      if (nuevaCantidad > carrito[index].stock) {
        mostrarMensaje('No hay suficiente stock disponible', 'error');
        e.target.value = carrito[index].cantidad;
        return;
      }
      
      carrito[index].cantidad = nuevaCantidad;
      actualizarCarrito();
    });
  });
  
  // Configurar eventos para los botones de eliminar
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      eliminarDelCarrito(index);
    });
  });
  
  elementos.btnPagar.disabled = false;
  actualizarTotales();
}

// Modificar cantidad de un producto en el carrito
function modificarCantidad(index, cambio) {
  const nuevaCantidad = carrito[index].cantidad + cambio;
  
  if (nuevaCantidad < 1) {
    eliminarDelCarrito(index);
    return;
  }
  
  if (nuevaCantidad > carrito[index].stock) {
    mostrarMensaje('No hay suficiente stock disponible', 'error');
    return;
  }
  
  carrito[index].cantidad = nuevaCantidad;
  actualizarCarrito();
}

// Eliminar producto del carrito
function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarCarrito();
}

// Actualizar totales de la venta
function actualizarTotales() {
  // Total con IVA incluido
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0) * moneda.tasa;
  // Base imponible
  const base = total / (1 + IVA_PORCENTAJE / 100);
  // IVA calculado
  const iva = total - base;
  
  elementos.subtotal.textContent = `${moneda.simbolo}${base.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  elementos.iva.textContent = `${moneda.simbolo}${iva.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  elementos.total.textContent = `${moneda.simbolo}${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Actualizar cambio si el método de pago es efectivo
  if (metodoPago === 'efectivo') {
    calcularCambio();
  }
}

// Mostrar modal de nuevo producto
function mostrarModalNuevoProducto() {
  if (elementos.modalNuevoProducto) {
    elementos.modalNuevoProducto.style.display = 'flex';
    document.getElementById('nuevo-nombre').focus();
  }
}

// Ocultar modal de nuevo producto
function ocultarModalNuevoProducto() {
  if (elementos.modalNuevoProducto) {
    elementos.modalNuevoProducto.style.display = 'none';
    elementos.formNuevoProducto.reset();
  }
}

// Configurar eventos de la interfaz
function configurarEventos() {
  // Selector de moneda
  const selectorMoneda = document.getElementById('selector-moneda');
  if (selectorMoneda) {
    selectorMoneda.value = moneda.codigo;
    selectorMoneda.addEventListener('change', async (e) => {
      const val = e.target.value;
      moneda.codigo = val;
      moneda.simbolo = tasasMoneda[val].simbolo;
      moneda.tasa = tasasMoneda[val].tasa;
      actualizarTotales();
      mostrarProductos(productos);
      // Guardar configuración
      try {
        await window.electronAPI ? window.electronAPI.invoke('guardar-config', { moneda: moneda.codigo, tasaIVA: IVA_PORCENTAJE }) : window.ipcRenderer.invoke('guardar-config', { moneda: moneda.codigo, tasaIVA: IVA_PORCENTAJE });
      } catch (e) {
        console.error('No se pudo guardar la configuración:', e);
      }
    });
  }
  // Verificar en qué página estamos
  const esPaginaVentas = document.getElementById('productos-grid');
  const esPaginaProductos = document.getElementById('lista-productos');
  
  // Configurar eventos para la página de ventas
  if (esPaginaVentas) {
    console.log('Configurando eventos para la página de ventas');
    
    // Configurar botón de nuevo producto
    if (elementos.btnNuevoProducto) {
      elementos.btnNuevoProducto.addEventListener('click', mostrarModalNuevoProducto);
    }
    
    // Configurar formulario de nuevo producto
    if (elementos.formNuevoProducto) {
      elementos.formNuevoProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Deshabilitar el botón de guardar para evitar múltiples envíos
        const submitButton = e.target.querySelector('button[type="submit"]');
        const submitButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        try {
          const nombre = document.getElementById('nuevo-nombre').value.trim();
          const precio = parseFloat(document.getElementById('nuevo-precio').value);
          const stock = parseInt(document.getElementById('nuevo-stock').value) || 0;
          const codigo = document.getElementById('nuevo-codigo').value.trim();
          
          // Validaciones del lado del cliente
          if (!nombre) {
            throw new Error('El nombre del producto es obligatorio');
          }
          
          if (isNaN(precio) || precio <= 0) {
            throw new Error('El precio debe ser un número mayor a cero');
          }
          
          if (isNaN(stock) || stock < 0) {
            throw new Error('El stock no puede ser negativo');
          }
          
          // Crear el objeto del nuevo producto
          const nuevoProducto = {
            nombre,
            precio,
            stock,
            codigo_barras: codigo || null
          };
          
          console.log('Enviando producto al servidor:', nuevoProducto);
          
          // Guardar el producto en la base de datos
          const productoGuardado = await ipcRenderer.invoke('guardar-producto', nuevoProducto);
          
          console.log('Producto guardado recibido:', productoGuardado);
          
          if (!productoGuardado || !productoGuardado.id) {
            throw new Error('No se recibió una respuesta válida del servidor');
          }
          
          // Actualizar la lista de productos
          productos.push(productoGuardado);
          mostrarProductos(productos);
          
          // Cerrar el modal y limpiar el formulario
          ocultarModalNuevoProducto();
          
          // Mostrar mensaje de éxito
          mostrarMensaje(`Producto "${productoGuardado.nombre}" agregado correctamente`, 'success');
          
          // Agregar automáticamente al carrito
          agregarAlCarrito(productoGuardado);
          
        } catch (error) {
          console.error('Error al guardar el producto:', error);
          let mensajeError = 'Error al guardar el producto';
          
          if (error.message.includes('código de barras')) {
            mensajeError = 'Ya existe un producto con este código de barras';
          } else if (error.message) {
            mensajeError = error.message;
          }
          
          mostrarMensaje(mensajeError, 'error');
        } finally {
          // Restaurar el botón de guardar
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = submitButtonText;
          }
        }
      });
    }
    
    // Configurar botón de cancelar en el modal de nuevo producto
    if (elementos.btnCancelarProducto) {
      elementos.btnCancelarProducto.addEventListener('click', ocultarModalNuevoProducto);
    }
    
    // Configurar buscador si existe
    if (elementos.buscador) {
      elementos.buscador.addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase();
        
        if (busqueda.trim() === '') {
          mostrarProductos(productos);
          return;
        }
        
        const resultados = productos.filter(producto => 
          producto.nombre.toLowerCase().includes(busqueda) || 
          (producto.codigo_barras && producto.codigo_barras.toLowerCase().includes(busqueda))
        );
    
        mostrarProductos(resultados);
      });
      
      // Configurar tecla Enter en el buscador
      elementos.buscador.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const busqueda = elementos.buscador.value.trim();
          if (busqueda) {
            buscarProductoPorCodigo(busqueda);
          }
        }
      });
    }
    
    // Métodos de pago
    if (elementos.metodoPagoBtns) {
      elementos.metodoPagoBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          // Remover clase activa de todos los botones
          elementos.metodoPagoBtns.forEach(b => b.classList.remove('activo'));
          // Agregar clase activa al botón clickeado
          btn.classList.add('activo');
          
          // Actualizar método de pago
          metodoPago = btn.dataset.metodo;
          
          // Mostrar/ocultar campos según el método de pago
          if (metodoPago === 'efectivo') {
            elementos.efectivoCampos.classList.add('mostrar');
          } else {
            elementos.efectivoCampos.classList.remove('mostrar');
          }
        });
      });
    }
    
    // Calcular cambio cuando se ingresa el monto recibido
    if (elementos.montoRecibido) {
      elementos.montoRecibido.addEventListener('input', calcularCambio);
    }
    
    // Botón de pagar
    if (elementos.btnPagar) {
      elementos.btnPagar.addEventListener('click', () => {
        if (carrito.length === 0) {
          mostrarMensaje('No hay productos en el carrito', 'error');
          return;
        }
        
        if (metodoPago === 'efectivo') {
          const montoRecibido = parseFloat(elementos.montoRecibido.value) || 0;
          const total = parseFloat(elementos.total.textContent.replace('$', ''));
          
          if (montoRecibido < total) {
            mostrarMensaje('El monto recibido es insuficiente', 'error');
            return;
          }
        }
        
        // Mostrar confirmación
        if (confirm('¿Desea confirmar la venta?')) {
          procesarVenta();
        }
      });
    }
    
    // Botón de cancelar venta
    if (elementos.btnCancelarVenta) {
      elementos.btnCancelarVenta.addEventListener('click', () => {
        if (carrito.length > 0 && confirm('¿Está seguro de cancelar la venta actual?')) {
          carrito = [];
          actualizarCarrito();
          elementos.montoRecibido.value = '';
          elementos.cambio.textContent = '$0.00';
          elementos.buscador.value = '';
          elementos.buscador.focus();
        }
      });
    }
    
    // Botón para volver al menú principal
    if (elementos.btnVolver) {
      elementos.btnVolver.addEventListener('click', () => {
        if (carrito.length > 0) {
          if (confirm('¿Está seguro de salir? Se perderá la venta actual.')) {
            window.location.href = 'menu.html';
          }
        } else {
          window.location.href = 'menu.html';
        }
      });
    }
  }
  
  // Configurar eventos para la página de productos
  if (esPaginaProductos) {
    console.log('Configurando eventos para la página de productos');
    
    // Botón de volver al menú
    const btnVolver = document.getElementById('btnVolver');
    if (btnVolver) {
      btnVolver.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
    
    // Botón de nuevo producto
    const btnNuevo = document.getElementById('btnNuevo');
    if (btnNuevo) {
      btnNuevo.addEventListener('click', () => {
        mostrarFormularioProducto();
      });
    }
  }
}

// Procesar la venta
function procesarVenta() {
  const venta = {
    fecha: new Date().toISOString(),
    productos: carrito.map(item => ({
      id: item.id,
      cantidad: item.cantidad,
      precio: item.precio
    })),
    subtotal: parseFloat(elementos.subtotal.textContent.replace('$', '')),
    iva: parseFloat(elementos.iva.textContent.replace('$', '')),
    total: parseFloat(elementos.total.textContent.replace('$', '')),
    metodoPago: metodoPago,
    montoRecibido: metodoPago === 'efectivo' ? parseFloat(elementos.montoRecibido.value) : null,
    cambio: metodoPago === 'efectivo' ? parseFloat(elementos.cambio.textContent.replace('$', '')) : null
  };
  
  ipcRenderer.invoke('registrar-venta', venta)
    .then(() => {
      mostrarMensaje('Venta registrada correctamente', 'success');
      
      // Limpiar carrito y campos
      carrito = [];
      actualizarCarrito();
      elementos.montoRecibido.value = '';
      elementos.cambio.textContent = '$0.00';
      elementos.buscador.value = '';
      elementos.buscador.focus();
      
      // Recargar productos para actualizar stock
      cargarProductos();
    })
    .catch(error => {
      console.error('Error al registrar la venta:', error);
      mostrarMensaje('Error al registrar la venta', 'error');
    });
}

// Calcular el cambio a devolver
function calcularCambio() {
  const total = parseFloat(elementos.total.textContent.replace('$', '')) || 0;
  const montoRecibido = parseFloat(elementos.montoRecibido.value) || 0;
  const cambio = montoRecibido - total;
  
  if (cambio >= 0) {
    elementos.cambio.textContent = `${moneda.simbolo}${cambio.toFixed(2)}`;
    elementos.cambio.style.color = '#2ecc71'; // Verde
  } else {
    elementos.cambio.textContent = `${moneda.simbolo}${Math.abs(cambio).toFixed(2)}`;
    elementos.cambio.style.color = '#e74c3c'; // Rojo
  }
}

// Buscar producto por código de barras o nombre
function buscarProductoPorCodigo(codigo) {
  const productoEncontrado = productos.find(p => 
    p.codigo === codigo || p.nombre.toLowerCase().includes(codigo.toLowerCase())
  );
  
  if (productoEncontrado) {
    agregarAlCarrito(productoEncontrado);
    elementos.buscador.value = '';
    elementos.buscador.focus();
  } else {
    mostrarMensaje('Producto no encontrado', 'error');
  }
}

// Mostrar mensaje al usuario
function mostrarMensaje(mensaje, tipo = 'info') {
  // Implementar lógica para mostrar mensajes al usuario
  // Esto puede ser un toast, alerta o notificación en la interfaz
  console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
  
  // Ejemplo básico de notificación
  const notificacion = document.createElement('div');
  notificacion.className = `notificacion ${tipo}`;
  notificacion.textContent = mensaje;
  
  document.body.appendChild(notificacion);
  
  // Eliminar la notificación después de 3 segundos
  setTimeout(() => {
    notificacion.classList.add('mostrar');
    
    setTimeout(() => {
      notificacion.classList.remove('mostrar');
      
      setTimeout(() => {
        document.body.removeChild(notificacion);
      }, 300);
    }, 3000);
  }, 100);
}

// Inicialización específica para la página de productos
// Función para inicializar la página de productos
function inicializarProductos() {
  // Definimos los elementos como variables globales dentro de esta función
  // para evitar problemas de acceso desde otras funciones
  // Esto resuelve errores como "imagenPreview is not defined"
  window.formProducto = document.getElementById('form-producto');
  window.btnNuevo = document.getElementById('btnNuevo');
  window.btnVolver = document.getElementById('btnVolver');
  window.modal = document.getElementById('modal-producto');
  window.btnCancelar = document.getElementById('btnCancelar');
  window.inputImagen = document.getElementById('imagen');
  window.imagenPreview = document.getElementById('imagen-preview');
  window.imagenPreviewImg = document.getElementById('imagen-preview-img');
  
  console.log('Inicializando página de productos...');
  console.log('Elementos encontrados:', {
    formProducto: !!window.formProducto,
    modal: !!window.modal,
    btnNuevo: !!window.btnNuevo,
    btnCancelar: !!window.btnCancelar
  });
  
  // Función para limpiar el formulario
  const limpiarFormulario = () => {
    try {
      console.log('Limpiando formulario...');
      if (formProducto) {
        formProducto.reset();
        const idField = document.getElementById('producto-id');
        if (idField) idField.value = '';
        
        if (imagenPreview) imagenPreview.style.display = 'none';
        if (imagenPreviewImg) imagenPreviewImg.src = '#';
        
        console.log('Formulario limpiado correctamente');
      } else {
        console.warn('No se encontró el formulario para limpiar');
      }
    } catch (error) {
      console.error('Error al limpiar el formulario:', error);
    }
  };

  // Función para mostrar el formulario de producto
  function mostrarFormularioProducto(producto = null) {
    const modal = document.getElementById('modal-producto');
    const form = document.getElementById('form-producto');
    
    if (!modal || !form) return;
    
    // Configurar el formulario según si es nuevo o edición
    if (producto) {
      document.getElementById('modal-titulo').textContent = 'Editar Producto';
      document.getElementById('producto-id').value = producto.id;
      document.getElementById('codigo').value = producto.codigo || '';
      document.getElementById('nombre').value = producto.nombre || '';
      document.getElementById('descripcion').value = producto.descripcion || '';
      document.getElementById('precio').value = (producto.precio || 0).toFixed(2);
      document.getElementById('cantidad').value = producto.cantidad || 0;
      
      // Configurar categoría si existe
      if (producto.categoriaId) {
        const selectCategoria = document.getElementById('categoria');
        if (selectCategoria) {
          selectCategoria.value = producto.categoriaId;
        }
      }
      
      // Mostrar imagen si existe
      if (producto.imagen) {
        const imagenPreview = document.getElementById('imagen-preview');
        const imagenPreviewImg = document.getElementById('imagen-preview-img');
        if (imagenPreview && imagenPreviewImg) {
          imagenPreviewImg.src = producto.imagen;
          imagenPreview.style.display = 'block';
        }
      }
    } else {
      // Restablecer formulario para nuevo producto
      form.reset();
      document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
      document.getElementById('producto-id').value = '';
      
      // Ocultar vista previa de imagen
      const imagenPreview = document.getElementById('imagen-preview');
      if (imagenPreview) {
        imagenPreview.style.display = 'none';
      }
    }
    
    // Mostrar el modal
    modal.style.display = 'flex';
  }
  
  // Función para guardar un producto
  async function guardarProducto(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const producto = {};
    
    // Recopilar datos del formulario
    formData.forEach((value, key) => {
      producto[key] = value;
    });
      <div class="producto-acciones">
        <button class="btn-editar" data-id="${producto.id}">✏️</button>
        <button class="btn-eliminar" data-id="${producto.id}">🗑️</button>
      </div>
    `;
    
    productoElement.querySelector('.btn-editar').addEventListener('click', () => {
      editarProducto(producto.id);
    });
    
    productoElement.querySelector('.btn-eliminar').addEventListener('click', () => {
      eliminarProducto(producto.id);
    });
    
    elementos.listaProductos.appendChild(productoElement);
  });
}

function mostrarFormularioProducto(producto = null) {
  const form = elementos.formProducto;
  
  if (producto) {
    document.getElementById('modal-titulo').textContent = 'Editar Producto';
    document.getElementById('producto-id').value = producto.id;
    document.getElementById('codigo').value = producto.codigo || '';
    document.getElementById('nombre').value = producto.nombre || '';
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('precio').value = producto.precio || '';
    document.getElementById('cantidad').value = producto.cantidad || '';
  } else {
    document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
    form.reset();
  }
  
  elementos.modal.style.display = 'flex';
}

function ocultarFormulario() {
  elementos.modal.style.display = 'none';
  elementos.formProducto.reset();
}

async function editarProducto(id) {
  const producto = productos.find(p => p.id === id);
  if (producto) {
    mostrarFormularioProducto(producto);
  }
}

async function eliminarProducto(id) {
  if (confirm('¿Estás seguro de eliminar este producto?')) {
    try {
      await ipcRenderer.invoke('eliminar-producto', id);
      await cargarProductos();
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      alert('Error al eliminar el producto');
    }
  }
}

// Utilidades
function actualizarFechaHora() {
  const ahora = new Date();
  const opciones = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const fechaHoraElement = document.getElementById('fecha-hora');
  if (fechaHoraElement) {
    fechaHoraElement.textContent = ahora.toLocaleDateString('es-ES', opciones);
  }
}

// Manejar clics fuera del modal para cerrarlo
window.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-producto');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  const paginaActual = window.location.pathname.split('/').pop();
  console.log('Página actual:', paginaActual);
  
  // Inicializar botones de gestión de productos
  if (document.getElementById('btnNuevo')) {
    document.getElementById('btnNuevo').addEventListener('click', () => {
      mostrarFormularioProducto();
    });
  }
  
  // Botón para volver
  if (document.getElementById('btnVolver')) {
    document.getElementById('btnVolver').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  // Inicializar búsqueda y filtros
  const btnBuscar = document.getElementById('btnBuscar');
  const inputBusqueda = document.getElementById('buscarProducto');
  
  if (btnBuscar && inputBusqueda) {
    btnBuscar.addEventListener('click', buscarProducto);
    inputBusqueda.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') buscarProducto();
    });
  }
  
  // Botón para aplicar filtros
  const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
  if (btnAplicarFiltros) {
    btnAplicarFiltros.addEventListener('click', cargarProductos);
  }
  
  // Botón para limpiar filtros
  const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', () => {
      if (inputBusqueda) inputBusqueda.value = '';
      const filtroCategoria = document.getElementById('filtroCategoria');
      const ordenarPor = document.getElementById('ordenarPor');
      
      if (filtroCategoria) filtroCategoria.value = '';
      if (ordenarPor) ordenarPor.value = 'nombre';
      
      cargarProductos();
    });
  }
  
  // Inicializar según la página actual
  if (paginaActual === 'index.html' || paginaActual === '') {
    inicializarVentas();
  } else if (paginaActual === 'productos.html') {
    console.log('Inicializando página de productos');
    inicializarProductos();
    cargarProductos();
  } else if (paginaActual === 'ventas.html') {
    inicializarVentas();
  } else if (paginaActual === 'inventario.html') {
    inicializarInventario();
  } else if (paginaActual === 'configuracion.html') {
    inicializarConfiguracion();
  }
  
  // Delegación de eventos para botones dinámicos
  document.addEventListener('click', (e) => {
    // Manejar clics en botones de editar
    if (e.target.closest('.btn-editar')) {
      const btn = e.target.closest('.btn-editar');
      e.stopPropagation();
      editarProducto(parseInt(btn.dataset.id));
    }
    
    // Manejar clics en botones de eliminar
    if (e.target.closest('.btn-eliminar')) {
      const btn = e.target.closest('.btn-eliminar');
      e.stopPropagation();
      eliminarProducto(parseInt(btn.dataset.id));
    }
  });
  
  // Configurar formulario de producto
  const formProducto = document.getElementById('form-producto');
  if (formProducto) {
    formProducto.addEventListener('submit', guardarProducto);
  }
  
  // Configurar botón de cancelar en el modal
  const btnCancelar = document.querySelector('#modal-producto .btn-cancelar');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('modal-producto').style.display = 'none';
    });
  }
  
  // Cargar categorías al iniciar
  cargarCategorias();
});

// Función para cargar categorías
async function cargarCategorias() {
  try {
    const categorias = await ipcRenderer.invoke('obtener-categorias');
    const selectCategoria = document.getElementById('categoria');
    const selectFiltroCategoria = document.getElementById('filtroCategoria');
    
    // Actualizar selector de categorías en el formulario
    if (selectCategoria) {
      selectCategoria.innerHTML = '<option value="">Seleccione una categoría</option>';
      categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.id;
        option.textContent = categoria.nombre;
        selectCategoria.appendChild(option);
      });
    }
    
    // Actualizar selector de categorías en el filtro
    if (selectFiltroCategoria) {
      selectFiltroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
      categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.id;
        option.textContent = categoria.nombre;
        selectFiltroCategoria.appendChild(option);
      });
    }
    
    return categorias;
  } catch (error) {
    console.error('Error al cargar categorías:', error);
    mostrarMensaje('Error al cargar las categorías', 'error');
    return [];
  }
}

// Función para crear el HTML de un producto
function crearHTMLProducto(producto) {
  // Asegurarnos de que los valores no sean undefined
  const nombre = producto.nombre || 'Sin nombre';
  const codigo = producto.codigo || 'N/A';
  const precio = producto.precio ? (producto.precio * moneda.tasa).toFixed(2) : '0.00';
  const simbolo = moneda.simbolo || '€';
  
  // Crear el HTML de la imagen
  let imagenHTML = '';
  if (producto.imagen) {
    imagenHTML = '<img src="' + producto.imagen + '" alt="' + nombre + '">';
  } else {
    imagenHTML = '<div class="sin-imagen"><i class="fas fa-box"></i></div>';
  }
  
  // Crear el HTML de la categoría si existe
  let categoriaHTML = '';
  if (producto.categoria) {
    categoriaHTML = '<span class="producto-categoria">' + producto.categoria + '</span>';
  }
  
  // Construir el HTML completo
  const htmlParts = [
    '<div class="producto-imagen">',
    imagenHTML,
    '</div>',
    '<div class="producto-info">',
    '<h3>', nombre, '</h3>',
    '<p class="producto-codigo">Código: ', codigo, '</p>',
    '<p class="producto-precio">', precio, ' ', simbolo, '</p>',
    categoriaHTML,
    '<div class="producto-acciones">',
    '<button class="btn btn-sm btn-primary btn-editar" data-id="', producto.id, '">',
    '<i class="fas fa-edit"></i> Editar',
    '</button>',
    '<button class="btn btn-sm btn-danger btn-eliminar" data-id="', producto.id, '">',
    '<i class="fas fa-trash"></i> Eliminar',
    '</button>',
    '</div>',
    '</div>'
  ];
  return htmlParts.join('');
}

// Función para cargar productos
async function cargarProductos() {
  try {
    const busqueda = document.getElementById('buscarProducto')?.value || '';
    const categoriaId = document.getElementById('filtroCategoria')?.value || '';
    const ordenarPor = document.getElementById('ordenarPor')?.value || 'nombre';
    
    const listaProductos = document.getElementById('lista-productos');
    if (!listaProductos) return;
    
    // Mostrar indicador de carga
    listaProductos.innerHTML = '<div class="loading">Cargando productos...</div>';
    
    // Obtener productos
    const productos = await ipcRenderer.invoke('obtener-productos', {
      busqueda: busqueda,
      categoriaId: categoriaId || null,
      ordenarPor: ordenarPor
    });
    
    // Limpiar lista
    listaProductos.innerHTML = '';
    
    if (!productos || productos.length === 0) {
      listaProductos.innerHTML = [
        '<div class="alert alert-info">',
        'No se encontraron productos',
        '</div>'
      ].join('');
      return;
    }
    
    // Crear contenedor de productos
    const grid = document.createElement('div');
    grid.className = 'productos-grid';
    
    // Agregar cada producto al grid
    productos.forEach(function(producto) {
      const productoElement = document.createElement('div');
      productoElement.className = 'producto-card';
      productoElement.dataset.id = producto.id;
      productoElement.innerHTML = crearHTMLProducto(producto);
      grid.appendChild(productoElement);
    });
    
    listaProductos.appendChild(grid);
    
  } catch (error) {
    console.error('Error al cargar productos:', error);
    const listaProductos = document.getElementById('lista-productos');
    if (listaProductos) {
      listaProductos.innerHTML = [
        '<div class="alert alert-danger">',
        'Error al cargar los productos. Por favor, intente nuevamente.',
        '</div>'
      ].join('');
    }
  }
}

// Función para mostrar el formulario de producto
function mostrarFormularioProducto(producto = null) {
  const modal = document.getElementById('modal-producto');
  const form = document.getElementById('form-producto');
  
  if (!modal || !form) return;
  
  // Configurar el formulario según si es nuevo o edición
  if (producto) {
    document.getElementById('modal-titulo').textContent = 'Editar Producto';
    document.getElementById('producto-id').value = producto.id;
    document.getElementById('codigo').value = producto.codigo || '';
    document.getElementById('nombre').value = producto.nombre || '';
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('precio').value = (producto.precio || 0).toFixed(2);
    document.getElementById('cantidad').value = producto.cantidad || 0;
    
    // Configurar categoría si existe
    if (producto.categoriaId) {
      const selectCategoria = document.getElementById('categoria');
      if (selectCategoria) {
        selectCategoria.value = producto.categoriaId;
      }
    }
    
    // Mostrar imagen si existe
    if (producto.imagen) {
      const imagenPreview = document.getElementById('imagen-preview');
      const imagenPreviewImg = document.getElementById('imagen-preview-img');
      if (imagenPreview && imagenPreviewImg) {
        imagenPreviewImg.src = producto.imagen;
        imagenPreview.style.display = 'block';
      }
    }
  } else {
    // Restablecer formulario para nuevo producto
    form.reset();
    document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
    document.getElementById('producto-id').value = '';
    
    // Ocultar vista previa de imagen
    const imagenPreview = document.getElementById('imagen-preview');
    if (imagenPreview) {
      imagenPreview.style.display = 'none';
    }
  }
  
  // Mostrar el modal
  modal.style.display = 'flex';
}

// Función para guardar un producto
async function guardarProducto(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const producto = {};
  
  // Recopilar datos del formulario
  formData.forEach((value, key) => {
    producto[key] = value;
  });
  
  // Validar campos requeridos
  if (!producto.nombre || !producto.precio) {
    mostrarMensaje('Por favor complete todos los campos requeridos', 'error');
    return;
  }
  
  try {
    // Convertir tipos de datos
    producto.precio = parseFloat(producto.precio);
    producto.cantidad = parseInt(producto.cantidad) || 0;
    
    // Manejar la imagen si se cargó una
    const inputImagen = document.getElementById('imagen');
    if (inputImagen && inputImagen.files.length > 0) {
      // Aquí podrías procesar la imagen si es necesario
      // Por ahora, solo mostramos un mensaje
      console.log('Imagen seleccionada:', inputImagen.files[0].name);
      // Nota: Necesitarás implementar la lógica para manejar la imagen
    }
    
    // Determinar si es un nuevo producto o una actualización
    const esNuevo = !producto.id;
    
    // Llamar al IPC correspondiente
    let resultado;
    if (esNuevo) {
      resultado = await ipcRenderer.invoke('agregar-producto', producto);
    } else {
      resultado = await ipcRenderer.invoke('actualizar-producto', producto);
    }
    
    // Mostrar mensaje de éxito
    mostrarMensaje(resultado.mensaje || 'Producto guardado correctamente', 'success');
    
    // Cerrar el modal y actualizar la lista
    document.getElementById('modal-producto').style.display = 'none';
    await cargarProductos();
    
  } catch (error) {
    console.error('Error al guardar el producto:', error);
    mostrarMensaje('Error al guardar el producto: ' + error.message, 'error');
  }
}

// Función para buscar productos
function buscarProducto() {
  return cargarProductos();
}

// Función para editar un producto
async function editarProducto(id) {
  try {
    const producto = await ipcRenderer.invoke('obtener-producto', id);
    if (producto) {
      mostrarFormularioProducto(producto);
    } else {
      mostrarMensaje('No se pudo cargar el producto', 'error');
    }
  } catch (error) {
    console.error('Error al cargar el producto:', error);
    mostrarMensaje('Error al cargar el producto', 'error');
  }
}

// Función para eliminar un producto
async function eliminarProducto(id) {
  if (!confirm('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
    return;
  }
  
  try {
    const resultado = await ipcRenderer.invoke('eliminar-producto', id);
    mostrarMensaje(resultado.mensaje || 'Producto eliminado correctamente', 'success');
    await cargarProductos();
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    mostrarMensaje('Error al eliminar el producto: ' + error.message, 'error');
  }
}
