import "dotenv/config";
import { MongoClient } from "mongodb";
import ollama from "ollama";

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "sample_mflix";
const MODEL_CHAT = process.env.OLLAMA_MODEL_CHAT || "qwen2.5:3b";
const MODEL_EMBED = process.env.OLLAMA_MODEL_EMBED || "nomic-embed-text";

let mongoClient = null;

async function getDb() {
  if (!URI) {
    throw new Error("MONGODB_URI no configurado en el archivo .env");
  }
  if (!mongoClient) {
    mongoClient = new MongoClient(URI);
    await mongoClient.connect();
  }
  return mongoClient.db(DB_NAME);
}

// ==========================================
// VALIDADOR DE SEGURIDAD (Del taller de BD2)
// ==========================================
const CAMPOS = new Set([
  "title",
  "year",
  "genres",
  "directors",
  "cast",
  "runtime",
  "imdb.rating",
  "imdb.votes"
]);

const OPERADORES = new Set([
  "$and",
  "$or",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$eq",
  "$ne",
  "$in"
]);

function validarFiltro(filtro, profundidad = 0) {
  if (
    profundidad > 5 ||
    filtro === null ||
    typeof filtro !== "object" ||
    Array.isArray(filtro)
  ) {
    throw new Error("Filtro no válido");
  }

  for (const [clave, valor] of Object.entries(filtro)) {
    if (clave.startsWith("$")) {
      if (!OPERADORES.has(clave)) {
        throw new Error(`Operador no permitido: ${clave}`);
      }
      if (clave === "$and" || clave === "$or") {
        if (!Array.isArray(valor) || valor.length > 10) {
          throw new Error("Estructura lógica no válida");
        }
        for (const condicion of valor) {
          validarFiltro(condicion, profundidad + 1);
        }
      } else if (valor !== null && typeof valor === "object") {
        if (clave === "$in") {
          if (!Array.isArray(valor) || valor.length > 50) {
            throw new Error("Lista $in no válida");
          }
        } else {
          throw new Error("Valor de operador no válido");
        }
      }
    } else {
      if (!CAMPOS.has(clave)) {
        throw new Error(`Campo no permitido: ${clave}`);
      }
      if (valor !== null && typeof valor === "object" && !Array.isArray(valor)) {
        validarFiltro(valor, profundidad + 1);
      }
    }
  }
}

function validarConsulta(consulta) {
  if (
    consulta === null ||
    typeof consulta !== "object" ||
    Array.isArray(consulta)
  ) {
    throw new Error("Respuesta no válida");
  }

  const claves = Object.keys(consulta);
  const permitidas = ["filter", "sort", "limit"];

  if (claves.some(k => !permitidas.includes(k))) {
    throw new Error("Propiedades no permitidas en la consulta");
  }

  if (
    !consulta.filter ||
    typeof consulta.filter !== "object" ||
    Array.isArray(consulta.filter)
  ) {
    throw new Error("Falta el filtro de consulta");
  }

  validarFiltro(consulta.filter);

  const sort = consulta.sort ?? {};
  if (typeof sort !== "object" || Array.isArray(sort)) {
    throw new Error("Ordenamiento no válido");
  }

  for (const [campo, direccion] of Object.entries(sort)) {
    if (!CAMPOS.has(campo) || ![-1, 1].includes(direccion)) {
      throw new Error(`Ordenamiento no permitido en ${campo}`);
    }
  }

  const limit = consulta.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) {
    throw new Error("Límite debe estar entre 1 y 15");
  }

  return { filter: consulta.filter, sort, limit };
}

