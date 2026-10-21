import { registrarUsuario, iniciarCorazon, escucharUsuarios } from "../usuarios.js";
import { abrirConversacion } from "../conversaciones.js";
import { escucharMensajes, enviarMensaje } from "../mensajes.js";

const acceso = document.getElementById("acceso");
const formAcceso = document.getElementById("form-acceso");
const campoId = document.getElementById("usuario-id");
const campoNombre = document.getElementById("nombre");
const accesoAviso = document.getElementById("acceso-aviso");
const chat = document.getElementById("chat");
const miIdentidad = document.getElementById("mi-identidad");
const punto = document.getElementById("punto");
const estadoTexto = document.getElementById("estado-texto");
const btnSalir = document.getElementById("btn-salir");
const conteo = document.getElementById("conteo");
const listaUsuarios = document.getElementById("lista-usuarios");
const listaVacia = document.getElementById("lista-vacia");
const tituloConversacion = document.getElementById("conversacion-titulo");
const areaMensajes = document.getElementById("mensajes");
const aviso = document.getElementById("aviso");
const formMensaje = document.getElementById("form-mensaje");
const campoTexto = document.getElementById("texto");

let sesion = null;
let corazon = null;
let cancelarUsuarios = null;
let cancelarMensajes = null;
let conversacionActual = null;
let destinatarioActual = null;
let ultimaLista = [];
let mapaNombres = new Map();

function marcarConexion(conectado, texto) {
    punto.className = "punto" + (conectado ? " conectado" : " error");
    estadoTexto.textContent = texto;
}

function mostrarAviso(elemento, texto) {
    elemento.textContent = texto || "";
    elemento.classList.toggle("oculto", !texto);
}

function formatearHora(creadoEn) {
    let fecha = null;
    if (creadoEn && typeof creadoEn.toDate === "function") fecha = creadoEn.toDate();
    else if (typeof creadoEn === "number") fecha = new Date(creadoEn);
    if (!fecha || Number.isNaN(fecha.getTime())) fecha = new Date();
    return fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function textoVacio(cadena) {
    return cadena.trim().length === 0;
}

/* ---------- Entrada ---------- */
formAcceso.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const id = campoId.value.trim();
    const nombre = campoNombre.value.trim();

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(id)) {
        mostrarAviso(accesoAviso, "El identificador debe tener de 3 a 20 caracteres: letras, números, _ o -");
        return;
    }
    if (!nombre) {
        mostrarAviso(accesoAviso, "Escribe tu nombre visible");
        return;
    }

    sesion = { uid: id, nombre };
    mostrarAviso(accesoAviso, null);

    try {
        await registrarUsuario({ uid: id, nombre });
    } catch (error) {
        console.error(error);
        mostrarAviso(accesoAviso, "No se pudo registrar: " + (error.code ?? "error"));
        sesion = null;
        return;
    }
    corazon = iniciarCorazon({ uid: id });

    acceso.classList.add("oculto");
    chat.classList.remove("oculto");
    miIdentidad.textContent = nombre + " · id: " + id;
    campoTexto.focus();

    cancelarUsuarios = escucharUsuarios(actualizarUsuarios, () =>
        marcarConexion(false, "Sin conexión")
    );
});

/* ---------- Lista de usuarios ---------- */
function actualizarUsuarios(usuarios) {
    marcarConexion(true, "En línea");
    ultimaLista = usuarios;
    mapaNombres = new Map(usuarios.map((usuario) => [usuario.uid, usuario.nombre]));
    mapaNombres.set(sesion.uid, sesion.nombre);

    const disponibles = usuarios.filter((usuario) => usuario.uid !== sesion.uid);
    conteo.textContent = String(disponibles.length);
    listaUsuarios.replaceChildren();
    listaVacia.classList.toggle("oculto", disponibles.length > 0);

    for (const usuario of disponibles) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className =
            "usuario" + (destinatarioActual === usuario.uid ? " seleccionado" : "");

        const puntoUsuario = document.createElement("span");
        puntoUsuario.className = "punto-usuario" + (usuario.enLinea ? " en-linea" : "");

        const nombreSpan = document.createElement("span");
        nombreSpan.className = "usuario-nombre";
        nombreSpan.textContent = usuario.nombre;

        const estadoSpan = document.createElement("span");
        estadoSpan.className = "usuario-estado";
        estadoSpan.textContent = usuario.enLinea ? "online" : "offline";

        boton.append(puntoUsuario, nombreSpan, estadoSpan);
        boton.addEventListener("click", () => seleccionarUsuario(usuario));

        const item = document.createElement("li");
        item.append(boton);
        listaUsuarios.append(item);
    }
}

