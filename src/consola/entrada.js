import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// crea la interfaz de lectura de línea
export const rl = readline.createInterface({ input: stdin, output: stdout });

export const preguntar = (texto) => rl.question(texto);
export const cerrarEntrada = () => rl.close();
export const alInterrumpir = (funcion) => rl.on("SIGINT", funcion);
