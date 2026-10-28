# Diseño del chat — Taller Streams (Bases de Datos 2)

- **Alternativas implementadas:** A) Chat por consola con Node.js (entrega de esta tarea, ver sección 5) y B) Chat con interfaz web (HTML, CSS, JavaScript). Las dos usan **los mismos módulos compartidos** de `src/` y el mismo modelo de datos; solo cambia la capa de presentación.
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
| `creadaEn` | timestamp | Orden y auditoría (nombre igual al del enunciado del taller). |
| `actualizadaEn` | timestamp | Orden de la lista de conversaciones (el orden se aplica en el cliente para evitar un índice compuesto). |
| `ultimoMensaje` | string | Vista previa opcional en la lista (sugerido por el taller). |

**Prevenir conversaciones duplicadas (requisito 5 / P7):**

```
convId = [uidA, uidB].sort().join("_")   // clave canónica
runTransaction: si no existe doc(conversaciones, convId) ⇒ set({...})
```

- El orden canónico hace que **quién inicie la conversación dé siempre el mismo ID**.
- Si ambos intentan crearla **simultáneamente**, los dos apuntan al **mismo documento**. La creación se hace dentro de una **transacción** (`runTransaction`): lee el documento y solo lo crea si no existe. Si otro cliente lo crea entre la lectura y la escritura, Firestore detecta el conflicto y **reintenta** la transacción, que ahora ve el documento existente y no lo pisa. Así no hay duplicados ni se sobrescribe `creadaEn` / `ultimoMensaje`.

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
        │               transacción: crear solo si no existe (mismo ID)
        ▼
Cancelar listener anterior ──► onSnapshot(mensajes, orderBy creadoEn asc)
        │
        ▼
Escribir y enviar (writeBatch: mensaje + ultimoMensaje) ──► validación texto no vacío
        │                       el receptor lo ve sin recargar (P5)
        ▼
Heartbeat lastSeen cada 20 s ◄──► cierre: estado offline + cancelar listeners
```

---

## 3. Pruebas del taller (P1–P7) y cómo se cumplen

| Prueba | Cumplimiento |
|---|---|
| P1 Dos usuarios, ids únicos | Cada usuario escribe su id (`u001`, `u002`); `setDoc` por id ⇒ sin duplicados. Prueba automatizada: `npm run pruebas`. |
| P2 Usuarios disponibles | `where("estado","==","online")` + umbral de `lastSeen`. |
| P3 Seleccionar destinatario | Clic en la lista ⇒ clave canónica de conversación. |
| P4 Mensaje almacenado | `addDoc` en la subcolección; verificado en Firestore. |
| P5 Otra instancia recibe en vivo | `onSnapshot` (dos pestañas / dos equipos). |
| P6 Mensaje vacío rechazado | Validación en cliente + reglas de Firestore (`size() > 0`). |
| P7 Cambiar de conversación | Se cancela el listener anterior antes de suscribir el nuevo. |

---

## 4. Nota de decisión: por qué identificador escrito y no Auth anónimo

Se evaluó Auth anónimo de Firebase (uid automático) y se descartó por dos motivos verificables:

1. **Dos pestañas del mismo navegador comparten la sesión anónima** (probado: dos `signInAnonymously` consecutivos devuelven el **mismo** uid). Eso rompría la prueba P1 con el escenario más habitual de demostración (dos pestañas) y obligaría a dos equipos distintos para probar.
2. El taller dice textualmente: *"para esta sesión se permite identificar a los usuarios mediante un nombre e identificador de prueba"* y pone el ejemplo `u001 → Ana`. Con ids escritos no se depende de la configuración de Authentication, se cumple P1 con dos pestañas y el identificador sigue diferenciado del nombre visible.

Coste de la decisión: sin Auth no se puede verificar criptográficamente la identidad; las reglas validan la **estructura** de los datos y la base debe permanecer en modo de prueba durante la sesión (limitación documentada, aceptada por el alcance del taller).

---

## 5. Alternativa A: chat por consola (Node.js)

La consola es una **capa de presentación nueva** sobre los módulos que ya usaba la web. No se duplicó lógica de datos: ambas alternativas escriben y leen exactamente las mismas colecciones.

### 5.1 Estructura del proyecto

```
src/
├── web/                  Alternativa B (HTML + CSS + JS)
├── consola/              Alternativa A
│   ├── chat.js           punto de entrada: identificación, menús y flujo
│   ├── entrada.js        interfaz readline (lectura del teclado)
│   ├── presencia.js      latido de lastSeen + cierre limpio (Ctrl+C)
│   └── sala.js           pantalla de chat: escuchar y enviar mensajes
├── firebase.js           exporta db (compartido)
├── usuarios.js           registro, presencia y lista de usuarios (compartido)
├── conversaciones.js     clave canónica, abrir/crear y listar (compartido)
└── mensajes.js           escuchar y enviar mensajes (compartido)
```

### 5.2 Qué reutiliza la consola

| Módulo compartido | Función usada por la consola | Para qué |
|---|---|---|
| `usuarios.js` | `obtenerUsuario`, `registrarUsuario` | Identificar y registrar sin duplicar. |
| `usuarios.js` | `escucharUsuarios` | Lista con estado calculado por `lastSeen`. |
| `usuarios.js` | `iniciarCorazon` | Latido cada 20 s y `offline` al salir. |
| `conversaciones.js` | `obtenerOCrearConversacion`, `listarConversaciones` | Abrir sin duplicados y listar mis conversaciones. |
| `mensajes.js` | `escucharMensajes`, `enviarMensaje` | Tiempo real y envío atómico. |

Los módulos compartidos **no tocan el DOM** (`document`, `window`), por eso funcionan igual en Node y en el navegador.

### 5.3 Flujo de la consola

```
Identificador (3-20 caracteres) ──► ¿existe usuarios/{uid}?
        │                            ├─ sí: saluda y usa su nombre guardado
        │                            └─ no: pide nombre visible y lo registra
        ▼
