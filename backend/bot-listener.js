import { firestoreDb, FieldValue } from "./firebase-admin.js";
import { procesarPreguntaChat } from "./ia-service.js";

const BOT_USER_ID = "u_bot_cine";
const BOT_NAME = "🤖 CineBot IA (Ollama)";

export async function iniciarBotFirestore() {
  if (!firestoreDb) {
    console.warn("⚠️ Firebase Admin no está activo; el Bot de Firestore no iniciará.");
    return;
  }

  try {
    // 1. Asegurar que el usuario Bot exista en la colección "usuarios"
    const botRef = firestoreDb.collection("usuarios").doc(BOT_USER_ID);
    await botRef.set({
      nombre: BOT_NAME,
      estado: "online",
      rol: "asistente_ia",
      lastSeen: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`🤖 Bot registrado en Firestore como '${BOT_NAME}' (${BOT_USER_ID})`);

    // 2. Escuchar conversaciones privadas o menciones dirigidas al Bot
    firestoreDb.collection("conversaciones")
      .where("participantes", "array-contains", BOT_USER_ID)
      .onSnapshot((convSnapshot) => {
        convSnapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const convId = change.doc.id;
            escucharMensajesDeConversacion(convId);
          }
        });
      }, (err) => {
        console.error("Error escuchando conversaciones del bot:", err.message);
      });

  } catch (err) {
    console.error("Error al iniciar bot en Firestore:", err.message);
  }
}

const conversacionesEscuchadas = new Set();

function escucharMensajesDeConversacion(convId) {
  if (conversacionesEscuchadas.has(convId)) return;
  conversacionesEscuchadas.add(convId);

  const horaInicioServidor = new Date();

  firestoreDb.collection("conversaciones").doc(convId).collection("mensajes")
    .orderBy("creadoEn", "desc")
    .limit(1)
    .onSnapshot(async (snapshot) => {
      if (snapshot.empty) return;

      const docSnap = snapshot.docs[0];
      const msg = docSnap.data();

      // No responder a sus propios mensajes
      if (msg.emisorId === BOT_USER_ID) return;

      // Ignorar mensajes antiguos previos al arranque
      const fechaMsg = msg.creadoEn ? msg.creadoEn.toDate() : new Date();
      if (fechaMsg < new Date(horaInicioServidor.getTime() - 5000)) return;

      // Evitar responder dos veces al mismo mensaje
      if (msg.respondidoPorBot) return;

      console.log(`\n📩 Mensaje recibido para CineBot en conv [${convId}]: "${msg.texto}"`);

      // Marcar como procesando
      await docSnap.ref.update({ respondidoPorBot: true }).catch(() => {});

      // Procesar con Ollama + MongoDB
      const respuestaTexto = await procesarPreguntaChat(msg.texto);

      // Responder en Firestore a nombre del Bot
      await firestoreDb.collection("conversaciones").doc(convId).collection("mensajes").add({
        emisorId: BOT_USER_ID,
        emisorNombre: BOT_NAME,
        texto: respuestaTexto,
        creadoEn: FieldValue.serverTimestamp()
      });

      // Actualizar último mensaje de la conversación
      await firestoreDb.collection("conversaciones").doc(convId).update({
        ultimoMensaje: `🤖: ${respuestaTexto.slice(0, 60)}...`,
        actualizadaEn: FieldValue.serverTimestamp()
      });

      console.log(`✅ Respuesta de CineBot enviada a Firestore para conv [${convId}]`);
    }, (err) => {
      console.error(`Error en listener de mensajes conv ${convId}:`, err.message);
    });
}
