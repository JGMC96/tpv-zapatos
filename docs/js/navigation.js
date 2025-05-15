/**
 * Sistema de navegación de la aplicación TPV Zapatos
 * Este archivo proporciona funciones para navegar entre las diferentes pantallas
 * de forma consistente y confiable.
 */

// Funciones de navegación
const Navigation = {
    /**
     * Navega a una página específica
     * @param {string} page - Nombre de la página a la que navegar
     */
    goTo(page) {
        console.log(`Navegando a: ${page}`);
        window.location.href = page;
    },

    /**
     * Navega a la página de ventas (punto de venta)
     */
    goToVentas() {
        this.goTo('index.html');
    },

    /**
     * Navega a la página de productos
     */
    goToProductos() {
        this.goTo('productos.html');
    },

    /**
     * Navega a la página de historial de ventas
     */
    goToHistorial() {
        this.goTo('historial.html');
    },

    /**
     * Navega a la página de configuración
     */
    goToConfiguracion() {
        this.goTo('configuracion.html');
    },

    /**
     * Navega al menú principal
     */
    goToMenu() {
        this.goTo('menu.html');
    },

    /**
     * Cierra la aplicación
     */
    exit() {
        if (window.electron) {
            window.electron.close();
        } else {
            window.close();
        }
    },

    /**
     * Inicializa los botones de navegación en la página actual
     */
    initNavButtons() {
        // Botón volver al menú
        const btnMenu = document.querySelector('.btn-volver, #btn-volver, .btn-menu, #btn-menu');
        if (btnMenu) {
            btnMenu.addEventListener('click', () => this.goToMenu());
            console.log('Botón de menú inicializado');
        }

        // Botones adicionales (específicos de cada página)
        const navButtons = {
            '#btnVentas, .btn-venta': this.goToVentas.bind(this),
            '#btnProductos, .btn-productos': this.goToProductos.bind(this),
            '#btnHistorial, .btn-ventas': this.goToHistorial.bind(this),
            '#btnConfiguracion, .btn-config': this.goToConfiguracion.bind(this),
            '#btnSalir, .btn-salir': this.exit.bind(this)
        };

        // Agregar event listeners a los botones de navegación
        Object.entries(navButtons).forEach(([selector, handler]) => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                btn.addEventListener('click', handler);
                console.log(`Botón de navegación inicializado: ${selector}`);
            });
        });
    }
};

// Inicializar botones de navegación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando sistema de navegación...');
    Navigation.initNavButtons();
});

// Exportar para uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
} else {
    window.Navigation = Navigation;
}
