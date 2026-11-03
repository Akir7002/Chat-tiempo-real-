import "dotenv/config";
import { MongoClient } from "mongodb";
import ollama from "ollama";

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "sample_mflix";
const MODEL_EMBED = process.env.OLLAMA_MODEL_EMBED || "nomic-embed-text";

async function generarEmbedding(texto) {
  const respuesta = await ollama.embed({
    model: MODEL_EMBED,
    input: texto
  });
  return respuesta.embeddings[0];
}

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
    const origen = db.collection("movies");
    const destino = db.collection("movies_ia");

    console.log("Obteniendo películas para generar embeddings...");
    const peliculas = await origen
      .find(
        { plot: { $type: "string", $ne: "" } },
        {
          projection: {
            title: 1,
            year: 1,
            genres: 1,
            directors: 1,
            imdb: 1,
            plot: 1
          }
        }
      )
      .limit(100)
      .toArray();

    console.log(`Procesando ${peliculas.length} películas con el modelo '${MODEL_EMBED}'...`);

    let procesadas = 0;
    for (const pelicula of peliculas) {
      const texto = [pelicula.title ?? "", pelicula.plot ?? ""].join(". ");

      const vector = await generarEmbedding(texto);

      await destino.updateOne(
        { _id: pelicula._id },
        {
          $set: {
            title: pelicula.title,
            year: pelicula.year,
            genres: pelicula.genres,
            directors: pelicula.directors,
            imdb: pelicula.imdb,
            plot: pelicula.plot,
            embedding: vector
          }
        },
        { upsert: true }
      );

      procesadas++;
      console.log(`[${procesadas}/${peliculas.length}] Procesada: ${pelicula.title}`);
    }

    console.log("\n✅ Proceso finalizado exitosamente.");
    console.log("Recuerda crear el índice vectorial en Atlas (ver Etapa 9 del PDF):");
    console.log("- Colección: sample_mflix.movies_ia");
    console.log("- Nombre del índice: indice_peliculas");
    console.log("- Campo: embedding | Dimensiones: 768 | Similitud: cosine");

  } catch (error) {
    console.error("❌ Error generando embeddings:", error.message);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