/* ---------- Selección de destinatario ---------- */
async function seleccionarUsuario(usuario) {
    destinatarioActual = usuario.uid;
    actualizarUsuarios(ultimaLista);
    mostrarAviso(aviso, null);
    tituloConversacion.textContent = "Conversación con: " + usuario.nombre;
    areaMensajes.replaceChildren();
    const cargando = document.createElement("p");
    cargando.className = "mensajes-vacio";
    cargando.textContent = "Abriendo conversación…";
    areaMensajes.append(cargando);

    if (cancelarMensajes) {
        cancelarMensajes();
        cancelarMensajes = null;
        conversacionActual = null;
    }

    try {
        const id = await abrirConversacion({ uidPropio: sesion.uid, uidOtro: usuario.uid });
        conversacionActual = id;
        cancelarMensajes = escucharMensajes(id, actualizarMensajes, () =>
            marcarConexion(false, "Sin conexión")
        );
    } catch (error) {
        console.error(error);
        mostrarAviso(aviso, "No se pudo abrir la conversación");
    }
}

/* ---------- Mensajes en tiempo real ---------- */
function actualizarMensajes(mensajes) {
    marcarConexion(true, "En línea");

    const cercaDelFinal =
        areaMensajes.scrollHeight - areaMensajes.scrollTop - areaMensajes.clientHeight < 130;

    areaMensajes.replaceChildren();

    if (mensajes.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "mensajes-vacio";
        vacio.textContent = "No hay mensajes todavía. ¡Saluda!";
        areaMensajes.append(vacio);
        return;
    }

    for (const mensaje of mensajes) {
        const propio = mensaje.emisorId === sesion.uid;

        const caja = document.createElement("article");
        caja.className = "mensaje" + (propio ? " propio" : "");

        const hora = document.createElement("time");
        hora.textContent = formatearHora(mensaje.creadoEn);

        const emisor = document.createElement("span");
        emisor.className = "emisor";
        emisor.textContent = propio
            ? "Tú"
            : mapaNombres.get(mensaje.emisorId) ||
              String(mensaje.emisorId).slice(0, 10) + "…";

        const cuerpo = document.createElement("span");
        cuerpo.className = "cuerpo";
        cuerpo.textContent = mensaje.texto;

        caja.append(hora, emisor, cuerpo);
        areaMensajes.append(caja);
    }

    if (cercaDelFinal || mensajes.length <= 1) {
        areaMensajes.scrollTop = areaMensajes.scrollHeight;
    }
}

/* ---------- Envío ---------- */
formMensaje.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!sesion) return;

    if (textoVacio(campoTexto.value)) {
        mostrarAviso(aviso, "El mensaje no puede estar vacío");
        return;
    }
    if (!conversacionActual) {
        mostrarAviso(aviso, "Selecciona un usuario de la lista para conversar");
        return;
    }

    const texto = campoTexto.value;
    campoTexto.value = "";
    mostrarAviso(aviso, null);

    const resultado = await enviarMensaje({
        conversacionId: conversacionActual,
        emisorId: sesion.uid,
        texto
    });

    if (!resultado.ok) {
        campoTexto.value = texto;
        mostrarAviso(aviso, resultado.motivo);
    }
    campoTexto.focus();
});

/* ---------- Salida ---------- */
btnSalir.addEventListener("click", () => {
    if (corazon) corazon.desconectar();
    window.location.reload();
});

window.addEventListener("beforeunload", () => {
    if (corazon) corazon.desconectar();
    if (cancelarMensajes) cancelarMensajes();
    if (cancelarUsuarios) cancelarUsuarios();
});
