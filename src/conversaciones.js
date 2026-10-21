import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export function claveConversacion(uidA, uidB) {
    return [String(uidA), String(uidB)].sort().join("_");
}

export async function abrirConversacion({ uidPropio, uidOtro }) {
    const id = claveConversacion(uidPropio, uidOtro);
    const referencia = doc(db, "conversaciones", id);

    const existente = await getDoc(referencia);
    if (!existente.exists()) {
        await setDoc(referencia, {
            participantes: [String(uidPropio), String(uidOtro)].sort(),
            tipo: "privada",
            creadoEn: serverTimestamp(),
            actualizadaEn: serverTimestamp(),
            ultimoMensaje: ""
        });
    }

    return id;
}
