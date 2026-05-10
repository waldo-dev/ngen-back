/**
 * Carga un tour de ejemplo en Firestore (misma forma que la app Flutter).
 *
 * Rutas: tours/cl/list/{tourId}  y  steps/{tourId}/list/{stepId}
 *
 * PROYECTO REAL (sin emulador):
 *   cd backend/functions
 *   firebase login
 *   firebase use   (default en backend/.firebaserc; debe coincidir con project_id en la app)
 *   No definas FIRESTORE_EMULATOR_HOST
 *   node scripts/seed-tours.js   ó   npm run seed:tours
 * Credenciales (obligatorio para Firestore real; "firebase login" NO alcanza):
 *   Opción A — Google Cloud SDK:
 *     gcloud auth application-default login
 *   Opción B — cuenta de servicio (Firebase Console → Project settings → Service accounts):
 *     setx GOOGLE_APPLICATION_CREDENTIALS "C:\ruta\serviceAccount.json"
 *     (nueva terminal)  node scripts/seed-tours.js
 *     o: node scripts/seed-tours.js --credentials C:\ruta\serviceAccount.json
 *
 * El projectId sale de (orden): GCLOUD_PROJECT | GCP_PROJECT | FIREBASE_PROJECT_ID |
 *   projects.default en backend/.firebaserc | "ngen-495404" (Android: app/android/app/google-services.json).
 *
 * Consola web: scripts/agregar-en-consola-firebase.txt
 * Emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *
 * Datos: scripts/sample-tour.firestore.json
 *   node scripts/seed-tours.js --file ./mi-tour.json
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function projectIdFromFirebaserc() {
  try {
    const firebaserc = path.join(__dirname, "..", "..", ".firebaserc");
    const raw = fs.readFileSync(firebaserc, "utf8");
    const j = JSON.parse(raw);
    const id = j.projects && j.projects.default;
    return typeof id === "string" && id ? id : null;
  } catch (_) {
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let file = path.join(__dirname, "sample-tour.firestore.json");
  let credentialsPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      file = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === "--credentials" && args[i + 1]) {
      credentialsPath = path.resolve(process.cwd(), args[i + 1]);
      i++;
    }
  }
  return { file, credentialsPath };
}

function initAdmin(projectId, credentialsPath) {
  const options = { projectId };
  if (credentialsPath) {
    const raw = fs.readFileSync(credentialsPath, "utf8");
    const json = JSON.parse(raw);
    options.credential = admin.credential.cert(json);
  }
  admin.initializeApp(options);
}

function main() {
  const { file, credentialsPath } = parseArgs();
  const raw = fs.readFileSync(file, "utf8");
  const payload = JSON.parse(raw);
  const tourId = payload.tourId;
  const tour = payload.tour;
  const steps = payload.steps;

  if (!tourId || !tour || !Array.isArray(steps)) {
    throw new Error("JSON inválido: hace falta tourId, tour y steps[]");
  }

  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    projectIdFromFirebaserc() ||
    "ngen-495404";

  if (!admin.apps.length) {
    initAdmin(projectId, credentialsPath);
  }

  const db = admin.firestore();
  const useEmu = !!process.env.FIRESTORE_EMULATOR_HOST;
  console.log(
    JSON.stringify(
      {
        projectId,
        emulator: useEmu ? process.env.FIRESTORE_EMULATOR_HOST : null,
        tourId,
        steps: steps.length,
      },
      null,
      2
    )
  );

  const tourRef = db.collection("tours").doc("cl").collection("list").doc(tourId);
  const batch = db.batch();
  batch.set(tourRef, tour, { merge: true });
  for (const step of steps) {
    const stepId = step.id;
    const { id, ...data } = step;
    if (!stepId) continue;
    const stepRef = db
      .collection("steps")
      .doc(tourId)
      .collection("list")
      .doc(stepId);
    batch.set(stepRef, data, { merge: true });
  }

  return batch.commit().then(() => {
    console.log("OK: tour y pasos escritos.");
  });
}

main().catch((err) => {
  const msg = err && err.message ? String(err.message) : "";
  if (/default credentials|Could not load/i.test(msg)) {
    console.error(`
No hay credenciales para el Admin SDK (Firestore en producción).

Haz UNA de estas:

  1) Instala Google Cloud SDK y ejecuta:
       gcloud auth application-default login

  2) Descarga un JSON de cuenta de servicio (Firebase Console → Configuración del proyecto
     → Cuentas de servicio → Generar nueva clave privada) y luego:
       node scripts/seed-tours.js --credentials "C:\\ruta\\al\\archivo.json"

  "firebase login" solo sirve para la CLI; no reemplaza los pasos de arriba.
`);
  }
  console.error(err);
  process.exit(1);
});
