import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "./firebase.js";

// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
let currentUser = null;
let activeConversation = null;
let unsubscribeUsers = null;
let unsubscribeGroups = null;
let unsubscribeMessages = null;
let heartbeatInterval = null;

// ==========================================
// REFERENCIAS AL DOM
// ==========================================
const myAvatar = document.getElementById("myAvatar");
const myUserName = document.getElementById("myUserName");
const myUserId = document.getElementById("myUserId");
const myStatusDot = document.getElementById("myStatusDot");

const btnSwitchAna = document.getElementById("btnSwitchAna");
const btnSwitchCarlos = document.getElementById("btnSwitchCarlos");
const btnSwitchMaria = document.getElementById("btnSwitchMaria");
const btnCustomLogin = document.getElementById("btnCustomLogin");
const btnLogout = document.getElementById("btnLogout");

const tabDirects = document.getElementById("tabDirects");
const tabGroups = document.getElementById("tabGroups");
const directsSection = document.getElementById("directsSection");
const groupsSection = document.getElementById("groupsSection");

const usersList = document.getElementById("usersList");
const userCountBadge = document.getElementById("userCountBadge");
const groupsList = document.getElementById("groupsList");
const btnOpenCreateGroup = document.getElementById("btnOpenCreateGroup");

const emptyState = document.getElementById("emptyState");
const activeChatView = document.getElementById("activeChatView");
const activeChatAvatar = document.getElementById("activeChatAvatar");
const activeChatTitle = document.getElementById("activeChatTitle");
const activeChatSubtitle = document.getElementById("activeChatSubtitle");
const activeChatTypeTag = document.getElementById("activeChatTypeTag");
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");

// Modales y notificaciones
const userLoginModal = document.getElementById("userLoginModal");
const inputUserId = document.getElementById("inputUserId");
const inputUserName = document.getElementById("inputUserName");
const btnConfirmLogin = document.getElementById("btnConfirmLogin");

const createGroupModal = document.getElementById("createGroupModal");
const inputGroupName = document.getElementById("inputGroupName");
const btnCancelCreateGroup = document.getElementById("btnCancelCreateGroup");
const btnConfirmCreateGroup = document.getElementById("btnConfirmCreateGroup");
const toastNotice = document.getElementById("toastNotice");

// Modo Oscuro / Claro
const btnToggleTheme = document.getElementById("btnToggleTheme");
const themeIcon = document.getElementById("themeIcon");

function initTheme() {
  const savedTheme = localStorage.getItem("chat_theme") || "light";
  aplicarTema(savedTheme);

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      aplicarTema(newTheme);
    });
  }
}

function aplicarTema(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeIcon) themeIcon.textContent = "☀️";
    localStorage.setItem("chat_theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (themeIcon) themeIcon.textContent = "🌙";
    localStorage.setItem("chat_theme", "light");
  }
}

// Helper global para botones de preset en el modal
window.setPreset = function(id, nombre) {
  inputUserId.value = id;
  inputUserName.value = nombre;
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();
  
  // Usamos sessionStorage para permitir que 2 pestañas del mismo navegador
  // puedan tener sesiones distintas y probar en vivo (P5)
  const savedUserJson = sessionStorage.getItem("chat_current_user");
  if (savedUserJson) {
    try {
      const user = JSON.parse(savedUserJson);
      iniciarSesion(user.id, user.nombre);
    } catch (e) {
      abrirModalLogin();
    }
  } else {
    abrirModalLogin();
  }
});

