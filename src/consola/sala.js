import readline from "node:readline";
import { stdout } from "node:process";
import { rl } from "./entrada.js";
import { escucharMensajes, enviarMensaje } from "../mensajes.js";

function formatearHora(creadoEn) {
    const fecha = creadoEn?.toDate ? creadoEn.toDate() : new Date();
    return fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function entrarChat({ yo, destinatario, conversacionId }) {
    return new Promise((resolve) => {
        const mostrados = new Set();

        const imprimir = (linea) => {
            readline.clearLine(stdout, 0);
            readline.cursorTo(stdout, 0);
            console.log(linea);
            rl.prompt(true);
        };

        const cancelar = escucharMensajes(
            conversacionId,
            (mensajes) => {
                for (const m of mensajes) {
                    if (mostrados.has(m.id)) continue;
                    mostrados.add(m.id);
                    const autor = m.emisorId === yo.uid ? "Tú" : destinatario.nombre;
                    imprimir(`[${formatearHora(m.creadoEn)}] ${autor}: ${m.texto}`);
                }
            },
            (error) => imprimir(`  Error al escuchar: ${error.code ?? error.message}`)
        );

        const alLinea = async (texto) => {
            readline.moveCursor(stdout, 0, -1);
            readline.clearLine(stdout, 0);

            if (texto.trim() === "/salir") {
                cancelar();
                rl.off("line", alLinea);
                resolve();
                return;
            }

            rl.prompt();
            try {
                const respuesta = await enviarMensaje({ conversacionId, emisorId: yo.uid, texto });
                if (!respuesta.ok) imprimir(`  (${respuesta.motivo})`);
            } catch (error) {
                imprimir(`  Error al enviar: ${error.code ?? error.message}`);
            }
        };

        rl.setPrompt("> ");
        rl.on("line", alLinea);
        rl.prompt();
    });
}