import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "./src/firebase.js";
import { registrarUsuario, escucharUsuarios } from "./src/usuarios.js";
import { claveConversacion, abrirConversacion, obtenerOCrearConversacion } from "./src/conversaciones.js";
import { escucharMensajes, enviarMensaje } from "./src/mensajes.js";

const fallos = [];
const ok = (id, condicion, detalle) => {
    console.log((condicion ? "OK  " : "FAIL") + " " + id + " — " + detalle);
    if (!condicion) fallos.push(id);
};

const esperar = (funcion, ms = 10000) =>
    new Promise((resolve) => {
        const limite = Date.now() + ms;
        (function revisar() {
            Promise.resolve(funcion()).then((valor) => {
                if (valor) return resolve(valor);
                if (Date.now() > limite) return resolve(null);
                setTimeout(revisar, 250);
            });
        })();
    });

// P1: registrar dos usuarios con identificadores únicos
await registrarUsuario({ uid: "u001", nombre: "Ana" });
await registrarUsuario({ uid: "u002", nombre: "Carlos" });
const docs = await getDocs(collection(db, "usuarios"));
const ids = docs.docs.map((d) => d.id);
ok("P1", "u001" !== "u002" && ids.includes("u001") && ids.includes("u002"),
    "dos usuarios registrados con ids únicos: u001, u002");

// P2: consultar usuarios disponibles (diferentes del actual)
const lista = await esperar(
    () =>
        new Promise((resolve) => {
            const cancelar = escucharUsuarios((usuarios) => {
                cancelar();
                resolve(usuarios);
            });
        })
);
const otros = (lista || []).filter((u) => u.uid !== "u001");
ok("P2", otros.length >= 1,
    "usuarios consultados distintos del actual: " + otros.map((u) => u.nombre + " (" + u.uid + ")").join(", "));

// P3: seleccionar destinatario ⇒ misma conversación desde cualquier lado
const idPorAna = await abrirConversacion({ uidPropio: "u001", uidOtro: "u002" });
const idPorCarlos = await abrirConversacion({ uidPropio: "u002", uidOtro: "u001" });
ok("P3", idPorAna === idPorCarlos && idPorAna === claveConversacion("u001", "u002"),
    "clave canónica idempotente: " + idPorAna);

// P7 (duplicados): exactamente una conversación entre ese par
const mias = await getDocs(
    query(collection(db, "conversaciones"), where("participantes", "array-contains", "u001"))
);
const delPar = mias.docs.filter((d) => d.data().participantes.includes("u002"));
ok("P7", delPar.length === 1,
    "array-contains + filtro de par ⇒ 1 conversación (sin duplicados)");

// P4 + P5: el listener recibe el mensaje en tiempo real y queda almacenado
const marcador = "hola-tiempo-real-" + Date.now();
const recibidos = [];
const cancelar1 = escucharMensajes(idPorAna, (mensajes) => recibidos.push(...mensajes));
await enviarMensaje({ conversacionId: idPorAna, emisorId: "u001", texto: marcador });
const llego = await esperar(() => recibidos.some((m) => m.texto === marcador));
ok("P5", !!llego, "el listener entregó el mensaje sin recargar");
const almacenados = await getDocs(collection(db, "conversaciones", idPorAna, "mensajes"));
const guardado = almacenados.docs.find((d) => d.data().texto === marcador);
ok("P4", !!guardado && guardado.data().emisorId === "u001",
    "mensaje persistido con emisorId correcto");
cancelar1();

// P6: mensaje vacío rechazado
const antes = (await getDocs(collection(db, "conversaciones", idPorAna, "mensajes"))).size;
const rechazado = await enviarMensaje({ conversacionId: idPorAna, emisorId: "u001", texto: "   " });
const despues = (await getDocs(collection(db, "conversaciones", idPorAna, "mensajes"))).size;
ok("P6", rechazado.ok === false && antes === despues,
    "texto vacío rechazado, sin documento nuevo");

// P7: cambiar de conversación cancela el listener anterior
await registrarUsuario({ uid: "u003", nombre: "Diego" });
const idAnaDiego = await abrirConversacion({ uidPropio: "u001", uidOtro: "u003" });
const cancelar2 = escucharMensajes(idPorAna, () => {});
cancelar2();
const trasCambio = [];
const cancelar3 = escucharMensajes(idAnaDiego, (mensajes) => trasCambio.push(...mensajes));
await enviarMensaje({ conversacionId: idPorAna, emisorId: "u002", texto: "no-me-deben-ver" });
await new Promise((r) => setTimeout(r, 4000));
ok("P7", !trasCambio.some((m) => m.texto === "no-me-deben-ver"),
    "cancelar el listener evita mezclar conversaciones");
cancelar3();

// P8 (extra): concurrencia, dos clientes abren la misma conversación a la vez
const sufijo = Date.now();
const uidX = "conc" + sufijo + "a";
const uidY = "conc" + sufijo + "b";

const simultaneas = await Promise.all([
    obtenerOCrearConversacion({ uidPropio: uidX, uidOtro: uidY }),
    obtenerOCrearConversacion({ uidPropio: uidY, uidOtro: uidX })
]);

const idsDistintos = new Set(simultaneas.map((r) => r.id));
const quienCreo = simultaneas.filter((r) => r.creada).length;
const docsConc = await getDocs(
    query(collection(db, "conversaciones"), where("participantes", "array-contains", uidX))
);

ok("P8", idsDistintos.size === 1 && docsConc.size === 1 && quienCreo === 1,
    "2 aperturas simultáneas ⇒ " + docsConc.size + " documento, creado por " + quienCreo + " de 2 llamadas");

// P9 (extra): las reglas rechazan escrituras que rompen el modelo
const rechazada = async (accion) => {
    try {
        await accion();
        return false;
    } catch (error) {
        return error.code === "permission-denied";
    }
};

const emisorAjeno = await rechazada(() =>
    addDoc(collection(db, "conversaciones", idPorAna, "mensajes"), {
        emisorId: "intruso",
        texto: "no debería poder escribir aquí",
        creadoEn: serverTimestamp()
    })
);
const idFalso = await rechazada(() =>
    setDoc(doc(db, "conversaciones", "id-inventado"), {
        participantes: ["u001", "u002"],
        tipo: "privada",
        creadaEn: serverTimestamp(),
        actualizadaEn: serverTimestamp(),
        ultimoMensaje: ""
    })
);
ok("P9", emisorAjeno && idFalso,
    "emisor ajeno rechazado: " + emisorAjeno + "; ID no canónico rechazado: " + idFalso);
console.log("\n" + (fallos.length ? "FALLARON: " + fallos.join(", ") : "TODAS LAS PRUEBAS OK (P1–P9)"));
process.exit(fallos.length ? 1 : 0);
