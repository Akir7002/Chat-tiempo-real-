# Diseño del chat — Taller Streams (Bases de Datos 2)

- **Alternativa elegida:** B) Chat con interfaz web (HTML, CSS, JavaScript).
- **Proyecto Firebase:** `chat-18fba` (propio del equipo).
- **Identidad:** identificador de prueba escrito por el usuario (ej. `u001`) + nombre visible (ej. `Ana`). El taller permite identificadores previamente creados ("u001 → Ana") y **no exige autenticación**. El identificador vive en el id del documento y es independiente del nombre visible (requisito del alcance). Justificación de por qué no se usó Auth: ver la nota final.

---

## 1. Modelo de datos

### 1.1 `usuarios/{uid}`

El **id del documento es el identificador único** del usuario, escrito por él al entrar (`u001`, `u002`…; validado: 3–20 caracteres, letras/números/`_`/`-`).

| Campo    | Tipo | Obligatorio | Justificación (consulta u operación que habilita) |
|---       |---    |---          |---                                               |
| `nombre` | string | Sí | Nombre visible en la lista; requisito: diferenciado del identificador. |
| `estado` | string (`"online"`/`"offline"`) | Sí | `query(usuarios, where("estado","==","online"))` → lista de disponibles (P2). |
| `lastSeen` | timestamp | Sí | Umbral de presencia: se considera *online* si `ahora − lastSeen < 60 s`. Se actualiza con heartbeat cada 20 s. |
| `creadoEn` | timestamp | No | Auditoría del registro. |

**Registro sin duplicados (P1):** `setDoc(doc(usuarios, uid), datos)` — ID conocido ⇒ ejecutar N veces nunca duplica usuarios.
**Limitación aceptada:** si dos personas escriben el mismo id, la segunda sobrescribe la primera; es la contraparte de los identificadores de prueba que el taller acepta (no exige autenticación).

### 1.2 `conversaciones/{convId}`

| Campo | Tipo | Justificación |
|---|---|---|
| `participantes` | array `[uidA, uidB]` | `where("participantes", "array-contains", uidActual)` → todas mis conversaciones (índice automático de arrays). |
| `tipo` | string | `"privada"`; prepara el modelo para otras categorías. |
| `creadoEn` | timestamp | Orden y auditoría. |
| `actualizadaEn` | timestamp | Orden de la lista de conversaciones (el orden se aplica en el cliente para evitar un índice compuesto). |
| `ultimoMensaje` | string | Vista previa opcional en la lista (sugerido por el taller). |

**Prevenir conversaciones duplicadas (requisito 5 / P7):**

```
convId = [uidA, uidB].sort().join("_")   // clave canónica
setDoc(doc(conversaciones, convId), {...})
```

- El orden canónico hace que **quién inicie la conversación dé siempre el mismo ID**.
- Si ambos intentan crearla **simultáneamente**, escriben **el mismo documento** (`setDoc` es idempotente con datos equivalentes): Firestore resuelve la carrera con la última escritura y **no puede existir un duplicado**.

### 1.3 `conversaciones/{convId}/mensajes/{msgId}` (subcolección)

| Campo | Tipo | Justificación |
|---     |---  |---            |
| `emisorId` | string (uid) | Diferenciar mensajes propios de los recibidos (Paso 7 y P5). |
| `texto` | string | Contenido; se valida no vacío (P6) y máximo 500 caracteres. |
| `creadoEn` | `serverTimestamp()` | `orderBy("creadoEn","asc")` → orden cronológico garantizado con la hora del servidor (no la del cliente). |

Los mensajes viven **dentro de cada conversación**: al cambiar de conversación se cancela el `onSnapshot` anterior y se crea uno nuevo ⇒ **P7: nunca se mezclan conversaciones**.

### 1.4 Índices necesarios

| Consulta | Índice |
|---|---|
| `usuarios`: `where("estado","==",...)` | Automático (campo simple). |
| `mensajes`: `orderBy("creadoEn","asc")` | Automático (campo simple). |
| `conversaciones`: `array-contains "participantes"` | Automático (array). |
| Orden de la lista de conversaciones por `actualizadaEn` | Se ordena en el cliente ⇒ **no requiere índice compuesto**. |