// ==========================================
// BÚSQUEDA SEMÁNTICA VECTORIAL (Ollama nomic-embed-text)
// ==========================================
export async function buscarPeliculasVectorial(pregunta, limite = 5) {
  try {
    const db = await getDb();
    const coleccionIa = db.collection("movies_ia");

    const respuestaEmbed = await ollama.embed({
      model: MODEL_EMBED,
      input: pregunta
    });
    const queryVector = respuestaEmbed.embeddings[0];

    const resultados = await coleccionIa.aggregate([
      {
        $vectorSearch: {
          index: "indice_peliculas",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 50,
          limit: limite
        }
      },
      {
        $project: {
          _id: 0,
          title: 1,
          year: 1,
          genres: 1,
          plot: 1,
          "imdb.rating": 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]).toArray();

    return resultados;
  } catch (err) {
    // Si el índice o la colección vectorial no existen aún en Atlas, continuar sin fallar
    return [];
  }
}

// ==========================================
// INTERPRETAR Y CONSULTAR MONGODB
// ==========================================
export async function procesarPreguntaChat(pregunta) {
  try {
    // 1. Ollama interpreta la pregunta para generar el filtro MongoDB
    const respuestaOllama = await ollama.chat({
      model: MODEL_CHAT,
      format: "json",
      messages: [
        {
          role: "system",
          content: `Eres un generador de filtros para MongoDB.
La coleccion es sample_mflix.movies.
Campos permitidos: title, year, genres, directors, cast, runtime, imdb.rating, imdb.votes.
Responde exclusivamente con un objeto JSON:
{
  "filter": {},
  "sort": {},
  "limit": 5
}
Reglas:
1. No inventes campos.
2. No uses operadores no permitidos. Solo: $and, $or, $gt, $gte, $lt, $lte, $eq, $ne, $in.
3. El límite debe estar entre 1 y 10.
4. Si la pregunta no se relaciona con filtros de películas, responde filter vacio {}.`
        },
        { role: "user", content: pregunta }
      ]
    });

    const propuesta = JSON.parse(respuestaOllama.message.content);
    const consultaSegura = validarConsulta(propuesta);

    // 2. Ejecutar consulta en MongoDB Atlas
    const db = await getDb();
    const peliculas = await db.collection("movies")
      .find(consultaSegura.filter)
      .sort(consultaSegura.sort)
      .limit(consultaSegura.limit)
      .project({
        title: 1,
        year: 1,
        genres: 1,
        directors: 1,
        "imdb.rating": 1,
        plot: 1,
        _id: 0
      })
      .toArray();

    // 3. Si no hay resultados con filtro estructurado, intentar búsqueda vectorial semántica
    if (peliculas.length === 0) {
      const vectoriales = await buscarPeliculasVectorial(pregunta, 5);
      if (vectoriales.length > 0) {
        let txt = `🎬 Búsqueda semántica con modelo vectorial (${MODEL_EMBED}):\n\n`;
        vectoriales.forEach((p, idx) => {
          const rating = p.imdb?.rating ? `⭐ ${p.imdb.rating}` : "";
          const generos = p.genres ? `[${p.genres.join(", ")}]` : "";
          const similitud = p.score ? `(Similitud: ${(p.score * 100).toFixed(1)}%)` : "";
          txt += `${idx + 1}. **${p.title}** (${p.year || "N/A"}) ${rating} ${generos} ${similitud}\n`;
          if (p.plot) {
            txt += `   _${p.plot}_\n`;
          }
          txt += "\n";
        });
        return txt.trim();
      }

      return `🎬 No encontré películas que coincidan con tu consulta. (Filtro aplicado: ${JSON.stringify(consultaSegura.filter)})`;
    }

    let textoRespuesta = `🎬 Encontré ${peliculas.length} película(s) en MongoDB Atlas:\n\n`;
    peliculas.forEach((p, idx) => {
      const rating = p.imdb?.rating ? `⭐ ${p.imdb.rating}` : "";
      const generos = p.genres ? `[${p.genres.join(", ")}]` : "";
      textoRespuesta += `${idx + 1}. **${p.title}** (${p.year || "N/A"}) ${rating} ${generos}\n`;
      if (p.plot) {
        textoRespuesta += `   _${p.plot}_\n`;
      }
      textoRespuesta += "\n";
    });

    return textoRespuesta.trim();

  } catch (error) {
    console.error("Error en procesarPreguntaChat:", error);
    return `⚠️ Error al procesar tu consulta con la IA: ${error.message}`;
  }
}
