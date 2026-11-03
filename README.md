# Sistema de Chat en Tiempo Real con Integración de Modelos Locales IA (Ollama)

> **Rama:** `dev-Mauricio-perez`  
> **Proyecto:** Chat en Tiempo Real - Bases de Datos 2  
> **Tecnologías:** Firebase Firestore (SDK Modular), Node.js (ESM), Ollama (Modelos Locales: `qwen2.5:3b`, `nomic-embed-text`), MongoDB Atlas, HTML5 / CSS3 Moderno (Light & Dark Theme).

---

## 🌟 Características Principales

### 1. Sistema de Chat en Tiempo Real (Cloud Firestore)
- **Mensajería Instantánea:** Comunicación reactiva y sin recargas mediante listeners `onSnapshot()`.
- **Chats Privados (1 a 1):** Generación determinista y canónica de IDs de conversación (`privada_minId_maxId`) para garantizar consistencia y evitar salas duplicadas.
- **Salas Grupales:** Creación y participación en salas grupales para múltiples usuarios en simultáneo.
- **Gestión de Presencia y Disponibilidad:** Detección de estado `online`/`offline`, monitoreo de `lastSeen` con heartbeat periódico y eventos de desconexión limpia.
- **Selector Rápido de Usuarios (Presets):** Acceso rápido para pruebas de concurrencia y validación de rúbrica (Ana `u001`, Carlos `u002`, María `u003` o usuarios personalizados).
- **Interfaz Moderna y Adaptativa:** Selector de tema Claro/Oscuro con persistencia en `localStorage`, avatares y notificaciones tipo toast para validaciones de mensaje vacío (Requisito P6).

### 2. Integraciones de Modelos Locales de Inteligencia Artificial (Ollama)
- **🤖 CineBot IA en Firestore (`u_bot_cine`):**  
  El asistente virtual está registrado como un usuario más en Firestore. Al abrir una conversación privada con CineBot, un listener en el backend intercepta las preguntas en tiempo real, procesa la consulta con Ollama y responde automáticamente en la conversación.
- **🛡️ Generador de Consultas y Validador de Seguridad (`qwen2.5:3b`):**  
  Traduce preguntas en lenguaje natural a filtros estructurados de MongoDB. Pasa por un estricto validador de seguridad en JavaScript que restringe campos (`title`, `year`, `genres`, `directors`, `cast`, `runtime`, `imdb.rating`) y operadores autorizados (`$and`, `$or`, `$gt`, `$gte`, `$lt`, `$lte`, `$eq`, `$ne`, `$in`), bloqueando cualquier inyección NoSQL o comando de modificación.
- **🔍 Búsqueda Semántica Vectorial (`nomic-embed-text`):**  
  Permite generar embeddings densos (768 dimensiones) para búsquedas por similitud de cosenos (`$vectorSearch`) en MongoDB Atlas sobre tramas y descripciones de películas. Si una pregunta descriptiva no coincide con filtros exactos, el sistema realiza automáticamente una búsqueda semántica.
- **🌐 Endpoint REST API (`/api/chat-ia`):**  
  Endpoint HTTP `POST /api/chat-ia` para consultar el servicio de IA local de forma desacoplada.

---

## 📁 Estructura del Proyecto