### 1.5 Presencia (estrategia y limitaciones)

1. Al entrar: `setDoc(usuarios/{uid}, {estado:"online", lastSeen:ahora})`.
2. Heartbeat cada 20 s: `updateDoc` de `lastSeen`.
3. Al salir (`beforeunload`): `estado:"offline"`.
4. La vista calcula *disponible* = `ahora − lastSeen < 60 s` (más robusto que confiar solo en `estado`).

**Limitación documentada:** si el cliente muere sin `beforeunload` (apagado, red caída), permanecerá *online* hasta vencer el umbral de 60 s. No existe detección infalible de conexión sin Realtime Database.

---

## 2. Maqueta de la interfaz (wireframe)

### Pantalla 1 — Identificación

```
┌─────────────────────────────────────────────┐
│            💬  CHAT DEL COLEGIO             │
│                                             │
│    Nombre visible:  [ Ana             ]     │
│                                             │
│            [  Entrar al chat  ]             │
│                                             │
│  (el identificador uid lo genera Firebase   │
│   de forma automática y única)              │
└─────────────────────────────────────────────┘
```

### Pantalla 2 — Chat (escritorio)

```
┌────────────────────────────────────────────────────────────────┐
│  💬 CHAT DEL COLEGIO      Ana · id: F3dq…qTLy    ● En línea   │ ①
├───────────────────┬────────────────────────────────────────────┤
│  USUARIOS (3)     │  Conversación con: Carlos                 │ ②
│                   │  ──────────────────────────────────────── │
│  ● Carlos  online │                                            │
│  ● Maria   online │  10:31  Carlos: Hola, ¿cómo estás?        │
│  ○ Diego   offline│  10:32  Ana: Hola! Todo bien              │ ③
│                   │  10:33  Carlos: Perfecto                  │
│  ▲ clic en un     │           (mensajes propios con fondo     │
│    usuario para   │            morado y alineados a la        │
│    abrir su       │            lado derecho)                  │
│    conversación   │                                            │
│                   ├────────────────────────────────────────────┤
│                   │ [ Escribe un mensaje…          ] [ Enviar ]│ ④
└───────────────────┴────────────────────────────────────────────┘
```

**Leyenda (mínimo exigido en el Paso 3 del taller):**

| Zona | Elemento obligatorio del taller |
|---|---|
| ① | Indicador de disponibilidad (En línea / Sin conexión) + identificación del usuario |
| ② | Lista de usuarios disponibles, con estado y selección de destinatario |
| ③ | Área de mensajes (tiempo real, orden cronológico, propios ≠ recibidos) |
| ④ | Campo de texto + botón Enviar |

### Flujo de la aplicación

```
Identificarse (nombre + uid)
        │
        ▼
onSnapshot(usuarios) ──► lista en tiempo real con estados
        │
        ▼
Clic en un usuario ──► convId = sort(u1,u2).join("_")
        │               setDoc si no existe (siempre el mismo ID)
        ▼
Cancelar listener anterior ──► onSnapshot(mensajes, orderBy creadoEn asc)
        │
        ▼
Escribir y enviar (addDoc) ──► validación texto no vacío
        │                       el receptor lo ve sin recargar (P5)
        ▼
Heartbeat lastSeen cada 20 s ◄──► cierre: estado offline + cancelar listeners
```

---

## 3. Pruebas del taller (P1–P7) y cómo se cumplen

| Prueba | Cumplimiento |
|---|---|
| P1 Dos usuarios, ids únicos | Cada usuario escribe su id (`u001`, `u002`); `setDoc` por id ⇒ sin duplicados. Prueba automatizada: `pnpm pruebas`. |
| P2 Usuarios disponibles | `where("estado","==","online")` + umbral de `lastSeen`. |
| P3 Seleccionar destinatario | Clic en la lista ⇒ clave canónica de conversación. |
| P4 Mensaje almacenado | `addDoc` en la subcolección; verificado en Firestore. |
| P5 Otra instancia recibe en vivo | `onSnapshot` (dos pestañas / dos equipos). |
| P6 Mensaje vacío rechazado | Validación en cliente + reglas de Firestore (`size() > 0`). |
| P7 Cambiar de conversación | Se cancela el listener anterior antes de suscribir el nuevo. |