// ==========================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Cambio rápido de usuarios para pruebas (Paso 3 de la guía)
  btnSwitchAna.addEventListener("click", () => iniciarSesion("u001", "Ana"));
  btnSwitchCarlos.addEventListener("click", () => iniciarSesion("u002", "Carlos"));
  btnSwitchMaria.addEventListener("click", () => iniciarSesion("u003", "María"));
  btnCustomLogin.addEventListener("click", abrirModalLogin);

  btnLogout.addEventListener("click", cerrarSesion);

  // Tabs de navegación
  tabDirects.addEventListener("click", () => switchTab("directs"));
  tabGroups.addEventListener("click", () => switchTab("groups"));

  // Crear sala grupal
  btnOpenCreateGroup.addEventListener("click", () => {
    inputGroupName.value = "";
    createGroupModal.style.display = "flex";
    inputGroupName.focus();
  });

  btnCancelCreateGroup.addEventListener("click", () => {
    createGroupModal.style.display = "none";
  });

  btnConfirmCreateGroup.addEventListener("click", handleCrearSalaGrupal);

  inputGroupName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleCrearSalaGrupal();
  });

  // Modal Login
  btnConfirmLogin.addEventListener("click", () => {
    const id = inputUserId.value.trim();
    const nombre = inputUserName.value.trim();
    if (!id || !nombre) {
      mostrarToast("⚠️ Debes ingresar un identificador y un nombre");
      return;
    }
    userLoginModal.style.display = "none";
    iniciarSesion(id, nombre);
  });

  // Enviar mensaje
  btnSend.addEventListener("click", handleEnviarMensaje);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEnviarMensaje();
    }
  });

  // Desconexión limpia al cerrar pestaña o navegar fuera
  window.addEventListener("beforeunload", () => {
    if (currentUser) {
      // Marcamos offline en Firestore
      actualizarEstadoPresencia("offline");
    }
  });
}

function abrirModalLogin() {
  userLoginModal.style.display = "flex";
  if (!inputUserId.value) {
    inputUserId.value = "u001";
    inputUserName.value = "Ana";
  }
}

function switchTab(tab) {
  if (tab === "directs") {
    tabDirects.classList.add("active");
    tabGroups.classList.remove("active");
    directsSection.style.display = "block";
    groupsSection.style.display = "none";
  } else {
    tabGroups.classList.add("active");
    tabDirects.classList.remove("active");
    groupsSection.style.display = "block";
    directsSection.style.display = "none";
  }
}

// ==========================================
// GESTIÓN DE IDENTIDAD Y PRESENCIA (P1, P8)
// ==========================================
async function iniciarSesion(id, nombre) {
  // Limpiar sesión previa si existiera
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeGroups) unsubscribeGroups();
  if (unsubscribeMessages) unsubscribeMessages();

  activeConversation = null;
  emptyState.style.display = "block";
  activeChatView.style.display = "none";

  currentUser = { id, nombre, estado: "online" };
  sessionStorage.setItem("chat_current_user", JSON.stringify({ id, nombre }));

  // Actualizar UI del perfil
  myAvatar.firstChild.textContent = nombre.charAt(0).toUpperCase();
  myUserName.textContent = nombre;
  myUserId.textContent = `ID: ${id}`;
  myStatusDot.className = "status-dot online";

  // Registrar o actualizar usuario en Firestore (Req 1, 2)
  try {
    const userRef = doc(db, "usuarios", id);
    await setDoc(userRef, {
      nombre: nombre,
      estado: "online",
      lastSeen: serverTimestamp()
    }, { merge: true });
    console.log(`Usuario autenticado y registrado: ${nombre} (${id})`);
  } catch (error) {
    console.error("Error al registrar usuario en Firestore:", error);
  }

  // Heartbeat para mantener lastSeen actualizado periódicamente (Req 8)
  heartbeatInterval = setInterval(async () => {
    if (currentUser) {
      try {
        const userRef = doc(db, "usuarios", currentUser.id);
        await updateDoc(userRef, {
          lastSeen: serverTimestamp(),
          estado: "online"
        });
      } catch (err) {
        console.warn("Heartbeat error:", err);
      }
    }
  }, 30000); // cada 30 segundos

  // Iniciar listeners en tiempo real
  escucharUsuariosDisponibles();
  escucharSalasGrupales();
}

async function actualizarEstadoPresencia(estado) {
  if (!currentUser) return;
  try {
    const userRef = doc(db, "usuarios", currentUser.id);
    await updateDoc(userRef, {
      estado: estado,
      lastSeen: serverTimestamp()
    });
  } catch (e) {
    console.error("Error actualizando presencia:", e);
  }
}

