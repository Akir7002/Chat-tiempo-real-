import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : path.resolve(__dirname, "..", "serviceAccountKey.json");

let firestoreDb = null;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
    firestoreDb = getFirestore();
    console.log("🔥 Firebase Admin SDK inicializado correctamente");
  } catch (e) {
    console.error("⚠️ Error inicializando Firebase Admin SDK:", e.message);
  }
} else {
  console.warn("⚠️ No se encontró archivo de credenciales de Firebase Admin (serviceAccountKey.json)");
}

export { firestoreDb, FieldValue };
