import {collection, doc, getDocs, query, runTransaction, serverTimestamp, where} from "firebase/firestore";
import { db } from "./firebase.js";

export function claveConversacion(uidA, uidB) {
    return [String(uidA), String(uidB)].sort().join("_");
}

export async function obtenerOCrearConversacion({ uidPropio, uidOtro }) {
    if (uidPropio === uidOtro) throw new Error("No puedes abrir una conversación contigo mismo");

    const id = claveConversacion(uidPropio, uidOtro);
    const referencia = doc(db, "conversaciones", id);

    const creada = await runTransaction(db, async (transaccion) => {
        const existente = await transaccion.get(referencia);
        if (existente.exists()) return false;

        transaccion.set(referencia, {
            participantes: [String(uidPropio), String(uidOtro)].sort(),
            tipo: "privada",
            creadaEn: serverTimestamp(),
            actualizadaEn: serverTimestamp(),
            ultimoMensaje: ""
        });
        return true;
    });

    return { id, creada };
}

export async function abrirConversacion(datos) {
    return (await obtenerOCrearConversacion(datos)).id;
}

const milisegundos = (marca) => (typeof marca?.toMillis === "function" ? marca.toMillis() : 0);

export async function listarConversaciones(uid) {
    const resultado = await getDocs(
        query(collection(db, "conversaciones"), where("participantes", "array-contains", uid))
    );

    return resultado.docs
        .map((documento) => ({ id: documento.id, ...documento.data() }))
        .sort((a, b) => milisegundos(b.actualizadaEn) - milisegundos(a.actualizadaEn));
}