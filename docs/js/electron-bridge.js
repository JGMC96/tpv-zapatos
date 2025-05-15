/**
 * Puente para acceder a las APIs de Electron desde cualquier script
 * Este archivo garantiza que ipcRenderer está disponible globalmente
 */

// Importar ipcRenderer desde Electron si estamos en un entorno Electron
try {
    const { ipcRenderer } = require('electron');
    
    // Exponer ipcRenderer a window para que otros scripts puedan acceder a él
    window.ipcRenderer = ipcRenderer;
    
    console.log('Electron Bridge: ipcRenderer inicializado y expuesto globalmente');
} catch (error) {
    console.warn('Electron Bridge: No se pudo inicializar ipcRenderer', error);
    
    // Crear un objeto simulado para entornos donde Electron no está disponible
    // Esto evitará errores pero no funcionará realmente
    window.ipcRenderer = {
        invoke: (channel, ...args) => {
            console.warn(`Electron Bridge: Llamada simulada a ipcRenderer.invoke('${channel}')`, args);
            return Promise.reject(new Error('ipcRenderer no disponible en este entorno'));
        },
        send: (channel, ...args) => {
            console.warn(`Electron Bridge: Llamada simulada a ipcRenderer.send('${channel}')`, args);
        },
        on: (channel, listener) => {
            console.warn(`Electron Bridge: Llamada simulada a ipcRenderer.on('${channel}')`, listener);
            return { remove: () => {} };
        },
        removeListener: (channel, listener) => {
            console.warn(`Electron Bridge: Llamada simulada a ipcRenderer.removeListener('${channel}')`, listener);
        }
    };
}

// Exponer una función para verificar si estamos en un entorno Electron
window.isElectronEnvironment = () => {
    return window.navigator && window.navigator.userAgent.indexOf('Electron') !== -1;
};

console.log('Electron Bridge: Inicializado');
console.log('¿Entorno Electron?', window.isElectronEnvironment() ? 'Sí' : 'No');