async function cerrarSesion() {
  if (currentUser) {
    await actualizarEstadoPresencia("offline");
  }
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeGroups) unsubscribeGroups();
  if (unsubscribeMessages) unsubscribeMessages();

  currentUser = null;
  activeConversation = null;
  sessionStorage.removeItem("chat_current_user");

  myUserName.textContent = "Sin sesión";
  myUserId.textContent = "ID: --";
  myAvatar.firstChild.textContent = "?";
  myStatusDot.className = "status-dot offline";

  usersList.innerHTML = "";
  groupsList.innerHTML = "";
  messagesContainer.innerHTML = "";
  emptyState.style.display = "block";
  activeChatView.style.display = "none";

  abrirModalLogin();
}

// ==========================================
// CONSULTAR USUARIOS DISPONIBLES (P2, P8)
// ==========================================
function escucharUsuariosDisponibles() {
  const colRef = collection(db, "usuarios");
  
  // onSnapshot escucha los cambios de todos los usuarios en tiempo real
  unsubscribeUsers = onSnapshot(colRef, (snapshot) => {
    usersList.innerHTML = "";
    let count = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const uId = docSnap.id;

      // Filtrar para no mostrar al usuario actual (Req 3, P2)
      if (currentUser && uId === currentUser.id) {
        return;
      }
      count++;

      const isOnline = data.estado === "online";
      const card = document.createElement("div");
      card.className = "contact-card";
      if (activeConversation && activeConversation.otroUsuarioId === uId) {
        card.classList.add("active");
      }

      // Formatear última conexión
      let lastSeenText = "Desconectado";
      if (isOnline) {
        lastSeenText = "🟢 En línea";
      } else if (data.lastSeen && data.lastSeen.toDate) {
        const fecha = data.lastSeen.toDate();
        lastSeenText = `Visto a las ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      card.innerHTML = `
        <div class="avatar">
          ${(data.nombre || uId).charAt(0).toUpperCase()}
          <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
        </div>
        <div class="contact-info">
          <div class="contact-name-row">
            <span class="contact-name">${data.nombre || 'Sin nombre'}</span>
            <span class="contact-last-time">ID: ${uId}</span>
          </div>
          <div class="contact-status-text ${isOnline ? 'badge-online' : 'badge-offline'}">
            ${lastSeenText}
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        abrirOCrearChatPrivado({ id: uId, nombre: data.nombre || uId, estado: data.estado });
      });

      usersList.appendChild(card);
    });

    userCountBadge.textContent = `${count} disponibles`;

    if (count === 0) {
      usersList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">
          No hay otros usuarios registrados aún.<br>
          <small>Abre una segunda ventana o usa los botones de arriba para simular otro usuario.</small>
        </div>
      `;
    }
  }, (err) => {
    console.error("Error al escuchar usuarios:", err);
  });
}

// ==========================================
// SALAS GRUPALES (CONSULTAR Y CREAR)
// ==========================================
function escucharSalasGrupales() {
  const convCol = collection(db, "conversaciones");
  const q = query(convCol, where("tipo", "==", "grupal"));

  unsubscribeGroups = onSnapshot(q, (snapshot) => {
    groupsList.innerHTML = "";
    
    // Si no hay salas creadas, creamos automáticamente una Sala General por cortesía
    if (snapshot.empty) {
      crearSalaGeneralInicial();
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const gId = docSnap.id;

      const card = document.createElement("div");
      card.className = "contact-card";
      if (activeConversation && activeConversation.id === gId) {
        card.classList.add("active");
      }

      card.innerHTML = `
        <div class="avatar" style="background: #fef3c7; color: #d97706;">
          #
        </div>
        <div class="contact-info">
          <div class="contact-name-row">
            <span class="contact-name">${data.nombre || 'Sala sin nombre'}</span>
          </div>
          <div class="contact-status-text">
            ${data.ultimoMensaje ? data.ultimoMensaje : 'Sala grupal de estudiantes'}
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        abrirSalaGrupal({ id: gId, nombre: data.nombre || 'Sala Grupal' });
      });

      groupsList.appendChild(card);
    });
  }, (err) => {
    console.error("Error al escuchar salas grupales:", err);
  });
}

