/**
 * Manejador específico para la página de productos
 * Este archivo garantiza que todos los botones y eventos de la página de productos
 * funcionen correctamente independientemente de otros cambios en el código.
 */

const ProductosHandler = {
    // Elementos del DOM
    elements: {},
    
    /**
     * Inicializa el manejador de productos
     */
    init() {
        console.log('Inicializando manejador de productos...');
        
        // Cargar referencias a elementos del DOM
        this.loadElements();
        
        // Configurar eventos
        this.setupEvents();
        
        // Cargar productos y categorías
        this.loadData();
        
        console.log('Manejador de productos inicializado correctamente');
    },
    
    /**
     * Carga referencias a elementos del DOM
     */
    loadElements() {
        this.elements = {
            btnNuevo: document.getElementById('btnNuevo'),
            btnVolver: document.getElementById('btnVolver'),
            btnBuscar: document.getElementById('btnBuscar'),
            btnAplicarFiltros: document.getElementById('btnAplicarFiltros'),
            btnLimpiarFiltros: document.getElementById('btnLimpiarFiltros'),
            formProducto: document.getElementById('form-producto'),
            modalProducto: document.getElementById('modal-producto'),
            buscarProducto: document.getElementById('buscarProducto'),
            filtroCategoria: document.getElementById('filtroCategoria'),
            ordenarPor: document.getElementById('ordenarPor'),
            listaProductos: document.getElementById('lista-productos')
        };
        
        // Verificar si se encontraron los elementos
        const missingElements = Object.entries(this.elements)
            .filter(([key, el]) => !el)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.warn('Elementos no encontrados:', missingElements.join(', '));
        }
        
        console.log('Elementos cargados:', Object.keys(this.elements).join(', '));
    },
    
    /**
     * Configura eventos para los elementos
     */
    setupEvents() {
        console.log('Configurando eventos...');
        
        // Botón Nuevo Producto
        if (this.elements.btnNuevo) {
            this.elements.btnNuevo.addEventListener('click', () => {
                console.log('Clic en Nuevo Producto');
                if (typeof mostrarFormularioProducto === 'function') {
                    mostrarFormularioProducto();
                } else {
                    this.showModal();
                }
            });
            console.log('Evento configurado: btnNuevo');
        }
        
        // Botón Volver
        if (this.elements.btnVolver) {
            this.elements.btnVolver.addEventListener('click', () => {
                console.log('Clic en Volver');
                window.location.href = 'menu.html';
            });
            console.log('Evento configurado: btnVolver');
        }
        
        // Botón Buscar
        if (this.elements.btnBuscar) {
            this.elements.btnBuscar.addEventListener('click', () => {
                console.log('Clic en Buscar');
                if (typeof buscarProducto === 'function') {
                    buscarProducto();
                } else {
                    this.searchProducts();
                }
            });
            console.log('Evento configurado: btnBuscar');
        }
        
        // Campo de búsqueda (tecla Enter)
        if (this.elements.buscarProducto) {
            this.elements.buscarProducto.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter en campo de búsqueda');
                    if (typeof buscarProducto === 'function') {
                        buscarProducto();
                    } else {
                        this.searchProducts();
                    }
                }
            });
            console.log('Evento configurado: buscarProducto');
        }
        
        // Botón Aplicar Filtros
        if (this.elements.btnAplicarFiltros) {
            this.elements.btnAplicarFiltros.addEventListener('click', () => {
                console.log('Clic en Aplicar Filtros');
                if (typeof buscarProducto === 'function') {
                    buscarProducto();
                } else {
                    this.searchProducts();
                }
            });
            console.log('Evento configurado: btnAplicarFiltros');
        }
        
        // Botón Limpiar Filtros
        if (this.elements.btnLimpiarFiltros) {
            this.elements.btnLimpiarFiltros.addEventListener('click', () => {
                console.log('Clic en Limpiar Filtros');
                if (this.elements.filtroCategoria) this.elements.filtroCategoria.value = '';
                if (this.elements.ordenarPor) this.elements.ordenarPor.value = 'nombre';
                if (this.elements.buscarProducto) this.elements.buscarProducto.value = '';
                
                if (typeof buscarProducto === 'function') {
                    buscarProducto();
                } else {
                    this.searchProducts();
                }
            });
            console.log('Evento configurado: btnLimpiarFiltros');
        }
        
        // Formulario de producto
        if (this.elements.formProducto) {
            this.elements.formProducto.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Submit del formulario de producto');
                if (typeof guardarProducto === 'function') {
                    guardarProducto(e);
                } else {
                    this.saveProduct(e);
                }
            });
            console.log('Evento configurado: formProducto');
        }
        
        // Delegación de eventos para botones de editar/eliminar en lista de productos
        if (this.elements.listaProductos) {
            this.elements.listaProductos.addEventListener('click', (e) => {
                const btnEditar = e.target.closest('.btn-editar');
                const btnEliminar = e.target.closest('.btn-eliminar');
                
                if (!btnEditar && !btnEliminar) return;
                
                const productoItem = e.target.closest('.producto-item');
                if (!productoItem) return;
                
                const id = parseInt(productoItem.dataset.id);
                
                if (btnEditar) {
                    console.log('Clic en Editar Producto', id);
                    if (typeof editarProducto === 'function') {
                        editarProducto(id);
                    } else {
                        this.editProduct(id);
                    }
                } else if (btnEliminar) {
                    console.log('Clic en Eliminar Producto', id);
                    if (typeof eliminarProducto === 'function') {
                        eliminarProducto(id);
                    } else {
                        this.deleteProduct(id);
                    }
                }
            });
            console.log('Evento configurado: listaProductos (delegación)');
        }
        
        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (this.elements.modalProducto && e.target === this.elements.modalProducto) {
                console.log('Clic fuera del modal');
                this.elements.modalProducto.style.display = 'none';
            }
        });
        console.log('Evento configurado: cerrar modal');
    },
    
    /**
     * Carga productos y categorías
     */
    loadData() {
        console.log('Cargando datos...');
        
        // Cargar productos
        if (typeof cargarProductos === 'function') {
            setTimeout(() => {
                console.log('Cargando productos...');
                cargarProductos();
            }, 100);
        } else {
            this.loadProducts();
        }
        
        // Cargar categorías
        if (typeof cargarCategorias === 'function') {
            setTimeout(() => {
                console.log('Cargando categorías...');
                cargarCategorias();
            }, 100);
        } else {
            this.loadCategories();
        }
    },
    
    /**
     * Muestra el modal de producto
     */
    showModal() {
        if (this.elements.modalProducto) {
            this.elements.modalProducto.style.display = 'block';
        }
    },
    
    /**
     * Métodos de respaldo por si las funciones originales no están disponibles
     */
    
    loadProducts() {
        console.log('Usando método de respaldo para cargar productos');
        if (this.elements.listaProductos) {
            this.elements.listaProductos.innerHTML = '<div class="mensaje-info">Cargando productos...</div>';
            
            // Intentar cargar productos usando ipcRenderer
            if (window.ipcRenderer) {
                window.ipcRenderer.invoke('obtener-productos', {})
                    .then(productos => {
                        console.log('Productos cargados:', productos.length);
                        this.displayProducts(productos);
                    })
                    .catch(error => {
                        console.error('Error al cargar productos:', error);
                        this.elements.listaProductos.innerHTML = '<div class="mensaje-error">Error al cargar productos</div>';
                    });
            } else {
                this.elements.listaProductos.innerHTML = '<div class="mensaje-error">No se pudo acceder a la base de datos</div>';
            }
        }
    },
    
    loadCategories() {
        console.log('Usando método de respaldo para cargar categorías');
        const selectCategoria = document.getElementById('categoria');
        const filtroCategoria = document.getElementById('filtroCategoria');
        
        if (!selectCategoria && !filtroCategoria) return;
        
        // Intentar cargar categorías usando ipcRenderer
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('obtener-categorias')
                .then(categorias => {
                    console.log('Categorías cargadas:', categorias.length);
                    
                    // Actualizar select de categoría en formulario
                    if (selectCategoria) {
                        selectCategoria.innerHTML = '<option value="">Seleccione una categoría</option>';
                        categorias.forEach(categoria => {
                            const option = document.createElement('option');
                            option.value = categoria.id;
                            option.textContent = categoria.nombre;
                            selectCategoria.appendChild(option);
                        });
                    }
                    
                    // Actualizar select de filtro de categoría
                    if (filtroCategoria) {
                        filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
                        categorias.forEach(categoria => {
                            const option = document.createElement('option');
                            option.value = categoria.id;
                            option.textContent = categoria.nombre;
                            filtroCategoria.appendChild(option);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error al cargar categorías:', error);
                });
        }
    },
    
    displayProducts(productos) {
        if (!this.elements.listaProductos) return;
        
        if (productos.length === 0) {
            this.elements.listaProductos.innerHTML = '<div class="mensaje-info">No se encontraron productos</div>';
            return;
        }
        
        const grid = document.createElement('div');
        grid.className = 'productos-grid';
        
        productos.forEach(producto => {
            const productoElement = document.createElement('div');
            productoElement.className = 'producto-item';
            productoElement.dataset.id = producto.id;
            
            productoElement.innerHTML = `
                <div class="producto-imagen">
                    ${producto.imagen 
                        ? `<img src="${producto.imagen}" alt="${producto.nombre}">`
                        : '<div class="sin-imagen"><i class="fas fa-box"></i></div>'}
                </div>
                <div class="producto-info">
                    <h3>${producto.nombre}</h3>
                    <p class="producto-precio">${producto.precio.toFixed(2)} €</p>
                    ${producto.categoria 
                        ? `<span class="producto-categoria">${producto.categoria}</span>`
                        : ''}
                </div>
                <div class="producto-acciones">
                    <button class="btn btn-editar" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-eliminar" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            grid.appendChild(productoElement);
        });
        
        this.elements.listaProductos.innerHTML = '';
        this.elements.listaProductos.appendChild(grid);
    },
    
    searchProducts() {
        console.log('Usando método de respaldo para buscar productos');
        const query = this.elements.buscarProducto ? this.elements.buscarProducto.value : '';
        const categoriaId = this.elements.filtroCategoria ? this.elements.filtroCategoria.value : null;
        const ordenar = this.elements.ordenarPor ? this.elements.ordenarPor.value : 'nombre';
        
        if (window.ipcRenderer) {
            this.elements.listaProductos.innerHTML = '<div class="mensaje-info">Buscando productos...</div>';
            
            window.ipcRenderer.invoke('obtener-productos', { query, categoriaId, ordenar })
                .then(productos => {
                    console.log('Productos encontrados:', productos.length);
                    this.displayProducts(productos);
                })
                .catch(error => {
                    console.error('Error al buscar productos:', error);
                    this.elements.listaProductos.innerHTML = '<div class="mensaje-error">Error al buscar productos</div>';
                });
        }
    },
    
    saveProduct(e) {
        console.log('Usando método de respaldo para guardar producto');
        const form = e.target;
        const formData = new FormData(form);
        const producto = {};
        
        formData.forEach((value, key) => {
            if (key === 'id' && value) {
                producto[key] = parseInt(value);
            } else if (key === 'precio' && value) {
                producto[key] = parseFloat(value);
            } else if (key === 'cantidad' && value) {
                producto[key] = parseInt(value);
            } else if (key === 'categoriaId' && value) {
                producto[key] = parseInt(value);
            } else {
                producto[key] = value;
            }
        });
        
        if (window.ipcRenderer) {
            const action = producto.id ? 'actualizar-producto' : 'guardar-producto';
            
            window.ipcRenderer.invoke(action, producto)
                .then(result => {
                    alert(result.mensaje || 'Producto guardado correctamente');
                    this.elements.modalProducto.style.display = 'none';
                    this.loadProducts();
                })
                .catch(error => {
                    console.error('Error al guardar producto:', error);
                    alert('Error al guardar el producto: ' + error.message);
                });
        }
    },
    
    editProduct(id) {
        console.log('Usando método de respaldo para editar producto', id);
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('obtener-producto', id)
                .then(producto => {
                    if (producto) {
                        this.fillProductForm(producto);
                        this.showModal();
                    } else {
                        alert('No se encontró el producto');
                    }
                })
                .catch(error => {
                    console.error('Error al obtener producto:', error);
                    alert('Error al cargar el producto: ' + error.message);
                });
        }
    },
    
    fillProductForm(producto) {
        if (!this.elements.formProducto) return;
        
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
        const imagenPreview = document.getElementById('imagen-preview');
        const imagenPreviewImg = document.getElementById('imagen-preview-img');
        
        if (producto.imagen && imagenPreview && imagenPreviewImg) {
            imagenPreviewImg.src = producto.imagen;
            imagenPreview.style.display = 'block';
        } else if (imagenPreview) {
            imagenPreview.style.display = 'none';
        }
    },
    
    deleteProduct(id) {
        console.log('Usando método de respaldo para eliminar producto', id);
        if (!confirm('¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
            return;
        }
        
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('eliminar-producto', id)
                .then(result => {
                    alert(result.mensaje || 'Producto eliminado correctamente');
                    this.loadProducts();
                })
                .catch(error => {
                    console.error('Error al eliminar producto:', error);
                    alert('Error al eliminar el producto: ' + error.message);
                });
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado - Inicializando ProductosHandler');
    ProductosHandler.init();
});

// Exportar para uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductosHandler;
} else {
    window.ProductosHandler = ProductosHandler;
}
