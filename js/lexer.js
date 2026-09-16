export function lex(source) {
    const tokens = [];

    let i = 0;
    let line = 1;
    let column = 1;

    const keywords = new Set([
        "usar",
        "importar",
        "definir",
        "asignar",
        "mostrar",
        "si",
        "si",
        "no",
        "para",
        "en",
        "mientras",
        "funcion",
        "devolver",
        "intentar",
        "capturar",
        "plugin",
        "crear",
        "sesion",
        "solicitar",
        "simultaneamente",
        "verdadero",
        "falso",
        "nulo",
        "esperar",
        "encabezados",
        "parametros",
        "enviar"
    ]);

    function add(type, value, startLine = line, startColumn = column) {
        tokens.push({
            type,
            value,
            line: startLine,
            column: startColumn
        });
    }

    function isLetter(char) {
        return /[A-Za-zÁÉÍÓÚáéíóúÑñ_]/.test(char);
    }

    function isDigit(char) {
        return /[0-9]/.test(char);
    }

    while (i < source.length) {
        const char = source[i];

        /*
         * ESPACIOS
         */

        if (char === " " || char === "\t" || char === "\r") {
            i++;
            column++;
            continue;
        }

        /*
         * SALTO DE LÍNEA
         */

        if (char === "\n") {
            add("newline", "\n");

            i++;
            line++;
            column = 1;

            continue;
        }

        /*
         * COMENTARIOS
         */

        if (char === "#") {
            const startLine = line;
            const startColumn = column;

            let start = i;

            while (
                i < source.length &&
                source[i] !== "\n"
            ) {
                i++;
                column++;
            }

            add(
                "comment",
                source.slice(start, i),
                startLine,
                startColumn
            );

            continue;
        }

        /*
         * CADENAS
         */

        if (char === '"' || char === "'") {
            const quote = char;

            const startLine = line;
            const startColumn = column;

            let start = i;

            i++;
            column++;

            while (i < source.length) {
                if (source[i] === "\\") {
                    i += 2;
                    column += 2;
                    continue;
                }

                if (source[i] === quote) {
                    i++;
                    column++;
                    break;
                }

                if (source[i] === "\n") {
                    throw new Error(
                        `Cadena sin cerrar en ${startLine}:${startColumn}`
                    );
                }

                i++;
                column++;
            }

            if (source[i - 1] !== quote) {
                throw new Error(
                    `Cadena sin cerrar en ${startLine}:${startColumn}`
                );
            }

            add(
                "string",
                source.slice(start, i),
                startLine,
                startColumn
            );

            continue;
        }

        /*
         * NÚMEROS
         */

        if (isDigit(char)) {
            const startLine = line;
            const startColumn = column;

            let start = i;
            let dots = 0;

            while (i < source.length) {
                const c = source[i];

                if (c === ".") {
                    dots++;

                    if (dots > 1) {
                        break;
                    }

                    i++;
                    column++;
                    continue;
                }

                if (!isDigit(c)) {
                    break;
                }

                i++;
                column++;
            }

            add(
                "number",
                source.slice(start, i),
                startLine,
                startColumn
            );

            continue;
        }

        /*
         * IDENTIFICADORES / PALABRAS CLAVE
         */

        if (isLetter(char)) {
            const startLine = line;
            const startColumn = column;

            let start = i;

            while (
                i < source.length &&
                /[A-Za-zÁÉÍÓÚáéíóúÑñ_0-9]/.test(source[i])
            ) {
                i++;
                column++;
            }

            const value = source.slice(start, i);

            let type = "identifier";

            if (keywords.has(value)) {
                type = "keyword";
            }

            if (
                [
                    "GET",
                    "POST",
                    "PUT",
                    "PATCH",
                    "DELETE",
                    "HEAD",
                    "OPTIONS"
                ].includes(value)
            ) {
                type = "method";
            }

            add(
                type,
                value,
                startLine,
                startColumn
            );

            continue;
        }

        /*
         * OPERADORES DE DOS CARACTERES
         */

        const two = source.slice(i, i + 2);

        if (
            [
                "==",
                "!=",
                "<=",
                ">=",
                "&&",
                "||",
                "+=",
                "-=",
                "*=",
                "/="
            ].includes(two)
        ) {
            add("operator", two);

            i += 2;
            column += 2;

            continue;
        }

        /*
         * OPERADORES / SÍMBOLOS
         */

        if (
            "=+-*/><:(),.[]{}%"
                .includes(char)
        ) {
            add("operator", char);

            i++;
            column++;

            continue;
        }

        /*
         * CARÁCTER DESCONOCIDO
         */

        add(
            "unknown",
            char,
            line,
            column
        );

        i++;
        column++;
    }

    return tokens;
}
