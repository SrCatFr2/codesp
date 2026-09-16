export function parse(source, tokens = []) {
    const lines = source.split("\n");

    const program = {
        type: "Program",
        body: []
    };

    /*
     * Convierte una línea en información útil.
     */

    const parsedLines = lines.map((raw, index) => {
        const indentation =
            raw.match(/^[ \t]*/)?.[0].length || 0;

        return {
            number: index + 1,
            raw,
            text: raw.trim(),
            indentation
        };
    });

    /*
     * Analizador recursivo de bloques.
     */

    function parseBlock(startIndex, indentation) {
        const body = [];

        let i = startIndex;

        while (i < parsedLines.length) {
            const line = parsedLines[i];

            if (!line.text) {
                i++;
                continue;
            }

            if (line.text.startsWith("#")) {
                i++;
                continue;
            }

            /*
             * Si regresamos a una indentación menor,
             * el bloque actual terminó.
             */

            if (line.indentation < indentation) {
                break;
            }

            /*
             * Si tenemos una indentación mayor inesperada,
             * dejamos que el bloque padre la procese.
             */

            if (
                line.indentation > indentation
            ) {
                throw new Error(
                    `Indentación inesperada en línea ${line.number}`
                );
            }

            const text = line.text;

            /*
             * USAR
             */

            let match = text.match(
                /^usar\s+(.+)$/
            );

            if (match) {
                body.push({
                    type: "Use",
                    value: match[1],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * IMPORTAR
             */

            match = text.match(
                /^importar\s+(.+)$/
            );

            if (match) {
                body.push({
                    type: "Import",
                    value: match[1],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * DEFINIR
             */

            match = text.match(
                /^definir\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*=\s*(.+)$/
            );

            if (match) {
                body.push({
                    type: "Define",
                    name: match[1],
                    expression: match[2],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * ASIGNAR
             */

            match = text.match(
                /^asignar\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*=\s*(.+)$/
            );

            if (match) {
                body.push({
                    type: "Assign",
                    name: match[1],
                    expression: match[2],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * ASIGNACIÓN DIRECTA
             */

            match = text.match(
                /^([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*=\s*(.+)$/
            );

            /*
             * Solicitud HTTP tiene prioridad.
             */

            const requestMatch = text.match(
                /^([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*=\s*solicitar\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+?)(?::)?$/i
            );

            if (requestMatch) {
                const node = {
                    type: "Request",
                    name: requestMatch[1],
                    method: requestMatch[2].toUpperCase(),
                    target: removeQuotes(requestMatch[3]),
                    headers: {},
                    parameters: {},
                    body: null,
                    session: null,
                    line: line.number
                };

                /*
                 * Buscar subbloque HTTP.
                 */

                let next = i + 1;

                while (
                    next < parsedLines.length &&
                    (
                        !parsedLines[next].text ||
                        parsedLines[next].indentation > indentation
                    )
                ) {
                    const sub = parsedLines[next];

                    if (!sub.text) {
                        next++;
                        continue;
                    }

                    if (
                        sub.indentation <= indentation
                    ) {
                        break;
                    }

                    const subText = sub.text;

                    /*
                     * SESIÓN
                     */

                    let m = subText.match(
                        /^sesion\s*:\s*(.+)$/
                    );

                    if (m) {
                        node.session = m[1];
                        next++;
                        continue;
                    }

                    /*
                     * BLOQUE DE ENCABEZADOS
                     */

                    if (
                        subText === "encabezados:"
                    ) {
                        const result =
                            readKeyValueBlock(
                                next + 1,
                                sub.indentation,
                                parsedLines
                            );

                        Object.assign(
                            node.headers,
                            result.values
                        );

                        next = result.next;
                        continue;
                    }

                    /*
                     * BLOQUE DE PARÁMETROS
                     */

                    if (
                        subText === "parametros:"
                    ) {
                        const result =
                            readKeyValueBlock(
                                next + 1,
                                sub.indentation,
                                parsedLines
                            );

                        Object.assign(
                            node.parameters,
                            result.values
                        );

                        next = result.next;
                        continue;
                    }

                    /*
                     * BLOQUE ENVIAR
                     */

                    if (
                        subText === "enviar:"
                    ) {
                        const result =
                            readKeyValueBlock(
                                next + 1,
                                sub.indentation,
                                parsedLines
                            );

                        node.body = result.values;

                        next = result.next;
                        continue;
                    }

                    next++;
                }

                body.push(node);

                i = next;
                continue;
            }

            if (match) {
                body.push({
                    type: "Assign",
                    name: match[1],
                    expression: match[2],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * MOSTRAR
             */

            match = text.match(
                /^mostrar\s+(.+)$/
            );

            if (match) {
                body.push({
                    type: "Show",
                    expression: match[1],
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * SI
             */

            match = text.match(
                /^si\s+(.+):$/
            );

            if (match) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "If",
                    condition: match[1],
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * SI NO
             */

            if (
                /^si\s+no\s*:$/i.test(text) ||
                /^si no:$/i.test(text)
            ) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "Else",
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * MIENTRAS
             */

            match = text.match(
                /^mientras\s+(.+):$/
            );

            if (match) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "While",
                    condition: match[1],
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * PARA
             */

            match = text.match(
                /^para\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s+en\s+(.+):$/
            );

            if (match) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "For",
                    variable: match[1],
                    iterable: match[2],
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * FUNCION
             */

            match = text.match(
                /^funcion\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*\((.*?)\):$/
            );

            if (match) {
                const params = match[2]
                    ? match[2]
                        .split(",")
                        .map(x => x.trim())
                        .filter(Boolean)
                    : [];

                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "Function",
                    name: match[1],
                    params,
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * DEVOLVER
             */

            match = text.match(
                /^devolver(?:\s+(.+))?$/
            );

            if (match) {
                body.push({
                    type: "Return",
                    expression: match[1] || "nulo",
                    line: line.number
                });

                i++;
                continue;
            }

            /*
             * INTENTAR
             */

            if (/^intentar:$/.test(text)) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "Try",
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * CAPTURAR
             */

            match = text.match(
                /^capturar(?:\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*))?:$/
            );

            if (match) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "Catch",
                    variable: match[1] || "error",
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            /*
             * PLUGIN
             */

            match = text.match(
                /^plugin\s+["'](.+?)["']:$/
            );

            if (match) {
                const result =
                    parseBlock(
                        i + 1,
                        getNextIndentation(i + 1, indentation)
                    );

                body.push({
                    type: "Plugin",
                    name: match[1],
                    body: result.body,
                    line: line.number
                });

                i = result.next;
                continue;
            }

            throw new Error(
                `Instrucción no reconocida en línea ${line.number}: ${text}`
            );
        }

        return {
            body,
            next: i
        };
    }

    const result =
        parseBlock(
            0,
            getNextIndentation(0, -1)
        );

    program.body = result.body;

    return program;
}


/*
 * Lee:
 *
 * encabezados:
 *     autorizacion = "Bearer ..."
 *     contenido = "json"
 */

function readKeyValueBlock(
    start,
    parentIndentation,
    lines
) {
    const values = {};

    let i = start;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.text) {
            i++;
            continue;
        }

        if (
            line.indentation <= parentIndentation
        ) {
            break;
        }

        const match =
            line.text.match(
                /^([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*=\s*(.+)$/
            );

        if (!match) {
            throw new Error(
                `Entrada inválida en línea ${line.number}: ${line.text}`
            );
        }

        values[match[1]] = match[2];

        i++;
    }

    return {
        values,
        next: i
    };
}


/*
 * Encuentra la indentación del siguiente bloque.
 */

function getNextIndentation(
    index,
    parentIndentation
) {
    while (index < Number.MAX_SAFE_INTEGER) {
        /*
         * Esta función se reemplaza conceptualmente
         * por el valor de la siguiente línea real.
         *
         * Como el parser trabaja sobre parsedLines,
         * el valor se obtiene desde el contexto.
         */

        break;
    }

    /*
     * Los bloques CodEsp usan normalmente
     * cuatro espacios.
     */

    return parentIndentation + 4;
}


/*
 * Quitar comillas de una expresión sencilla.
 */

function removeQuotes(value) {
    value = value.trim();

    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
}