async function crearSalaGeneralInicial() {
  try {
    const salaGeneralRef = doc(db, "conversaciones", "grupal_sala_general");
    const docSnap = await getDoc(salaGeneralRef);
    if (!docSnap.exists()) {
      await setDoc(salaGeneralRef, {
        tipo: "grupal",
        nombre: "Sala General Estudiantes",
        creadorId: "sistema",
        creadaEn: serverTimestamp(),
        actualizadaEn: serverTimestamp(),
        ultimoMensaje: "¡Bienvenidos a la sala grupal!"
      });
    }
  } catch (e) {
    console.log("Creación de sala inicial omitida:", e);
  }
}

async function handleCrearSalaGrupal() {
  const nombre = inputGroupName.value.trim();
  if (!nombre) {
    mostrarToast("⚠️ El nombre de la sala no puede estar vacío");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "conversaciones"), {
      tipo: "grupal",
      nombre: nombre,
      creadorId: currentUser.id,
      creadorNombre: currentUser.nombre,
      creadaEn: serverTimestamp(),
      actualizadaEn: serverTimestamp(),
      ultimoMensaje: "Sala creada"
    });
    createGroupModal.style.display = "none";
    abrirSalaGrupal({ id: docRef.id, nombre: nombre });
  } catch (error) {
    console.error("Error al crear sala:", error);
    mostrarToast("Error al crear la sala");
  }
}

// ==========================================
// ABRIR O CREAR CONVERSACIÓN PRIVADA (P3, P5, P7)
// Evita crear conversaciones duplicadas (Req 5)
// ==========================================
async function abrirOCrearChatPrivado(destinatario) {
  if (!currentUser) return;

  // Clave determinista: orden canónico de identificadores (ej: privada_u001_u002)
  // Esto garantiza consistencia 100% y previene conversaciones duplicadas
  const participantes = [currentUser.id, destinatario.id].sort();
  const convId = `privada_${participantes[0]}_${participantes[1]}`;

  try {
    const convRef = doc(db, "conversaciones", convId);
    const convDoc = await getDoc(convRef);

    if (!convDoc.exists()) {
      // Si no existe, se crea con los datos mínimos especificados en la arquitectura
      await setDoc(convRef, {
        tipo: "privada",
        participantes: participantes,
        nombresParticipantes: [currentUser.nombre, destinatario.nombre],
        creadaEn: serverTimestamp(),
        actualizadaEn: serverTimestamp(),
        ultimoMensaje: ""
      });
      console.log(`Nueva conversación privada creada: ${convId}`);
    } else {
      console.log(`Reutilizando conversación existente: ${convId}`);
    }

    establecerConversacionActiva({
      id: convId,
      tipo: "privada",
      nombre: destinatario.nombre,
      otroUsuarioId: destinatario.id,
      subtitle: destinatario.estado === "online" ? "🟢 En línea" : "Desconectado"
    });

  } catch (error) {
    console.error("Error abriendo conversación privada:", error);
    mostrarToast("Error al abrir conversación");
  }
}

function abrirSalaGrupal(sala) {
  establecerConversacionActiva({
    id: sala.id,
    tipo: "grupal",
    nombre: sala.nombre,
    subtitle: "Sala Grupal - Todos los estudiantes"
  });
}

