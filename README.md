# TPV Zapatos - Sistema de Punto de Venta

Sistema de punto de venta (TPV) para tienda de zapatos desarrollado con Electron y SQLite.

## Características

- Gestión de productos con imágenes
- Registro de ventas
- Control de inventario
- Interfaz intuitiva y fácil de usar
- Base de datos local con SQLite

## Requisitos

- Node.js (v14 o superior)
- npm (v6 o superior) o yarn

## Instalación

1. Clona este repositorio o descarga los archivos
2. Abre una terminal en la carpeta del proyecto
3. Instala las dependencias:

```bash
npm install
```

## Uso

Para iniciar la aplicación en modo desarrollo:

```bash
npm start
```

## Estructura del Proyecto

```
tpv-zapatos/
├── main.js               # Lógica principal de Electron
├── index.html            # Pantalla de ventas
├── productos.html        # Gestión de productos
├── ventas.db            # Base de datos SQLite
├── renderer.js          # Lógica del lado del cliente
├── style.css            # Estilos CSS
├── package.json         # Dependencias y scripts
└── assets/
    └── productos/       # Imágenes de los productos
```

## Capturas de Pantalla

*(Agrega capturas de pantalla de tu aplicación aquí)*

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.