Inicia presencia (latido de lastSeen cada 20 s; Ctrl+C ⇒ estado "offline")
        │
        ▼
MENÚ ─┬─ 1. Mis conversaciones ──► where(participantes, array-contains, uid)
      │                            ordenadas por actualizadaEn (en el cliente)
      ├─ 2. Nueva conversación ──► lista de usuarios (online/offline) ──► elegir
      │                            └► transacción: crear o recuperar uXXX_uYYY
      └─ 0. Salir
        │
        ▼
Chat: onSnapshot(mensajes, orderBy creadoEn) ──► imprime solo mensajes nuevos
      escribir + Enter ──► writeBatch (mensaje + ultimoMensaje)
      /salir ──► cancela el listener y vuelve al menú
```

### 5.4 Uso de `readline`

- Se crea **una sola interfaz** (`readline/promises`) en `entrada.js` y se reutiliza en todo el programa. Dos interfaces sobre el mismo teclado se disputarían la entrada.
- `preguntar()` envuelve `rl.question()` para usar `await` en los menús.
- En el chat se usa `rl.prompt(true)` y `clearLine`/`cursorTo` para que un mensaje entrante **no rompa lo que el usuario está escribiendo**.
- Los mensajes propios se imprimen desde el listener (no desde lo tecleado), de modo que lo que se ve en pantalla es lo que realmente llegó a Firestore.
- `Ctrl+C` llega como evento `SIGINT` de la interfaz y dispara el cierre limpio.

### 5.5 Decisiones de diseño (para la sustentación)

1. **ID determinista y ordenado** (`[uidA, uidB].sort().join("_")`). Cualquiera de los dos usuarios que abra la conversación obtiene el mismo documento. Además, la consulta de unicidad es una lectura por ID (O(1)), no un recorrido de colecciones.
2. **Transacción para evitar duplicados bajo concurrencia.** Con `getDoc` + `setDoc` por separado dos clientes pueden ver "no existe" a la vez y el segundo pisa el documento del primero. Con `runTransaction` Firestore reintenta ante el conflicto y el segundo cliente reutiliza el documento existente.
3. **`writeBatch` para mensaje + `ultimoMensaje`.** Ambas escrituras se confirman juntas o ninguna. Sin lote, un fallo en la segunda dejaba el mensaje guardado y la vista previa de la lista desactualizada.
4. **Filtro `fromCache` en `escucharUsuarios`.** `onSnapshot` entrega primero datos de la caché local y después los del servidor. Justo después de registrarse, el primer snapshot contenía solo al propio usuario. La consola ignora los snapshots con `metadata.fromCache === true` al cargar la lista y espera el del servidor.
5. **Solo se imprimen mensajes nuevos.** Un `Set` con los IDs ya mostrados evita repetir el historial completo en cada actualización del listener.
6. **Un único listener activo.** Al salir de la conversación (`/salir`) se llama a la función de cancelación de `onSnapshot`; así nunca se escuchan dos conversaciones a la vez (P7).
7. **Disponibilidad calculada, no confiada.** Un usuario se muestra *online* solo si `estado == "online"` **y** `ahora − lastSeen < 60 s`.
8. **Nombres desde `usuarios`, no copiados.** La lista de conversaciones obtiene el nombre del otro participante consultando `usuarios`, por lo que no depende de un campo duplicado que pueda quedar desactualizado.

### 5.6 Consulta de "Mis conversaciones"

```js
query(
  collection(db, "conversaciones"),
  where("participantes", "array-contains", uid)
)
// orden por actualizadaEn en el cliente ⇒ no requiere índice compuesto
```

Cada elemento muestra el otro participante, su estado y `ultimoMensaje` como vista previa. Las conversaciones sin campo `participantes` (por ejemplo, una sala grupal) no aparecen en esta consulta.

### 5.7 Pruebas de la consola (manuales, con dos terminales)

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| P1 | Entrar dos veces con un ID nuevo | Un solo documento en `usuarios`; `creadoEn` no cambia. |
| P2 | Abrir el menú | La lista no incluye al usuario actual. |
| P3 | Elegir un destinatario | Se abre `uXXX_uYYY`; la segunda vez dice "existente recuperada". |
| P4 | Enviar un mensaje | Queda una vez en `mensajes` y se actualiza `ultimoMensaje`. |
| P5 | Enviar desde la otra terminal | Llega sin actualizar nada. |
| P6 | Enter sin texto | "El mensaje no puede estar vacío"; no se crea documento. |
| P7 | `/salir` y entrar a otra conversación | No se mezclan mensajes. |

Las mismas comprobaciones, sobre la capa de datos, están automatizadas en `pruebas.mjs` (`npm run pruebas`).

---

## 6. Limitaciones reconocidas

1. **Presencia por `lastSeen` no es infalible.** Con `Ctrl+C` el estado pasa a `offline`, pero si se cierra la ventana con la X, se apaga el equipo o se cae la red, el documento queda `online` hasta que vence el umbral de 60 s. Por eso la lista calcula la disponibilidad con `lastSeen` y no solo con `estado`. Una solución completa requeriría Realtime Database con `onDisconnect()`.
2. **Sin autenticación.** El taller permite identificadores de prueba, pero dos personas pueden escribir el mismo ID y la segunda suplanta a la primera. El ID está separado del nombre visible, y migrar a Firebase Authentication solo cambiaría de dónde sale el `uid`.
3. **Las reglas validan estructura, no identidad.** `firestore.rules` comprueba tipos, longitudes y que no cambien los participantes, pero sin Auth no puede verificar que quien escribe sea realmente `emisorId`. Además, en modo de prueba de Firebase las reglas **vencen a los 30 días**.
4. **`nombresParticipantes` queda desactualizado si alguien cambia de nombre.** Algunos documentos creados manualmente lo traen. El código actual no lo escribe y obtiene los nombres desde `usuarios`, que es la fuente única.
5. **Posible colisión de IDs con guion bajo.** La clave de conversación une los IDs con `_` y el formato de ID acepta `_`; en teoría `a_b` + `c` y `a` + `b_c` darían la misma clave (`a_b_c`). Se evita prohibiendo `_` en los IDs (los de prueba, como `u001`, no lo usan).
6. **Consola:** si el usuario escribe mientras llega un mensaje, el texto puede redibujarse; es un límite de `readline` en terminales sencillas.