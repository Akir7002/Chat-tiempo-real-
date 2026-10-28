import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const INTERVALO_PULSO = 20000;
const UMBRAL_OFFLINE = 60000;


export async function obtenerUsuario(uid){
    const documento = await getDoc(doc(db, "usuarios", uid)); 
    return documento.exists() ? documento.data() : null;
}

export async function registrarUsuario({ uid, nombre }) {
    const existente = await getDoc(doc(db, "usuarios", uid));
    const datos = { nombre, estado: "online", lastSeen: serverTimestamp() };
    if (!existente.exists()) datos.creadoEn = serverTimestamp();
    await setDoc(doc(db, "usuarios", uid), datos, { merge: true });
}

export function iniciarCorazon({ uid }) {
    const referencia = doc(db, "usuarios", uid);

    const latir = () =>
        updateDoc(referencia, { estado: "online", lastSeen: serverTimestamp() }).catch(() => {});

    const pulso = setInterval(latir, INTERVALO_PULSO);

    return {
        latir,
        async desconectar() {
            clearInterval(pulso);
            try {
                await updateDoc(referencia, { estado: "offline" });
            } catch {}
        }
    };
}

function estaReciente(lastSeen, ahora) {
    if (lastSeen === null || lastSeen === undefined) return true;
    const milisegundos =
        typeof lastSeen.toMillis === "function" ? lastSeen.toMillis() : Number(lastSeen);
    if (!Number.isFinite(milisegundos)) return true;
    return ahora - milisegundos < UMBRAL_OFFLINE;
}

export function escucharUsuarios(alActualizar, alError) {
    return onSnapshot(
        collection(db, "usuarios"),
        (snapshot) => {
            const ahora = Date.now();
            const usuarios = snapshot.docs.map((documento) => {
                const datos = documento.data();
                return {
                    uid: documento.id,
                    nombre: datos.nombre ?? "sin nombre",
                    estado: datos.estado ?? "offline",
                    lastSeen: datos.lastSeen ?? null,
                    enLinea: datos.estado === "online" && estaReciente(datos.lastSeen, ahora)
                };
            });
            alActualizar(usuarios, snapshot.metadata.fromCache);;
        },
        (error) => {
            console.error("Error en el listener de usuarios:", error.code ?? error.message);
            if (alError) alError(error);
        }
    );
}
