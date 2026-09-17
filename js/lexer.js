// ==========================================
// CodEsp — Lexer
// ==========================================

const KEYWORDS = new Set([
    "usar",
    "importar",
    "definir",
    "asignar",
    "mostrar",
    "si",
    "no",
    "mientras",
    "para",
    "en",
    "funcion",
    "devolver",
    "intentar",
    "capturar",
    "plugin",
    "sesion",
    "crear",
    "solicitar",
    "simultaneamente",
    "encabezados",
    "parametros",
    "enviar",
    "verdadero",
    "falso",
    "nulo"
]);

const HTTP_METHODS = new Set([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS"
]);


// ==========================================
// TOKENIZAR
// ==========================================

export function tokenizar(source) {

    if (source === undefined || source === null) {
        source = "";
    }

    source = String(source);

    const tokens = [];

    let i = 0;
    let linea = 1;
    let columna = 1;

    function agregar(type, value, line, col) {

        tokens.push({
            type,
            value,
            line,
            column: col
        });
    }

    function avanzar() {

        const char = source[i];

        if (char === "\n") {
            linea++;
            columna = 1;
        } else {
            columna++;
        }

        i++;
    }

    while (i < source.length) {

        const char = source[i];

        // ------------------------------------------
        // ESPACIOS
        // ------------------------------------------

        if (
            char === " " ||
            char === "\t" ||
            char === "\r"
        ) {
            avanzar();
            continue;
        }


        // ------------------------------------------
        // NUEVA LÍNEA
        // ------------------------------------------

        if (char === "\n") {

            agregar(
                "NEWLINE",
                "\n",
                linea,
                columna
            );

            avanzar();
            continue;
        }


        // ------------------------------------------
        // COMENTARIO
        // ------------------------------------------

        if (char === "#") {

            const inicioLinea = linea;
            const inicioColumna = columna;

            let comentario = "";

            while (
                i < source.length &&
                source[i] !== "\n"
            ) {
                comentario += source[i];
                avanzar();
            }

            agregar(
                "COMMENT",
                comentario,
                inicioLinea,
                inicioColumna
            );

            continue;
        }


        // ------------------------------------------
        // CADENA
        // ------------------------------------------

        if (
            char === '"' ||
            char === "'"
        ) {

            const comilla = char;
            const inicioLinea = linea;
            const inicioColumna = columna;

            let valor = "";

            avanzar();

            let cerrada = false;

            while (i < source.length) {

                const actual = source[i];

                // Escape

                if (actual === "\\") {

                    const siguiente = source[i + 1];

                    if (siguiente === undefined) {
                        valor += "\\";
                        avanzar();
                        break;
                    }

                    switch (siguiente) {

                        case "n":
                            valor += "\n";
                            break;

                        case "r":
                            valor += "\r";
                            break;

                        case "t":
                            valor += "\t";
                            break;

                        case "\\":
                            valor += "\\";
                            break;

                        case '"':
                            valor += '"';
                            break;

                        case "'":
                            valor += "'";
                            break;

                        default:
                            valor += siguiente;
                    }

                    avanzar();
                    avanzar();

                    continue;
                }

                // Cierre

                if (actual === comilla) {

                    avanzar();
                    cerrada = true;
                    break;
                }

                valor += actual;
                avanzar();
            }

            if (!cerrada) {
                throw new Error(
                    `Cadena sin cerrar en línea ${inicioLinea}, columna ${inicioColumna}.`
                );
            }

            agregar(
                "STRING",
                valor,
                inicioLinea,
                inicioColumna
            );

            continue;
        }


        // ------------------------------------------
        // NÚMEROS
        // ------------------------------------------

        if (/[0-9]/.test(char)) {

            const inicioLinea = linea;
            const inicioColumna = columna;

            let numero = "";

            while (
                i < source.length &&
                /[0-9.]/.test(source[i])
            ) {

                numero += source[i];
                avanzar();
            }

            if (
                numero === "." ||
                (numero.match(/\./g) || []).length > 1
            ) {
                throw new Error(
                    `Número inválido en línea ${inicioLinea}, columna ${inicioColumna}.`
                );
            }

            agregar(
                "NUMBER",
                Number(numero),
                inicioLinea,
                inicioColumna
            );

            continue;
        }


        // ------------------------------------------
        // IDENTIFICADORES / PALABRAS
        // ------------------------------------------

        if (
            /[A-Za-zÁÉÍÓÚáéíóúÑñ_]/.test(char)
        ) {

            const inicioLinea = linea;
            const inicioColumna = columna;

            let palabra = "";

            while (
                i < source.length &&
                /[A-Za-zÁÉÍÓÚáéíóúÑñ0-9_]/.test(source[i])
            ) {

                palabra += source[i];
                avanzar();
            }

            const mayuscula = palabra.toUpperCase();

            if (HTTP_METHODS.has(mayuscula)) {

                agregar(
                    "HTTP_METHOD",
                    mayuscula,
                    inicioLinea,
                    inicioColumna
                );

            } else if (KEYWORDS.has(palabra.toLowerCase())) {

                agregar(
                    "KEYWORD",
                    palabra,
                    inicioLinea,
                    inicioColumna
                );

            } else {

                agregar(
                    "IDENTIFIER",
                    palabra,
                    inicioLinea,
                    inicioColumna
                );
            }

            continue;
        }


        // ------------------------------------------
        // OPERADORES DE DOS CARACTERES
        // ------------------------------------------

        const dos = source.slice(i, i + 2);

        if (
            dos === "==" ||
            dos === "!=" ||
            dos === "<=" ||
            dos === ">=" ||
            dos === "&&" ||
            dos === "||" ||
            dos === "+=" ||
            dos === "-=" ||
            dos === "*=" ||
            dos === "/="
        ) {

            agregar(
                "OPERATOR",
                dos,
                linea,
                columna
            );

            avanzar();
            avanzar();

            continue;
        }


        // ------------------------------------------
        // OPERADORES DE UN CARÁCTER
        // ------------------------------------------

        if (
            [
                "=",
                "+",
                "-",
                "*",
                "/",
                "%",
                "<",
                ">",
                "!"
            ].includes(char)
        ) {

            agregar(
                "OPERATOR",
                char,
                linea,
                columna
            );

            avanzar();
            continue;
        }


        // ------------------------------------------
        // PUNTUACIÓN
        // ------------------------------------------

        if (
            [
                "(",
                ")",
                "[",
                "]",
                "{",
                "}",
                ":",
                ",",
                "."
            ].includes(char)
        ) {

            agregar(
                "PUNCTUATION",
                char,
                linea,
                columna
            );

            avanzar();
            continue;
        }


        // ------------------------------------------
        // CARÁCTER DESCONOCIDO
        // ------------------------------------------

        throw new Error(
            `Carácter no reconocido "${char}" en línea ${linea}, columna ${columna}.`
        );
    }

    // ------------------------------------------
    // FIN DEL ARCHIVO
    // ------------------------------------------

    tokens.push({
        type: "EOF",
        value: null,
        line: linea,
        column: columna
    });

    return tokens;
}


// ==========================================
// ALIAS COMPATIBLE
// ==========================================

export const analizar = tokenizar;