```text
├── backend/
│   ├── bot-listener.js       # Listener en tiempo real de Firestore para CineBot
│   ├── firebase-admin.js     # Inicialización segura de Firebase Admin SDK
│   ├── ia-service.js         # Lógica de Ollama (qwen2.5:3b, nomic-embed-text) y MongoDB Atlas
│   └── server.js             # Servidor HTTP: API REST, archivos estáticos y arranque de servicios
├── scripts/
│   ├── generar-embeddings.js # Generación de vectores de 768 dimensiones con nomic-embed-text
│   └── buscar-vector.js      # Pruebas CLI de $vectorSearch semántico en MongoDB Atlas
├── src/
│   ├── conversaciones.js     # Helpers canónicos de Firestore para conversaciones
│   ├── firebase.js           # Exportación unificada de Firestore
│   ├── mensajes.js           # Suscripción y envío de mensajes
│   ├── usuarios.js           # Registro y listado de usuarios
│   └── web/
│       ├── app.js            # Lógica cliente: listeners, presencia, salas y UI interactiva
│       ├── firebase.js       # Configuración modular del cliente web (Google CDN)
│       ├── index.html        # Estructura del chat web, modales y panel lateral
│       └── styles.css        # Estilos modernos, temas Claro/Oscuro y diseño responsive
├── .env.example              # Plantilla documentada de variables de entorno
├── .gitignore                # Reglas de exclusión (protección de credenciales y binarios)
├── firebase.config.js        # Configuración base de Firebase del proyecto
├── firestore.rules           # Reglas de seguridad de Firestore
├── limpiar.mjs               # Script para purgar colecciones de prueba
├── package.json              # Configuración y scripts npm/pnpm
├── pruebas.mjs               # Suite de pruebas automatizadas (P1–P7)
└── server.js                 # Punto de entrada principal (ejecuta backend/server.js)
```

---

## 🚀 Requisitos Previos e Instalación

### 1. Prerrequisitos
- **Node.js** (v18 o superior) y **pnpm** (o npm).
- **Ollama** instalado localmente ([ollama.com](https://ollama.com)).
  ```bash
  # Descargar los modelos necesarios en tu máquina local:
  ollama pull qwen2.5:3b
  ollama pull nomic-embed-text
  ```
- **MongoDB Atlas:** Cluster con la base de datos `sample_mflix` (colección `movies` y opcionalmente `movies_ia` con índice vectorial).
- **Firebase:** Proyecto con Cloud Firestore habilitado y archivo de credenciales de servicio `serviceAccountKey.json` en la raíz.

### 2. Instalación de Dependencias
```bash
pnpm install
```

### 3. Configuración del Entorno
Crea un archivo `.env` en la raíz basándote en `.env.example`:
```bash
cp .env.example .env
```
Configura tus variables en `.env`:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
MONGODB_URI="mongodb+srv://USUARIO:CLAVE@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="sample_mflix"
OLLAMA_HOST="http://127.0.0.1:11434"
OLLAMA_MODEL_CHAT="qwen2.5:3b"
OLLAMA_MODEL_EMBED="nomic-embed-text"
```

---

## 💻 Ejecución del Proyecto

### Iniciar el Servidor Web y el Asistente IA
```bash
pnpm start
# O bien:
pnpm run chat:web
```

El servidor quedará disponible en:
- **Local:** `http://localhost:3000`
- **Red Local (Wi-Fi):** `http://<tu-ip-local>:3000` (permite conectar otros dispositivos en la misma red)

### Probar CineBot en el Chat
1. Ingresa a la interfaz web (`http://localhost:3000`).
2. Selecciona un usuario (por ejemplo, **Ana** o **Carlos**).
3. En la lista de contactos aparecerá **🤖 CineBot IA (Ollama)** con estado en línea.
4. Abre la conversación con CineBot y escribe una pregunta como:
   - *"Recomiéndame películas de acción del 2015 con buena calificación"*
   - *"Películas dirigidas por Christopher Nolan"*
5. El bot responderá en tiempo real con las películas encontradas directamente desde MongoDB Atlas.

### Scripts de Modelos Locales y Embeddings
```bash
# Generar embeddings de películas con nomic-embed-text hacia Atlas:
pnpm run ia:embeddings

# Realizar una búsqueda semántica vectorial por consola:
pnpm run ia:buscar "Películas sobre viajes espaciales y astronautas"
```

### Pruebas Automatizadas de Rúbrica (P1 - P7)
```bash
pnpm run pruebas
```

---

## 🔒 Seguridad y Buenas Prácticas
- Las credenciales privadas (`serviceAccountKey.json`, `.env`) están estrictamente ignoradas en `.gitignore`.
- Validación de consultas mediante AST/objeto JSON antes de tocar la base de datos para prevenir inyecciones.
- Se eliminaron archivos binarios comprimidos (`.7z`) y logs históricos del control de versiones para mantener el repositorio limpio y profesional.
