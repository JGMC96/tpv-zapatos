/**
 * Manejador específico para la página de configuración
 * Este archivo garantiza que todos los botones y eventos de la página de configuración
 * funcionen correctamente y que los cambios se guarden adecuadamente.
 */

const ConfiguracionHandler = {
    // Elementos del DOM
    elements: {},
    
    // Temporizador para guardado automático
    saveTimer: null,
    
    // Configuración actual
    currentConfig: {},
    
    /**
     * Inicializa el manejador de configuración
     */
    init() {
        console.log('Inicializando manejador de configuración...');
        
        // Cargar referencias a elementos del DOM
        this.loadElements();
        
        // Configurar eventos
        this.setupEvents();
        
        // Cargar configuración actual
        this.loadConfig();
        
        console.log('Manejador de configuración inicializado correctamente');
    },
    
    /**
     * Carga referencias a elementos del DOM
     */
    loadElements() {
        // Form principal
        this.elements.formConfig = document.getElementById('form-config');
        
        // Botones
        this.elements.btnVolver = document.getElementById('btn-volver');
        this.elements.btnCancelar = document.getElementById('btn-cancelar');
        this.elements.btnGuardar = document.getElementById('btn-guardar');
        
        // Pestañas
        this.elements.tabs = document.querySelectorAll('.tab');
        
        // Todos los campos del formulario
        this.elements.allInputs = document.querySelectorAll('#form-config input, #form-config select, #form-config textarea');
        
        // Verificar si se encontraron los elementos principales
        if (!this.elements.formConfig) {
            console.warn('Formulario de configuración no encontrado');
        }
        
        // Registrar todos los elementos de configuración por su ID
        document.querySelectorAll('[id]').forEach(el => {
            this.elements[el.id] = el;
        });
        
        console.log('Elementos DOM cargados');
    },
    
    /**
     * Configura eventos para los elementos
     */
    setupEvents() {
        console.log('Configurando eventos...');
        
        // Evento para el formulario (prevenir envío normal)
        if (this.elements.formConfig) {
            this.elements.formConfig.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfig();
            });
            console.log('Evento configurado: formConfig (submit)');
        }
        
        // Botón volver al menú principal
        if (this.elements.btnVolver) {
            this.elements.btnVolver.addEventListener('click', () => {
                console.log('Clic en Volver');
                
                // Guardar cambios antes de volver
                this.saveConfig(true).then(() => {
                    window.location.href = 'menu.html';
                });
            });
            console.log('Evento configurado: btnVolver');
        }
        
        // Botón cancelar cambios
        if (this.elements.btnCancelar) {
            this.elements.btnCancelar.addEventListener('click', () => {
                console.log('Clic en Cancelar');
                if (confirm('¿Desea descartar los cambios realizados?')) {
                    window.location.href = 'menu.html';
                }
            });
            console.log('Evento configurado: btnCancelar');
        }
        
        // Botón guardar (si existe)
        if (this.elements.btnGuardar) {
            this.elements.btnGuardar.addEventListener('click', () => {
                console.log('Clic en Guardar');
                this.saveConfig(true);
            });
            console.log('Evento configurado: btnGuardar');
        }
        
        // Guardado automático para todos los campos
        if (this.elements.allInputs) {
            this.elements.allInputs.forEach(input => {
                ['change', 'input'].forEach(eventType => {
                    input.addEventListener(eventType, () => {
                        this.autoSaveConfig();
                    });
                });
            });
            console.log('Evento configurado: guardado automático para campos');
        }
        
        // Navegación entre pestañas
        if (this.elements.tabs) {
            this.elements.tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tab);
                });
            });
            console.log('Evento configurado: navegación entre pestañas');
        }
        
        // Botones específicos de configuración
        this.setupSpecificButtons();
        
        console.log('Todos los eventos configurados correctamente');
    },
    
    /**
     * Configura botones específicos de la configuración
     */
    setupSpecificButtons() {
        // Botón para seleccionar ruta de respaldo
        const btnSeleccionarRuta = document.getElementById('btn-seleccionar-ruta');
        if (btnSeleccionarRuta) {
            btnSeleccionarRuta.addEventListener('click', () => {
                console.log('Seleccionando ruta de respaldo...');
                this.selectBackupPath();
            });
            console.log('Evento configurado: btnSeleccionarRuta');
        }
        
        // Botón para hacer respaldo manual
        const btnHacerRespaldo = document.getElementById('btn-hacer-respaldo');
        if (btnHacerRespaldo) {
            btnHacerRespaldo.addEventListener('click', () => {
                console.log('Haciendo respaldo manual...');
                this.createBackup();
            });
            console.log('Evento configurado: btnHacerRespaldo');
        }
        
        // Botón para restaurar respaldo
        const btnRestaurarRespaldo = document.getElementById('btn-restaurar-respaldo');
        if (btnRestaurarRespaldo) {
            btnRestaurarRespaldo.addEventListener('click', () => {
                console.log('Restaurando respaldo...');
                this.restoreBackup();
            });
            console.log('Evento configurado: btnRestaurarRespaldo');
        }
        
        // Botón para imprimir prueba
        const btnImprimirPrueba = document.getElementById('btn-imprimir-prueba');
        if (btnImprimirPrueba) {
            btnImprimirPrueba.addEventListener('click', () => {
                console.log('Imprimiendo prueba...');
                this.printTest();
            });
            console.log('Evento configurado: btnImprimirPrueba');
        }
    },
    
    /**
     * Cambia de pestaña
     */
    switchTab(selectedTab) {
        console.log('Cambiando a pestaña:', selectedTab.textContent.trim());
        
        // Obtener el ID del contenido asociado a la pestaña
        const targetId = selectedTab.getAttribute('data-target') || selectedTab.getAttribute('data-tab');
        if (!targetId) {
            console.warn('La pestaña no tiene un atributo data-target o data-tab');
            return;
        }
        
        // Desactivar todas las pestañas y contenidos
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('activo'));
        document.querySelectorAll('.tab-contenido').forEach(content => content.classList.remove('activo'));
        
        // Activar la pestaña seleccionada
        selectedTab.classList.add('activo');
        
        // Activar el contenido correspondiente
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add('activo');
        } else {
            console.warn(`Contenido de pestaña no encontrado: ${targetId}`);
        }
    },
    
    /**
     * Carga la configuración actual
     */
    async loadConfig() {
        console.log('Cargando configuración...');
        
        try {
            // Intentar obtener la configuración del sistema
            if (window.ipcRenderer) {
                const config = await window.ipcRenderer.invoke('obtener-config');
                console.log('Configuración cargada:', config);
                this.currentConfig = config;
                this.populateForm(config);
            } else {
                console.warn('ipcRenderer no disponible para cargar configuración');
            }
        } catch (error) {
            console.error('Error al cargar la configuración:', error);
            this.showNotification('Error al cargar la configuración', 'error');
        }
    },
    
    /**
     * Rellena el formulario con la configuración
     */
    populateForm(config) {
        if (!config) return;
        
        console.log('Rellenando formulario con configuración...');
        
        // Para cada propiedad de la configuración, buscar el campo correspondiente
        Object.entries(config).forEach(([key, value]) => {
            const field = document.getElementById(key);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = Boolean(value);
                } else {
                    field.value = value;
                }
            }
        });
        
        // Campos específicos con nombres especiales
        const mappings = {
            'moneda': 'moneda',
            'empresaNombre': 'empresa-nombre',
            'empresaDireccion': 'empresa-direccion',
            'empresaTelefono': 'empresa-telefono',
            'empresaEmail': 'empresa-email',
            'empresaWeb': 'empresa-web',
            'empresaNif': 'empresa-nif',
            'impresora': 'impresora-predeterminada',
            'tipoPapel': 'tipo-papel',
            'imprimirCopia': 'imprimir-copia',
            'imprimirLogo': 'imprimir-logo',
            'imprimirPie': 'imprimir-pie',
            'textoPie': 'texto-pie',
            'rutaRespaldo': 'ruta-respaldo',
            'tiempoSesion': 'tiempo-sesion',
            'solicitarContrasena': 'solicitar-contrasena',
            'bloquearVentas': 'bloquear-ventas',
            'registrarEventos': 'registrar-eventos'
        };
        
        // Aplicar los valores a los campos con nombres especiales
        Object.entries(mappings).forEach(([configKey, fieldId]) => {
            if (config[configKey] !== undefined) {
                const field = document.getElementById(fieldId);
                if (field) {
                    if (field.type === 'checkbox') {
                        field.checked = Boolean(config[configKey]);
                    } else {
                        field.value = config[configKey];
                    }
                }
            }
        });
        
        console.log('Formulario rellenado correctamente');
    },
    
    /**
     * Guarda la configuración automáticamente (con retardo)
     */
    autoSaveConfig() {
        // Limpiar temporizador anterior si existe
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        // Establecer nuevo temporizador (guardar después de 1 segundo de inactividad)
        this.saveTimer = setTimeout(() => {
            this.saveConfig(false);
        }, 1000);
    },
    
    /**
     * Guarda la configuración
     * @param {boolean} showNotification - Indica si se debe mostrar notificación de éxito
     * @returns {Promise} - Promesa que se resuelve cuando se guarda la configuración
     */
    async saveConfig(showNotification = false) {
        console.log('Guardando configuración...');
        
        // Recopilar datos del formulario
        const config = this.collectFormData();
        
        try {
            // Guardar configuración utilizando ipcRenderer
            if (window.ipcRenderer) {
                await window.ipcRenderer.invoke('guardar-config', config);
                console.log('Configuración guardada correctamente');
                
                // Actualizar configuración actual
                this.currentConfig = config;
                
                // Mostrar notificación si se solicita
                if (showNotification) {
                    this.showNotification('Configuración guardada correctamente', 'success');
                }
                
                return true;
            } else {
                throw new Error('ipcRenderer no disponible');
            }
        } catch (error) {
            console.error('Error al guardar la configuración:', error);
            this.showNotification('Error al guardar la configuración: ' + error.message, 'error');
            return false;
        }
    },
    
    /**
     * Recopila los datos del formulario
     * @returns {Object} - Objeto con la configuración
     */
    collectFormData() {
        const config = {};
        
        // Recopilar valores de todos los campos con ID
        document.querySelectorAll('#form-config [id]').forEach(field => {
            if (field.tagName === 'INPUT' || field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') {
                if (field.type === 'checkbox') {
                    config[field.id] = field.checked;
                } else if (field.type === 'number') {
                    config[field.id] = parseFloat(field.value) || 0;
                } else {
                    config[field.id] = field.value;
                }
            }
        });
        
        // Mapeo para nombres de campos específicos
        const mappings = {
            'empresa-nombre': 'empresaNombre',
            'empresa-direccion': 'empresaDireccion',
            'empresa-telefono': 'empresaTelefono',
            'empresa-email': 'empresaEmail',
            'empresa-web': 'empresaWeb',
            'empresa-nif': 'empresaNif',
            'impresora-predeterminada': 'impresora',
            'tipo-papel': 'tipoPapel',
            'imprimir-copia': 'imprimirCopia',
            'imprimir-logo': 'imprimirLogo',
            'imprimir-pie': 'imprimirPie',
            'texto-pie': 'textoPie',
            'ruta-respaldo': 'rutaRespaldo',
            'tiempo-sesion': 'tiempoSesion',
            'solicitar-contrasena': 'solicitarContrasena',
            'bloquear-ventas': 'bloquearVentas',
            'registrar-eventos': 'registrarEventos'
        };
        
        // Aplicar mapeo para nombres de campos específicos
        Object.entries(mappings).forEach(([fieldId, configKey]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.type === 'checkbox') {
                    config[configKey] = field.checked;
                } else if (field.type === 'number') {
                    config[configKey] = parseFloat(field.value) || 0;
                } else {
                    config[configKey] = field.value;
                }
            }
        });
        
        return config;
    },
    
    /**
     * Muestra una notificación al usuario
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de notificación (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        console.log(`Notificación (${type}):`, message);
        
        // Verificar si ya existe un contenedor de notificaciones
        let notificationsContainer = document.getElementById('notifications-container');
        
        // Si no existe, crearlo
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications-container';
            notificationsContainer.style.position = 'fixed';
            notificationsContainer.style.top = '20px';
            notificationsContainer.style.right = '20px';
            notificationsContainer.style.zIndex = '9999';
            document.body.appendChild(notificationsContainer);
        }
        
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.backgroundColor = this.getNotificationColor(type);
        notification.style.color = '#fff';
        notification.style.padding = '15px';
        notification.style.borderRadius = '5px';
        notification.style.marginBottom = '10px';
        notification.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
        notification.style.minWidth = '250px';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        
        // Agregar mensaje
        notification.innerHTML = message;
        
        // Agregar notificación al contenedor
        notificationsContainer.appendChild(notification);
        
        // Mostrar la notificación con animación
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Ocultar la notificación después de 3 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            
            // Eliminar la notificación después de la animación
            setTimeout(() => {
                notificationsContainer.removeChild(notification);
            }, 300);
        }, 3000);
    },
    
    /**
     * Obtiene el color para un tipo de notificación
     * @param {string} type - Tipo de notificación
     * @returns {string} - Color en formato hexadecimal
     */
    getNotificationColor(type) {
        switch (type) {
            case 'success': return '#4caf50';
            case 'error': return '#f44336';
            case 'warning': return '#ff9800';
            default: return '#2196f3';
        }
    },
    
    /**
     * Selecciona la ruta para los respaldos
     */
    selectBackupPath() {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('seleccionar-ruta-respaldo')
                .then(ruta => {
                    console.log('Ruta seleccionada:', ruta);
                    if (ruta) {
                        const rutaRespaldo = document.getElementById('ruta-respaldo');
                        if (rutaRespaldo) {
                            rutaRespaldo.value = ruta;
                            this.saveConfig(true);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error al seleccionar ruta de respaldo:', error);
                    this.showNotification('Error al seleccionar ruta de respaldo', 'error');
                });
        } else {
            console.warn('ipcRenderer no disponible para seleccionar ruta');
            this.showNotification('No se puede seleccionar ruta en este momento', 'warning');
        }
    },
    
    /**
     * Crea un respaldo de la base de datos
     */
    createBackup() {
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('crear-respaldo')
                .then(resultado => {
                    console.log('Respaldo creado:', resultado);
                    this.showNotification(`Respaldo creado en: ${resultado.ruta}`, 'success');
                })
                .catch(error => {
                    console.error('Error al crear respaldo:', error);
                    this.showNotification('Error al crear respaldo: ' + error.message, 'error');
                });
        } else {
            console.warn('ipcRenderer no disponible para crear respaldo');
            this.showNotification('No se puede crear respaldo en este momento', 'warning');
        }
    },
    
    /**
     * Restaura un respaldo de la base de datos
     */
    restoreBackup() {
        if (!confirm('¿Está seguro de que desea restaurar un respaldo? Esta acción reemplazará todos los datos actuales.')) {
            return;
        }
        
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('seleccionar-archivo-respaldo')
                .then(archivo => {
                    if (!archivo) return;
                    
                    console.log('Archivo de respaldo seleccionado:', archivo);
                    return window.ipcRenderer.invoke('restaurar-respaldo', archivo);
                })
                .then(resultado => {
                    if (resultado) {
                        console.log('Respaldo restaurado:', resultado);
                        this.showNotification('Respaldo restaurado correctamente. La aplicación se reiniciará.', 'success');
                        
                        // Reiniciar la aplicación después de 3 segundos
                        setTimeout(() => {
                            window.ipcRenderer.invoke('reiniciar-app');
                        }, 3000);
                    }
                })
                .catch(error => {
                    console.error('Error al restaurar respaldo:', error);
                    this.showNotification('Error al restaurar respaldo: ' + error.message, 'error');
                });
        } else {
            console.warn('ipcRenderer no disponible para restaurar respaldo');
            this.showNotification('No se puede restaurar respaldo en este momento', 'warning');
        }
    },
    
    /**
     * Imprime una página de prueba
     */
    printTest() {
        if (window.ipcRenderer) {
            // Guardar configuración primero
            this.saveConfig().then(saved => {
                if (saved) {
                    window.ipcRenderer.invoke('imprimir-prueba')
                        .then(resultado => {
                            console.log('Impresión de prueba:', resultado);
                            this.showNotification('Página de prueba enviada a la impresora', 'success');
                        })
                        .catch(error => {
                            console.error('Error al imprimir prueba:', error);
                            this.showNotification('Error al imprimir: ' + error.message, 'error');
                        });
                }
            });
        } else {
            console.warn('ipcRenderer no disponible para imprimir prueba');
            this.showNotification('No se puede imprimir en este momento', 'warning');
        }
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado - Inicializando ConfiguracionHandler');
    ConfiguracionHandler.init();
});

// Exportar para uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfiguracionHandler;
} else {
    window.ConfiguracionHandler = ConfiguracionHandler;
}
