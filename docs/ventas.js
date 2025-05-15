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

// Ejemplo de uso
// guardarVentaEnFirebase({
//   producto: "Zueco Bolonia",
//   precio: 119,
//   tipo_pago: "efectivo",
//   cambio: 1,
// });
