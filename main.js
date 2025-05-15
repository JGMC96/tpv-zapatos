const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ventas.db');

// --- CONFIGURACIÓN ---
const configPath = path.join(__dirname, 'config.json');

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    } else {
      // Configuración por defecto
      return {
        moneda: 'EUR',
        tasaIVA: 21
      };
    }
  } catch (e) {
    console.error('Error al leer config.json:', e);
    return { moneda: 'EUR', tasaIVA: 21 };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error al guardar config.json:', e);
    return false;
  }
}

ipcMain.handle('obtener-config', async () => {
  return getConfig();
});
ipcMain.handle('guardar-config', async (event, config) => {
  return saveConfig(config);
});


// Configuración de la aplicación
app.name = 'TPV Zapatos';
app.allowRendererProcessReuse = true;

// Crear tablas si no existen
function initializeDatabase() {
  db.serialize(() => {
    // Primero eliminamos las tablas si existen para evitar problemas de estructura
    db.run('DROP TABLE IF EXISTS venta_detalles');
    db.run('DROP TABLE IF EXISTS ventas');
    db.run('DROP TABLE IF EXISTS productos');
    
    console.log('Tablas eliminadas, creando estructura nueva...');
    
    // Tabla de productos
    // Crear tabla de categorías
    db.run(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insertar categorías por defecto si no existen
    db.get('SELECT COUNT(*) as count FROM categorias', [], (err, result) => {
      if (err) return console.error('Error al verificar categorías:', err);
      
      if (result.count === 0) {
        const categoriasDefault = [
          'Deportivas', 'Casuales', 'Formales', 'Sandalias', 'Botas', 'Tacones', 'Zapatillas', 'Mocasines'
        ];
        
        const stmt = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
        categoriasDefault.forEach(categoria => {
          stmt.run(categoria);
        });
        stmt.finalize();
      }
    });

    // Actualizar tabla productos para incluir categoría
    db.run(`CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      cantidad INTEGER DEFAULT 0,
      talla TEXT,
      categoria_id INTEGER,
      imagen TEXT,
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )`);
    
    console.log('Tabla de productos creada correctamente');

    // Tabla de ventas (cabecera)
    db.run(`CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL,
      iva REAL,
      total REAL,
      forma_pago TEXT,
      monto_recibido REAL,
      cambio REAL
    )`);
    
    console.log('Tabla de ventas creada correctamente');
    
    // Tabla de detalles de venta
    db.run(`CREATE TABLE IF NOT EXISTS venta_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      producto_id INTEGER,
      cantidad INTEGER,
      precio_unitario REAL,
      subtotal REAL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);
    
    console.log('Tabla de detalles de venta creada correctamente');
    
    // Insertar datos de ejemplo si la tabla de productos está vacía
    db.get("SELECT COUNT(*) as count FROM productos", [], (err, row) => {
      if (err) return console.error('Error al verificar productos:', err);
      
      if (row.count === 0) {
        console.log('Insertando datos de ejemplo...');
        const stmt = db.prepare("INSERT INTO productos (codigo, nombre, descripcion, precio, cantidad) VALUES (?, ?, ?, ?, ?)");
        stmt.run('ZAP-001', 'Zapato rojo', 'Zapato deportivo color rojo', 59.90, 10);
        stmt.run('ZAP-002', 'Botín negro', 'Botín elegante negro', 89.50, 5);
        stmt.run('ZAP-003', 'Sandalias', 'Sandalias de verano', 29.99, 15);
        stmt.finalize();
        console.log('Datos de ejemplo insertados correctamente');
      } else {
        console.log('La base de datos ya contiene datos, no se insertan ejemplos');
      }
    });
  });
}

let mainWindow;

// Configuración de la ventana principal
const windowConfig = {
  width: 1100,
  height: 700,
  minWidth: 800,
  minHeight: 600,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    enableRemoteModule: true
  },
  show: false, // No mostrar hasta que esté listo
  icon: path.join(__dirname, 'assets/icon.png')
};

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow(windowConfig);
  
  // Cargar el menú principal
  cargarVentana('menu.html');
  
  // Configurar menú de la aplicación
  configurarMenu();
  
  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Manejar cierre de la ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Función para cargar diferentes ventanas
function cargarVentana(archivo) {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, archivo));
  }
}

// Configurar menú de la aplicación
function configurarMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Ventas', click: () => cargarVentana('index.html') },
        { label: 'Productos', click: () => cargarVentana('productos.html') },
        { label: 'Historial', click: () => cargarVentana('historial.html') },
        { type: 'separator' },
        { 
          label: 'Salir', 
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit() 
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox({
              title: 'Acerca de TPV Zapatos',
              message: 'Sistema de Punto de Venta para Tienda de Zapatos\nVersión 1.0.0',
              buttons: ['Aceptar']
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Manejar navegación desde el menú
ipcMain.on('navegar-a', (event, archivo) => {
  cargarVentana(archivo);
});

// Manejador para buscar productos
ipcMain.handle('buscar-productos', async (event, { termino }) => {
  return new Promise((resolve, reject) => {
    try {
      // Buscar productos mientras se escribe
      const query = `
        SELECT p.*, c.nombre as categoria_nombre 
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE 
          p.nombre LIKE ? OR 
          p.codigo LIKE ? OR 
          p.descripcion LIKE ?
        ORDER BY p.nombre
        LIMIT 20
      `;
      
      const searchTerm = `%${termino}%`;
      
      db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
          console.error('Error al buscar productos:', err);
          reject({ error: true, mensaje: `Error al buscar productos: ${err.message}` });
        } else {
          resolve(rows);
        }
      });
    } catch (error) {
      console.error('Error en buscar-productos:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para obtener un producto por ID
ipcMain.handle('obtener-producto', async (event, { id }) => {
  return new Promise((resolve, reject) => {
    try {
      db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error al obtener producto:', err);
          reject({ error: true, mensaje: `Error al obtener producto: ${err.message}` });
        } else {
          resolve(row);
        }
      });
    } catch (error) {
      console.error('Error en obtener-producto:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para obtener todos los productos
ipcMain.handle('obtener-productos', async (event) => {
  return new Promise((resolve, reject) => {
    try {
      db.all('SELECT * FROM productos ORDER BY nombre', (err, rows) => {
        if (err) {
          console.error('Error al obtener productos:', err);
          reject({ error: true, mensaje: `Error al obtener productos: ${err.message}` });
        } else {
          resolve(rows);
        }
      });
    } catch (error) {
      console.error('Error en obtener-productos:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para registrar una venta
ipcMain.handle('registrar-venta', async (event, venta) => {
  return new Promise((resolve, reject) => {
    try {
      db.serialize(() => {
        // Comenzar transacción
        db.run('BEGIN TRANSACTION');
        
        // Insertar la cabecera de la venta
        const sqlVenta = `
          INSERT INTO ventas (
            fecha, subtotal, descuento, iva, total, 
            forma_pago, monto_recibido, cambio
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(
          sqlVenta, 
          [
            venta.fecha, 
            venta.subtotal, 
            venta.descuento, 
            venta.iva, 
            venta.total, 
            venta.metodoPago, 
            venta.montoRecibido, 
            venta.cambio
          ], 
          function(err) {
            if (err) {
              console.error('Error al insertar venta:', err);
              db.run('ROLLBACK');
              reject({ error: true, mensaje: `Error al insertar venta: ${err.message}` });
              return;
            }
            
            const ventaId = this.lastID;
            let detallesInsertados = 0;
            
            // Insertar detalles de la venta
            venta.items.forEach(item => {
              const sqlDetalle = `
                INSERT INTO venta_detalles (
                  venta_id, producto_id, cantidad, precio_unitario, subtotal
                ) VALUES (?, ?, ?, ?, ?)
              `;
              
              db.run(
                sqlDetalle,
                [
                  ventaId,
                  item.id,
                  item.cantidad,
                  item.precio,
                  item.subtotal
                ],
                function(err) {
                  if (err) {
                    console.error('Error al insertar detalle de venta:', err);
                    db.run('ROLLBACK');
                    reject({ error: true, mensaje: `Error al insertar detalle de venta: ${err.message}` });
                    return;
                  }
                  
                  // Actualizar stock del producto
                  const sqlUpdateStock = `
                    UPDATE productos 
                    SET cantidad = cantidad - ? 
                    WHERE id = ?
                  `;
                  
                  db.run(sqlUpdateStock, [item.cantidad, item.id], function(err) {
                    if (err) {
                      console.error('Error al actualizar stock:', err);
                      db.run('ROLLBACK');
                      reject({ error: true, mensaje: `Error al actualizar stock: ${err.message}` });
                      return;
                    }
                    
                    detallesInsertados++;
                    
                    // Si se han procesado todos los items, finalizar la transacción
                    if (detallesInsertados === venta.items.length) {
                      db.run('COMMIT', function(err) {
                        if (err) {
                          console.error('Error al finalizar la transacción:', err);
                          db.run('ROLLBACK');
                          reject({ error: true, mensaje: `Error al finalizar la transacción: ${err.message}` });
                          return;
                        }
                        
                        resolve({ success: true, ventaId: ventaId });
                      });
                    }
                  });
                }
              );
            });
          }
        );
      });
    } catch (error) {
      console.error('Error en registrar-venta:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para imprimir un ticket
ipcMain.handle('imprimir-ticket', async (event, { ventaId }) => {
  return new Promise((resolve, reject) => {
    try {
      // Obtener datos de la venta
      const sqlVenta = `
        SELECT * FROM ventas 
        WHERE id = ?
      `;
      
      db.get(sqlVenta, [ventaId], (err, venta) => {
        if (err) {
          console.error('Error al obtener venta:', err);
          reject({ error: true, mensaje: `Error al obtener venta: ${err.message}` });
          return;
        }
        
        // Obtener detalles de la venta
        const sqlDetalles = `
          SELECT vd.*, p.nombre, p.codigo 
          FROM venta_detalles vd
          INNER JOIN productos p ON vd.producto_id = p.id
          WHERE vd.venta_id = ?
        `;
        
        db.all(sqlDetalles, [ventaId], (err, detalles) => {
          if (err) {
            console.error('Error al obtener detalles de venta:', err);
            reject({ error: true, mensaje: `Error al obtener detalles de venta: ${err.message}` });
            return;
          }
          
          resolve({ success: true, venta, detalles });
        });
      });
    } catch (error) {
      console.error('Error en imprimir-ticket:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para buscar productos
ipcMain.handle('buscar-productos', async (event, { termino }) => {
  return new Promise((resolve, reject) => {
    try {
      // Buscar productos mientras se escribe
      const query = `
        SELECT p.*, c.nombre as categoria_nombre 
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE 
          p.nombre LIKE ? OR 
          p.codigo LIKE ? OR 
          p.descripcion LIKE ?
        ORDER BY p.nombre
        LIMIT 20
      `;
      
      const searchTerm = `%${termino}%`;
      
      db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
          console.error('Error al buscar productos:', err);
          reject({ error: true, mensaje: `Error al buscar productos: ${err.message}` });
        } else {
          resolve(rows);
        }
      });
    } catch (error) {
      console.error('Error en buscar-productos:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para obtener un producto por ID
ipcMain.handle('obtener-producto', async (event, { id }) => {
  return new Promise((resolve, reject) => {
    try {
      db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error al obtener producto:', err);
          reject({ error: true, mensaje: `Error al obtener producto: ${err.message}` });
        } else {
          resolve(row);
        }
      });
    } catch (error) {
      console.error('Error en obtener-producto:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para obtener todos los productos
ipcMain.handle('obtener-productos', async (event) => {
  return new Promise((resolve, reject) => {
    try {
      db.all('SELECT * FROM productos ORDER BY nombre', (err, rows) => {
        if (err) {
          console.error('Error al obtener productos:', err);
          reject({ error: true, mensaje: `Error al obtener productos: ${err.message}` });
        } else {
          resolve(rows);
        }
      });
    } catch (error) {
      console.error('Error en obtener-productos:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Manejador para guardar producto (nuevo)
ipcMain.handle('guardar-producto', async (event, producto) => {
  console.log('Recibida solicitud para guardar producto:', producto);
  
  return new Promise((resolve, reject) => {
    try {
      const { nombre, descripcion, precio, cantidad, codigo, categoriaId } = producto;
      
      // Generar código único si no se proporciona
      let codigoFinal = codigo;
      if (!codigoFinal) {
        codigoFinal = `ZAP-${Date.now().toString().slice(-6)}`;
      }
      
      // Preparar consulta SQL
      const stmt = db.prepare(`
        INSERT INTO productos 
        (codigo, nombre, descripcion, precio, cantidad, categoria_id) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      // Ejecutar consulta
      stmt.run(
        codigoFinal,
        nombre,
        descripcion || '',
        precio || 0,
        cantidad || 0,
        categoriaId || null,
        function(err) {
          if (err) {
            console.error('Error al guardar producto:', err);
            reject({ error: true, mensaje: `Error al guardar producto: ${err.message}` });
          } else {
            console.log(`Producto guardado con ID: ${this.lastID}`);
            resolve({ 
              success: true, 
              mensaje: 'Producto guardado correctamente', 
              productoId: this.lastID,
              codigo: codigoFinal
            });
          }
        }
      );
      
      // Finalizar statement
      stmt.finalize();
    } catch (error) {
      console.error('Error en guardar-producto:', error);
      reject({ error: true, mensaje: `Error: ${error.message}` });
    }
  });
});

// Registrar venta
ipcMain.handle('registrar-venta', async (event, venta) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        'INSERT INTO ventas (fecha, subtotal, iva, total, forma_pago, monto_recibido, cambio) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          venta.fecha,
          venta.subtotal,
          venta.iva,
          venta.total,
          venta.metodoPago,
          venta.montoRecibido || null,
          venta.cambio || null
        ],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('Error al guardar venta:', err);
            return reject(err);
          }
          const ventaId = this.lastID;
          let productosActualizados = 0;
          // Si no hay productos, commit y terminar
          if (!venta.productos || venta.productos.length === 0) {
            db.run('COMMIT');
            return resolve({ id: ventaId });
          }
          // Insertar detalles de venta y actualizar stock
          venta.productos.forEach(producto => {
            db.run(
              'INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
              [
                ventaId,
                producto.id,
                producto.cantidad,
                producto.precio,
                producto.precio * producto.cantidad
              ],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('Error al guardar detalle de venta:', err);
                  return reject(err);
                }
                // Actualizar stock
                db.run(
                  'UPDATE productos SET cantidad = cantidad - ? WHERE id = ?',
                  [producto.cantidad, producto.id],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('Error al actualizar stock:', err);
                      return reject(err);
                    }
                    productosActualizados++;
                    if (productosActualizados === venta.productos.length) {
                      db.run('COMMIT');
                      resolve({ id: ventaId });
                    }
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

// Manejar guardado de nuevo producto
// Manejar adición de categorías
ipcMain.handle('agregar-categoria', async (event, categoria) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      [categoria.nombre, categoria.descripcion],
      function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, ...categoria });
      }
    );
  });
});

// Manejar actualización de categorías
ipcMain.handle('actualizar-categoria', async (event, categoria) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?',
      [categoria.nombre, categoria.descripcion, categoria.id],
      function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      }
    );
  });
});

ipcMain.handle('agregar-producto', async (event, producto) => {
  console.log('Recibida solicitud para agregar producto:', producto);
  
  return new Promise((resolve, reject) => {
    try {
      // Normalizar nombres de propiedades
      const codigo = producto.codigo || producto.codigo_barras;
      const nombre = producto.nombre;
      const descripcion = producto.descripcion;
      const precio = producto.precio || producto.precio_venta;
      const cantidad = producto.cantidad || producto.stock;
      const talla = producto.talla;
      const imagen = producto.imagen;
      const fechaActual = new Date().toISOString();
      
      console.log('Datos normalizados del producto:', {
        codigo, nombre, descripcion, precio, cantidad, talla, 
        tieneImagen: !!imagen,
        fechaActual
      });
      
      // Verificar si el código ya existe
      db.get('SELECT id FROM productos WHERE codigo = ?', [codigo], (err, row) => {
        if (err) {
          console.error('Error al verificar código duplicado:', err);
          return reject(err);
        }
        
        if (row) {
          const errorMsg = `Ya existe un producto con el código: ${codigo}`;
          console.log(errorMsg);
          return reject(new Error(errorMsg));
        }
        
        console.log('No se encontró código duplicado, procediendo a insertar...');
        
        // Si no existe, insertar el nuevo producto
        const stmt = db.prepare(`
          INSERT INTO productos 
          (codigo, nombre, descripcion, precio, cantidad, talla, imagen, fecha_creacion, fecha_actualizacion) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          codigo, 
          nombre, 
          descripcion || '', 
          parseFloat(precio) || 0, 
          parseInt(cantidad) || 0,
          talla || '',
          imagen || null,
          fechaActual,
          fechaActual,
          function(err) {
            stmt.finalize();
            
            if (err) {
              console.error('Error al insertar producto:', err);
              return reject(err);
            }
            
            const resultado = { 
              id: this.lastID,
              mensaje: 'Producto agregado correctamente',
              producto: {
                id: this.lastID,
                codigo,
                nombre,
                descripcion,
                precio: parseFloat(precio) || 0,
                cantidad: parseInt(cantidad) || 0,
                talla: talla || '',
                imagen: imagen || null
              }
            };
            
            console.log('Producto insertado correctamente:', resultado);
            resolve(resultado);
          }
        );
      });
    } catch (error) {
      console.error('Error en el manejador agregar-producto:', error);
      reject(error);
    }
  });
});

// Manejar cierre de la aplicación
ipcMain.on('cerrar-app', () => {
  app.quit();
});

// Manejar eventos de la aplicación
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();
  
  // En macOS es común volver a crear una ventana cuando se hace clic en el ícono del dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // Manejar el cierre en macOS
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// Este handler fue consolidado arriba y se eliminó para evitar duplicación

// Manejador para actualizar un producto existente
ipcMain.handle('actualizar-producto', async (event, producto) => {
  return new Promise((resolve, reject) => {
    const { id, codigo, nombre, descripcion, precio, cantidad, talla, imagen } = producto;
    const fechaActual = new Date().toISOString();
    
    // Verificar si el código ya existe (excluyendo el producto actual)
    db.get('SELECT id FROM productos WHERE codigo = ? AND id != ?', [codigo, id], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        return reject(new Error('Ya existe otro producto con este código'));
      }
      
      // Construir la consulta dinámicamente
      const params = [
        codigo, 
        nombre, 
        descripcion || '', 
        parseFloat(precio) || 0, 
        parseInt(cantidad) || 0,
        talla || '',
        fechaActual
      ];
      
      let sql = `
        UPDATE productos 
        SET 
          codigo = ?, 
          nombre = ?, 
          descripcion = ?, 
          precio = ?, 
          cantidad = ?,
          talla = ?,
          fecha_actualizacion = ?
      `;
      
      // Si hay una nueva imagen, la incluimos en la consulta
      if (imagen) {
        sql += ', imagen = ?';
        params.push(imagen);
      }
      
      sql += ' WHERE id = ?';
      params.push(id);
      
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        
        // Obtener el producto actualizado para devolverlo
        db.get('SELECT * FROM productos WHERE id = ?', [id], (err, productoActualizado) => {
          if (err) return reject(err);
          
          resolve({ 
            id,
            mensaje: 'Producto actualizado correctamente',
            producto: productoActualizado
          });
        });
      });
    });
  });
});

// Manejador para eliminar un producto
ipcMain.handle('eliminar-producto', async (event, id) => {
  return new Promise((resolve, reject) => {
    // Primero verificamos si el producto tiene ventas asociadas
    db.get('SELECT COUNT(*) as count FROM venta_detalles WHERE producto_id = ?', [id], (err, row) => {
      if (err) return reject(err);
      
      if (row && row.count > 0) {
        return reject(new Error('No se puede eliminar el producto porque tiene ventas asociadas'));
      }
      
      // Si no tiene ventas, procedemos a eliminar
      db.run('DELETE FROM productos WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        
        if (this.changes === 0) {
          return reject(new Error('Producto no encontrado'));
        }
        
        resolve({ 
          success: true, 
          mensaje: 'Producto eliminado correctamente',
          id: id
        });
      });
    });
  });
});

// Manejar obtención de productos con búsqueda y filtrado
ipcMain.handle('obtener-productos', async (event, { query = '', categoriaId = null }) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (query) {
      sql += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigo LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (categoriaId) {
      sql += ' AND p.categoria_id = ?';
      params.push(categoriaId);
    }
    
    sql += ' ORDER BY p.nombre';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error al obtener productos:', err);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Manejar obtención de categorías
ipcMain.handle('obtener-categorias', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM categorias ORDER BY nombre', [], (err, rows) => {
      if (err) {
        console.error('Error al obtener categorías:', err);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Manejador para obtener un producto por su ID
ipcMain.handle('obtener-producto', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
});

// Manejador alternativo de guardadod de venta eliminado

// Manejador para obtener el historial de ventas
ipcMain.handle('obtener-ventas', async (event, { fechaInicio, fechaFin }) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT v.*, 
             COUNT(vd.id) as total_productos,
             SUM(vd.cantidad) as total_unidades
      FROM ventas v
      LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
      WHERE date(v.fecha) BETWEEN date(?) AND date(?)
      GROUP BY v.id
      ORDER BY v.fecha DESC
    `;
    
    db.all(query, [fechaInicio, fechaFin], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

// Manejador para obtener los detalles de una venta
ipcMain.handle('obtener-detalles-venta', async (event, ventaId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT vd.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      WHERE vd.venta_id = ?
    `;
    
    db.all(query, [ventaId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

// Manejador para actualizar el stock de un producto
ipcMain.handle('actualizar-stock', async (event, { id, cantidad }) => {
  return new Promise((resolve, reject) => {
    // Primero verificamos que haya suficiente stock
    db.get('SELECT cantidad FROM productos WHERE id = ?', [id], (err, producto) => {
      if (err) return reject(err);
      
      if (!producto) {
        return reject(new Error('Producto no encontrado'));
      }
      
      const nuevoStock = (producto.cantidad || 0) + parseInt(cantidad);
      
      if (nuevoStock < 0) {
        return reject(new Error('No hay suficiente stock disponible'));
      }
      
      // Actualizamos el stock
      db.run(
        'UPDATE productos SET cantidad = ?, fecha_actualizacion = ? WHERE id = ?',
        [nuevoStock, new Date().toISOString(), id],
        function(err) {
          if (err) return reject(err);
          
          if (this.changes === 0) {
            return reject(new Error('No se pudo actualizar el stock'));
          }
          
          resolve({ 
            success: true, 
            nuevoStock,
            mensaje: 'Stock actualizado correctamente'
          });
        }
      );
    });
  });
});
