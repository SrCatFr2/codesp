/*
 * Generador CodEsp → Python
 *
 * Genera Python utilizando requests.
 */

export function toPython(ast) {

    const lines = [
        "import requests",
        "",
        "",
        "sesion = requests.Session()",
        ""
    ];

    const context = {
        indent: 0
    };

    generateNodes(
        ast.body,
        lines,
        context
    );

    lines.push("");

    return lines.join("\n");
}


function generateNodes(
    nodes,
    lines,
    context
) {

    for (
        const node of nodes
    ) {

        const indent =
            "    ".repeat(
                context.indent
            );


        /*
         * DEFINIR / ASIGNAR
         */

        if (
            node.type === "Define" ||
            node.type === "Assign"
        ) {

            lines.push(
                indent +
                `${node.name} = ${pythonExpression(node.expression)}`
            );

            continue;
        }


        /*
         * MOSTRAR
         */

        if (node.type === "Show") {

            lines.push(
                indent +
                `print(${pythonExpression(node.expression)})`
            );

            continue;
        }


        /*
         * HTTP
         */

        if (node.type === "Request") {

            const method =
                node.method.toLowerCase();

            const url =
                pythonExpression(
                    node.target
                );

            const argumentsList = [];

            /*
             * Parámetros.
             */

            if (
                Object.keys(
                    node.parameters || {}
                ).length
            ) {

                const params =
                    objectToPython(
                        node.parameters
                    );

                argumentsList.push(
                    `params=${params}`
                );
            }


            /*
             * Encabezados.
             */

            if (
                Object.keys(
                    node.headers || {}
                ).length
            ) {

                const headers =
                    objectToPython(
                        node.headers
                    );

                argumentsList.push(
                    `headers=${headers}`
                );
            }


            /*
             * Cuerpo.
             */

            if (node.body) {

                const body =
                    objectToPython(
                        node.body
                    );

                argumentsList.push(
                    `json=${body}`
                );
            }


            const argumentsText =
                argumentsList.length
                    ? ", " +
                      argumentsList.join(", ")
                    : "";

            lines.push(
                indent +
                `${node.name} = sesion.${method}(${url}${argumentsText})`
            );

            lines.push(
                indent +
                `${node.name}_json = None`
            );

            lines.push(
                indent +
                `try:`
            );

            lines.push(
                indent +
                `    ${node.name}_json = ${node.name}.json()`
            );

            lines.push(
                indent +
                `except ValueError:`
            );

            lines.push(
                indent +
                `    pass`
            );

            continue;
        }


        /*
         * IF
         */

        if (node.type === "If") {

            lines.push(
                indent +
                `if ${pythonExpression(node.condition)}:`
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }


        /*
         * ELSE
         */

        if (node.type === "Else") {

            lines.push(
                indent +
                "else:"
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }


        /*
         * WHILE
         */

        if (node.type === "While") {

            lines.push(
                indent +
                `while ${pythonExpression(node.condition)}:`
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }


        /*
         * FOR
         */

        if (node.type === "For") {

            lines.push(
                indent +
                `for ${node.variable} in ${pythonExpression(node.iterable)}:`
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }


        /*
         * FUNCIÓN
         */

        if (node.type === "Function") {

            lines.push(
                indent +
                `def ${node.name}(${node.params.join(", ")}):`
            );

            context.indent++;

            if (!node.body.length) {

                lines.push(
                    indent +
                    "    pass"
                );

            } else {

                generateNodes(
                    node.body,
                    lines,
                    context
                );
            }

            context.indent--;

            lines.push("");

            continue;
        }


        /*
         * RETURN
         */

        if (node.type === "Return") {

            lines.push(
                indent +
                `return ${pythonExpression(node.expression)}`
            );

            continue;
        }


        /*
         * TRY
         */

        if (node.type === "Try") {

            lines.push(
                indent +
                "try:"
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }


        /*
         * CATCH
         */

        if (node.type === "Catch") {

            lines.push(
                indent +
                `except Exception as ${node.variable}:`
            );

            context.indent++;

            generateNodes(
                node.body,
                lines,
                context
            );

            context.indent--;

            continue;
        }
    }
}


/*
 * Expresiones.
 */

function pythonExpression(
    expression
) {

    if (
        expression === undefined ||
        expression === null
    ) {
        return "None";
    }

    let result =
        String(expression).trim();

    result =
        result.replace(
            /\bverdadero\b/g,
            "True"
        );

    result =
        result.replace(
            /\bfalso\b/g,
            "False"
        );

    result =
        result.replace(
            /\bnulo\b/g,
            "None"
        );

    result =
        result.replace(
            /\brespuesta\.json\b/g,
            "respuesta_json"
        );

    result =
        result.replace(
            /\.json\b/g,
            "_json"
        );

    result =
        result.replace(
            /\.trim\(\)/g,
            ".strip()"
        );

    result =
        result.replace(
            /\.minusculas\(\)/g,
            ".lower()"
        );

    result =
        result.replace(
            /\.mayusculas\(\)/g,
            ".upper()"
        );

    result =
        result.replace(
            /\.longitud\(\)/g,
            "__len__()"
        );

    return result;
}


/*
 * Objeto JS → literal Python.
 */

function objectToPython(
    object
) {

    const values =
        Object.entries(object)
            .map(
                ([key, value]) =>
                    `${JSON.stringify(key)}: ${pythonExpression(value)}`
            );

    return `{${values.join(", ")}}`;
}
