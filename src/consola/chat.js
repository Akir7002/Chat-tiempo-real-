import { preguntar } from "./entrada.js";
import { iniciarPresencia } from "./presencia.js";
import { entrarChat } from "./sala.js";
import { escucharUsuarios, obtenerUsuario, registrarUsuario } from "../usuarios.js";
import { listarConversaciones, obtenerOCrearConversacion } from "../conversaciones.js";

const UID_VALIDO = /^[A-Za-z0-9_-]{3,20}$/;

async function identificar() {
    let uid = "";
    while (!UID_VALIDO.test(uid)) {
        uid = (await preguntar("Identificador (ej. u001): ")).trim();
        if (!UID_VALIDO.test(uid)) console.log("  Usa 3-20 caracteres: letras, números, _ o -");
    }

    const existente = await obtenerUsuario(uid);
    let nombre = existente?.nombre;

    if (nombre) {
        console.log(`Bienvenido de nuevo, ${nombre}.`);
    } else {
        while (!nombre) nombre = (await preguntar("Es tu primera vez. Nombre visible: ")).trim();
    }

    await registrarUsuario({ uid, nombre });
    return { uid, nombre };
}

function cargarUsuarios() {
    return new Promise((resolve, reject) => {
        const cancelar = escucharUsuarios((usuarios, desdeCache) => {
            if (desdeCache) return; // ignora el snapshot local y espera al del servidor
            cancelar();
            resolve(usuarios);
        }, reject);
    });
}

async function pedirOpcion(maximo, textoPregunta) {
    while (true) {
        const respuesta = (await preguntar(textoPregunta)).trim();
        const numero = Number(respuesta);
        if (respuesta !== "" && Number.isInteger(numero) && numero >= 0 && numero <= maximo) {
            return numero;
        }
        console.log("  Opción no válida.");
    }
}

const estadoTexto = (usuario) => (usuario.enLinea ? "online" : "offline");

async function elegirUsuario(yo) {
    const otros = (await cargarUsuarios())
        .filter((u) => u.uid !== yo.uid)
        .sort((a, b) => Number(b.enLinea) - Number(a.enLinea) || a.nombre.localeCompare(b.nombre));

    if (otros.length === 0) {
        console.log("\nNo hay otros usuarios registrados.");
        return null;
    }

    console.log("\n=== USUARIOS DISPONIBLES ===\n");
    otros.forEach((u, i) => console.log(`${i + 1}. ${u.nombre} (${u.uid}) - ${estadoTexto(u)}`));
    console.log("0. Volver");

    while (true) {
        const respuesta = (await preguntar("\nSeleccione un usuario (número o id): ")).trim();
        if (respuesta === "0") return null;

        const numero = Number(respuesta);
        if (Number.isInteger(numero) && numero >= 1 && numero <= otros.length) {
            return otros[numero - 1];
        }

        const porId = otros.find((u) => u.uid.toLowerCase() === respuesta.toLowerCase());
        if (porId) return porId;

        console.log("Opción no válida.");
    }
}

async function elegirConversacion(yo) {
    const [conversaciones, usuarios] = await Promise.all([
        listarConversaciones(yo.uid),
        cargarUsuarios()
    ]);

    if (conversaciones.length === 0) {
        console.log("\nAún no tienes conversaciones.");
        return null;
    }

    const usuariosPorId = new Map(usuarios.map((u) => [u.uid, u]));
    const items = conversaciones.map((c) => {
        const otroUid = c.participantes.find((p) => p !== yo.uid) ?? yo.uid;
        const otro = usuariosPorId.get(otroUid) ?? { uid: otroUid, nombre: otroUid, enLinea: false };
        return { id: c.id, otro, ultimoMensaje: c.ultimoMensaje };
    });

    console.log("\n=== MIS CONVERSACIONES ===\n");
    items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.otro.nombre} (${item.otro.uid}) - ${estadoTexto(item.otro)}`);
        console.log(`   ${item.ultimoMensaje ? `"${item.ultimoMensaje}"` : "(sin mensajes)"}`);
    });
    console.log("0. Volver");

    const opcion = await pedirOpcion(items.length, "\nSeleccione una conversación: ");
    return opcion === 0 ? null : items[opcion - 1];
}

const yo = await identificar();
console.log(`Sesión iniciada como ${yo.nombre} (${yo.uid})`);

const presencia = iniciarPresencia(yo.uid);

while (true) {
    console.log("\n=== MENÚ ===\n");
    console.log("1. Mis conversaciones");
    console.log("2. Nueva conversación con un usuario");
    console.log("0. Salir");

    const opcion = await pedirOpcion(2, "\nOpción: ");
    if (opcion === 0) break;

    let conversacionId;
    let destinatario;

    if (opcion === 1) {
        const elegida = await elegirConversacion(yo);
        if (!elegida) continue;
        conversacionId = elegida.id;
        destinatario = elegida.otro;
    } else {
        destinatario = await elegirUsuario(yo);
        if (!destinatario) continue;

        const { id, creada } = await obtenerOCrearConversacion({
            uidPropio: yo.uid,
            uidOtro: destinatario.uid
        });
        conversacionId = id;
        console.log(
            `\n${creada ? "Conversación nueva creada" : "Conversación existente recuperada"}: ${id}`
        );
    }

    console.log(`\nChat con ${destinatario.nombre}. Escribe /salir para volver al menú.\n`);
    await entrarChat({ yo, destinatario, conversacionId });
}

await presencia.salir();