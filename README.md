# Chat en tiempo real: Taller Streams (Bases de Datos 2)

Sistema de mensajería con **Firebase Cloud Firestore** y JavaScript. Incluye dos interfaces que comparten el mismo modelo de datos y los mismos módulos:

- **Alternativa A:** chat por consola con Node.js (`src/consola/`).
- **Alternativa B:** chat web con HTML, CSS y JavaScript (`src/web/`).

Documentación completa del diseño: [`diseño-chat.md`](./diseño-chat.md).

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (recomendado 20+).
- Un proyecto de Firebase con **Cloud Firestore** activado.

## Instalación

```bash
npm install
```

También funciona con `pnpm install` (el proyecto incluye `pnpm-lock.yaml`). Usa el mismo gestor en todo el equipo para no mezclar archivos de bloqueo.

## Configurar Firebase (`firebase.config.js`)

1. Entra a <https://console.firebase.google.com/> y crea un proyecto (o abre el existente).
2. En **Firestore Database**, crea la base de datos.
3. Ve a **Configuración del proyecto → Tus apps** y registra una app web (`</>`).
4. Copia el objeto `firebaseConfig` que te muestra Firebase.
5. Pégalo en `firebase.config.js` en la raíz del proyecto:

```js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROYECTO.firebasestorage.app",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

6. Publica las reglas de `firestore.rules` en **Firestore → Reglas**.

> No subas a un repositorio público claves privadas ni credenciales de cuentas de servicio. La configuración web no es secreta, pero la seguridad real depende de las reglas de Firestore.

## Ejecutar

### Chat por consola

```bash
npm run consola
```

1. Escribe tu **identificador** (3 a 20 caracteres: letras, números, `_` o `-`; por ejemplo `u001`).
2. Si es tu primera vez, escribe tu **nombre visible**.
3. En el menú elige **1. Mis conversaciones** o **2. Nueva conversación con un usuario**.
4. Escribe tus mensajes y pulsa Enter. Usa `/salir` para volver al menú.
5. Usa `Ctrl+C` para cerrar sesión y quedar como `offline`.

Para probar la comunicación abre **dos terminales** con identificadores distintos (por ejemplo `u001` y `u002`).

### Chat web

```bash
npm run chat:web
```

Abre <http://localhost:5173>. Para probar, usa dos pestañas con usuarios distintos.

## Estructura

```
src/
├── consola/          Alternativa A (chat.js, entrada.js, presencia.js, sala.js)
├── web/              Alternativa B (index.html, styles.css, app.js)
├── firebase.js       exporta db
├── usuarios.js       registro, presencia y lista de usuarios
├── conversaciones.js clave canónica, abrir/crear y listar conversaciones
└── mensajes.js       escuchar y enviar mensajes
firebase.config.js    configuración del proyecto Firebase
firestore.rules       reglas de seguridad
pruebas.mjs           pruebas automáticas P1 a P7
```

## Modelo de datos

```
usuarios/{uid}                       nombre, estado, lastSeen, creadoEn
conversaciones/{uidA_uidB}           participantes[], tipo, creadaEn, actualizadaEn, ultimoMensaje
conversaciones/{id}/mensajes/{id}    emisorId, texto, creadoEn
```

- El ID del usuario es independiente de su nombre visible.
- El ID de la conversación es `[uidA, uidB].sort().join("_")`, así que dos usuarios siempre comparten el mismo documento y no hay duplicados.

## Pruebas

```bash
npm run pruebas
```

Ejecuta las pruebas P1 a P7 sobre la capa de datos. Escribe datos reales en tu base (usuarios `u001` a `u003` y mensajes de prueba en `u001_u002`).

> **`npm run limpiar` borra todos los usuarios, conversaciones y mensajes de la base.** Úsalo solo si quieres empezar de cero.

## Limitaciones

- La presencia se calcula con `lastSeen` (umbral de 60 s) y no detecta desconexiones de forma infalible.
- No hay autenticación: dos personas pueden escribir el mismo identificador.
- Las reglas validan la estructura de los datos, no la identidad de quien escribe.
- Más detalle en la sección 6 de [`diseño-chat.md`](./diseño-chat.md).