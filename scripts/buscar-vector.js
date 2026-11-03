import "dotenv/config";
import { MongoClient } from "mongodb";
import ollama from "ollama";

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "sample_mflix";
const MODEL_EMBED = process.env.OLLAMA_MODEL_EMBED || "nomic-embed-text";

async function main() {
  if (!URI) {
    console.error("❌ Error: Debes configurar MONGODB_URI en tu archivo .env");
    process.exit(1);
  }

  const client = new MongoClient(URI);

  try {
    await client.connect();
    console.log("✅ Conectado a MongoDB Atlas");

    const db = client.db(DB_NAME);
    const movies = db.collection("movies_ia");

    const pregunta = process.argv.slice(2).join(" ") || "Historias sobre viajes espaciales y astronautas";

    console.log(`\nGenerando vector para la pregunta: "${pregunta}"...`);
    const respuesta = await ollama.embed({
      model: MODEL_EMBED,
      input: pregunta
    });

    const vectorPregunta = respuesta.embeddings[0];

    console.log("Ejecutando $vectorSearch en MongoDB Atlas...");
    const resultados = await movies.aggregate([
      {
        $vectorSearch: {
          index: "indice_peliculas",
          path: "embedding",
          queryVector: vectorPregunta,
          numCandidates: 100,
          limit: 5
        }
      },
      {
        $project: {
          _id: 0,
          title: 1,
          year: 1,
          plot: 1,
          genres: 1,
          score: {
            $meta: "vectorSearchScore"
          }
        }
      }
    ]).toArray();

    console.log(`\nResultados para: "${pregunta}"`);
    console.log("=======================================================");

    if (resultados.length === 0) {
      console.log("No se encontraron resultados vectoriales.");
      console.log("Verifica haber corrido 'generar-embeddings.js' y haber creado el índice en Atlas.");
    } else {
      for (const pelicula of resultados) {
        console.log("-------------------------------------------------------");
        console.log("Título:     ", pelicula.title);
        console.log("Año:        ", pelicula.year);
        console.log("Géneros:    ", pelicula.genres);
        console.log("Similitud:  ", pelicula.score);
        console.log("Descripción:", pelicula.plot);
      }
    }

  } catch (error) {
    console.error("❌ Error en búsqueda semántica:", error.message);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
