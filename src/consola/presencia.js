import {iniciarCorazon } from "../usuarios.js";
import { alInterrumpir, cerrarEntrada } from "./entrada.js";

export function iniciarPresencia(uid){
    const corazon = iniciarCorazon({uid});
    let saliendo = false;

    async function salir(){
        if (saliendo) return;
        saliendo = true;
        console.log("\nCerrando sesión...")
        await corazon.desconectar();
        cerrarEntrada();
        process.exit(0);
    }
    alInterrumpir(salir);
    process.on("SIGTERM", salir);
    return { salir };
}