// ==========================================
// ESCUCHAR MENSAJES EN TIEMPO REAL (P4, P5, P7)
// ==========================================
function establecerConversacionActiva(conv) {
  // P7: Al cambiar de conversación, cancelar la suscripción anterior
  // para evitar escuchar mensajes de varias conversaciones al mismo tiempo
  if (unsubscribeMessages) {
    console.log("Cancelando listener de conversación anterior...");
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  activeConversation = conv;

  // Actualizar UI del chat activo
  emptyState.style.display = "none";
  activeChatView.style.display = "flex";

  activeChatTitle.textContent = conv.nombre;
  activeChatSubtitle.textContent = conv.subtitle || "";
  activeChatTypeTag.textContent = conv.tipo === "privada" ? "Chat Privado (1 a 1)" : "Sala Grupal";
  activeChatAvatar.textContent = conv.tipo === "grupal" ? "#" : conv.nombre.charAt(0).toUpperCase();

  // Limpiar contenedor de mensajes antes de cargar nuevos (P5, P7)
  messagesContainer.innerHTML = `
    <div style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; margin-top: 20px;">
      Cargando historial de mensajes en tiempo real...
    </div>
  `;

  // Resaltar tarjeta activa en la lista lateral
  actualizarTarjetasActivas();

  // Escuchar la subcolección "mensajes" ordenada por "creadoEn" asc (Req 7, Paso 7)
  const mensajesCol = collection(db, "conversaciones", conv.id, "mensajes");
  const q = query(mensajesCol, orderBy("creadoEn", "asc"));

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";

    if (snapshot.empty) {
      messagesContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-top: 40px;">
          💬 No hay mensajes en esta conversación todavía.<br>¡Escribe el primer mensaje!
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      renderizarMensaje(msg);
    });

    // Auto-scroll al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, (error) => {
    console.error("Error al escuchar mensajes:", error);
    messagesContainer.innerHTML = `<div style="color: red; text-align: center;">Error al cargar mensajes: ${error.message}</div>`;
  });

  messageInput.focus();
}

function actualizarTarjetasActivas() {
  document.querySelectorAll(".contact-card").forEach(c => c.classList.remove("active"));
}

function renderizarMensaje(msg) {
  const isSelf = currentUser && msg.emisorId === currentUser.id;
  const row = document.createElement("div");
  row.className = `message-row ${isSelf ? 'self' : 'other'}`;

  // Formatear timestamp de Firestore (Paso 7: [10:31] Ana: Hola)
  let horaTexto = "Enviando...";
  if (msg.creadoEn && msg.creadoEn.toDate) {
    const fecha = msg.creadoEn.toDate();
    horaTexto = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  bubble.innerHTML = `
    ${!isSelf ? `<div class="msg-sender">${escapeHtml(msg.emisorNombre || msg.emisorId)}</div>` : ''}
    <div class="msg-text">${escapeHtml(msg.texto)}</div>
    <div class="msg-time">${horaTexto}</div>
  `;

  row.appendChild(bubble);
  messagesContainer.appendChild(row);
}

// ==========================================
// ENVIAR MENSAJES (P4, P6)
// ==========================================
async function handleEnviarMensaje() {
  if (!currentUser) {
    mostrarToast("Debes identificarte primero");
    return;
  }
  if (!activeConversation) {
    mostrarToast("Selecciona un chat antes de enviar un mensaje");
    return;
  }

  const texto = messageInput.value.trim();

  // P6: Enviar un mensaje vacío -> El sistema lo rechaza obligatoriamente
  if (!texto || texto.length === 0) {
    mostrarToast("⚠️ No puedes enviar un mensaje vacío (Prueba P6)");
    messageInput.focus();
    return;
  }

  // Limpiar input de inmediato para respuesta ágil
  messageInput.value = "";

  try {
    // 1. Guardar mensaje en la subcolección mensajes de Firestore (Req 6)
    const mensajesCol = collection(db, "conversaciones", activeConversation.id, "mensajes");
    await addDoc(mensajesCol, {
      emisorId: currentUser.id,
      emisorNombre: currentUser.nombre,
      texto: texto,
      creadoEn: serverTimestamp()
    });

    // 2. Actualizar último mensaje y fecha de la conversación
    const convRef = doc(db, "conversaciones", activeConversation.id);
    await updateDoc(convRef, {
      ultimoMensaje: texto,
      actualizadaEn: serverTimestamp()
    });

    console.log("Mensaje enviado y persistido correctamente en Firestore");
  } catch (error) {
    console.error("Error al enviar el mensaje:", error);
    mostrarToast("Error al enviar mensaje: " + error.message);
  }
}

// ==========================================
// HELPERS & UTILITARIOS
// ==========================================
function mostrarToast(mensaje) {
  toastNotice.textContent = mensaje;
  toastNotice.style.display = "block";
  setTimeout(() => {
    toastNotice.style.display = "none";
  }, 2800);
}

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
