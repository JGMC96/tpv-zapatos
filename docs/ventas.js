import { db } from "./firebase.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Función para guardar venta
async function guardarVentaEnFirebase(venta) {
  try {
    await addDoc(collection(db, "ventas"), {
      ...venta,
      fecha: Timestamp.now()
    });
    console.log("✅ Venta guardada en Firebase");
  } catch (e) {
    console.error("❌ Error al guardar venta:", e);
  }
}

// Función para guardar venta tanto local como en Firebase
async function guardarVenta(venta) {
  try {
    // Guardar en Firebase
    await guardarVentaEnFirebase(venta);
    
    // Guardar localmente
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('registrar-venta', venta);
    }
    
    console.log("✅ Venta guardada correctamente en ambos sistemas");
    return true;
  } catch (error) {
    console.error("❌ Error al guardar venta:", error);
    return false;
  }
}

// Ejemplo de uso
// guardarVenta({
//   producto: "Zueco Bolonia",
//   precio: 119,
//   tipo_pago: "efectivo",
//   cambio: 1,
// });
