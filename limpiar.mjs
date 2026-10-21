import { collection, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "./src/firebase.js";

async function borrarTodo(nombre, subcolecciones = []) {
    const snap = await getDocs(collection(db, nombre));
    let borrados = 0;
    for (const documento of snap.docs) {
        for (const sub of subcolecciones) {
            const hijas = await getDocs(collection(db, nombre, documento.id, sub));
            for (const mensaje of hijas.docs) {
                await deleteDoc(mensaje.ref);
                borrados++;
            }
        }
        await deleteDoc(documento.ref);
        borrados++;
    }
    console.log(nombre + ": " + borrados + " documentos eliminados");
}

await borrarTodo("usuarios");
await borrarTodo("conversaciones", ["mensajes"]);
console.log("Base limpia.");
process.exit(0);
