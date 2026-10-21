import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import { db } from "./firebase.js";

export function escucharMensajes(conversacionId, alActualizar, alError) {
    if (!conversacionId) return () => {};

    const referencia = query(
        collection(db, "conversaciones", conversacionId, "mensajes"),
        orderBy("creadoEn", "asc")
    );

    return onSnapshot(
        referencia,
        (snapshot) => {
            const mensajes = snapshot.docs.map((documento) => ({
                id: documento.id,
                ...documento.data()
            }));
            alActualizar(mensajes);
        },
        (error) => {
            console.error("Error en el listener de mensajes:", error.code ?? error.message);
            if (alError) alError(error);
        }
    );
}

export async function enviarMensaje({ conversacionId, emisorId, texto }) {
    const limpio = String(texto ?? "").trim();
    if (!limpio) return { ok: false, motivo: "El mensaje no puede estar vacío" };
    if (!conversacionId) return { ok: false, motivo: "Selecciona un usuario para conversar" };

    await addDoc(collection(db, "conversaciones", conversacionId, "mensajes"), {
        emisorId,
        texto: limpio.slice(0, 500),
        creadoEn: serverTimestamp()
    });

    await updateDoc(doc(db, "conversaciones", conversacionId), {
        ultimoMensaje: limpio.slice(0, 80),
        actualizadaEn: serverTimestamp()
    }).catch(() => {});

    return { ok: true };
}
