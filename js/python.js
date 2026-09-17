// ==========================================
// CodEsp — Generador CodEsp → Python
// ==========================================

export function generarPython(ast) {

    if (!ast || !Array.isArray(ast.body)) {
        throw new Error("No se recibió un AST válido.");
    }

    const lineas = [];

    // Imports necesarios
    lineas.push("# Código generado automáticamente por CodEsp");
    lineas.push("# ==========================================");
    lineas.push("");

    const imports = detectarImports(ast);

    if (imports.includes("requests")) {
        lineas.push("import requests");
    }

    if (imports.includes("json")) {
        lineas.push("import json");
    }

    if (imports.includes("time")) {
        lineas.push("import time");
    }

    if (imports.length > 0) {
        lineas.push("");
    }

    // Estado HTTP
    const usaHTTP = contieneTipo(ast, "Request");

    if (usaHTTP) {
        lineas.push("sesion = requests.Session()");
        lineas.push("");
    }

    generarBloque(ast.body, lineas, 0);

    return lineas.join("\n").trim() + "\n";
}


// ==========================================
// GENERAR BLOQUE
// ==========================================

function generarBloque(body, lineas, nivel) {

    for (const node of body) {

        const indent = "    ".repeat(nivel);

        switch (node.type) {

            // --------------------------------
            // DEFINIR
            // --------------------------------

            case "Define":

                lineas.push(
                    indent +
                    `${node.name} = ${convertirExpresion(node.expression)}`
                );

                break;


            // --------------------------------
            // ASIGNAR
            // --------------------------------

            case "Assign":

                lineas.push(
                    indent +
                    `${node.name} = ${convertirExpresion(node.expression)}`
                );

                break;


            // --------------------------------
            // MOSTRAR
            // --------------------------------

            case "Show":

                lineas.push(
                    indent +
                    `print(${convertirExpresion(node.expression)})`
                );

                break;


            // --------------------------------
            // REQUEST
            // --------------------------------

            case "Request":

                generarRequest(node, lineas, nivel);

                break;


            // --------------------------------
            // IF
            // --------------------------------

            case "If":

                lineas.push(
                    indent +
                    `if ${convertirExpresion(node.condition)}:`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // ELSE
            // --------------------------------

            case "Else":

                lineas.push(
                    indent + "else:"
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // WHILE
            // --------------------------------

            case "While":

                lineas.push(
                    indent +
                    `while ${convertirExpresion(node.condition)}:`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // FOR
            // --------------------------------

            case "For":

                lineas.push(
                    indent +
                    `for ${node.variable} in ${convertirExpresion(node.iterable)}:`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // FUNCIÓN
            // --------------------------------

            case "Function": {

                const params = (node.params || []).join(", ");

                lineas.push(
                    indent +
                    `def ${node.name}(${params}):`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;
            }


            // --------------------------------
            // RETURN
            // --------------------------------

            case "Return":

                lineas.push(
                    indent +
                    `return ${convertirExpresion(node.expression)}`
                );

                break;


            // --------------------------------
            // TRY
            // --------------------------------

            case "Try":

                lineas.push(
                    indent + "try:"
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // CATCH
            // --------------------------------

            case "Catch":

                lineas.push(
                    indent +
                    `except Exception as ${node.variable || "error"}:`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel + 1);
                } else {
                    lineas.push(
                        indent + "    pass"
                    );
                }

                break;


            // --------------------------------
            // USE
            // --------------------------------

            case "Use":

                // "usar sesiones" no necesita código
                // porque Python ya utiliza requests.Session().
                if (
                    String(node.value)
                        .toLowerCase()
                        .includes("sesion")
                ) {
                    break;
                }

                break;


            // --------------------------------
            // IMPORT
            // --------------------------------

            case "Import":

                lineas.push(
                    indent +
                    `# importar ${node.value}`
                );

                break;


            // --------------------------------
            // PLUGIN
            // --------------------------------

            case "Plugin":

                lineas.push(
                    indent +
                    `# Plugin CodEsp: ${node.name}`
                );

                if (node.body?.length) {
                    generarBloque(node.body, lineas, nivel);
                }

                break;


            default:

                lineas.push(
                    indent +
                    `# Nodo no soportado: ${node.type}`
                );
        }
    }
}


// ==========================================
// REQUEST HTTP
// ==========================================

function generarRequest(node, lineas, nivel) {

    const indent = "    ".repeat(nivel);

    const method = node.method || "GET";
    const url = convertirExpresion(node.target);

    const headers = convertirObjeto(node.headers);
    const params = convertirObjeto(node.parameters);
    const body = convertirObjeto(node.body);

    const argumentos = [];

    // Headers

    if (Object.keys(headers).length > 0) {

        argumentos.push(
            `headers=${formatearPythonDict(headers)}`
        );
    }

    // Parámetros

    if (Object.keys(params).length > 0) {

        argumentos.push(
            `params=${formatearPythonDict(params)}`
        );
    }

    // Body

    if (Object.keys(body).length > 0) {

        argumentos.push(
            `json=${formatearPythonDict(body)}`
        );
    }

    const args = argumentos.length
        ? ", " + argumentos.join(", ")
        : "";

    lineas.push(
        indent +
        `${node.name} = sesion.${method.toLowerCase()}(${url}${args})`
    );

    lineas.push(
        indent +
        `# Estado HTTP: ${node.name}.status_code`
    );
}


// ==========================================
// EXPRESIONES
// ==========================================

function convertirExpresion(expression) {

    if (expression === undefined || expression === null) {
        return "None";
    }

    let value = String(expression).trim();

    if (!value) {
        return "None";
    }

    // nulo
    value = value.replace(/\bnulo\b/g, "None");

    // verdadero / falso
    value = value.replace(/\bverdadero\b/g, "True");
    value = value.replace(/\bfalso\b/g, "False");

    // operadores
    value = value.replace(/<>/g, "!=");
    value = value.replace(/\bY\b/g, "and");
    value = value.replace(/\bO\b/g, "or");
    value = value.replace(/\bNO\b/g, "not");

    // Propiedades de respuestas CodEsp

    value = value.replace(
        /([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\.estado\b/g,
        "$1.status_code"
    );

    value = value.replace(
        /([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\.json\b/g,
        "$1.json()"
    );

    // trim()
    value = value.replace(
        /\.trim\(\)/g,
        ".strip()"
    );

    // minusculas()
    value = value.replace(
        /\.minusculas\(\)/g,
        ".lower()"
    );

    // mayusculas()
    value = value.replace(
        /\.mayusculas\(\)/g,
        ".upper()"
    );

    // longitud()
    value = value.replace(
        /longitud\((.*?)\)/g,
        "len($1)"
    );

    return value;
}


// ==========================================
// OBJETOS
// ==========================================

function convertirObjeto(objeto) {

    if (!objeto || typeof objeto !== "object") {
        return {};
    }

    return objeto;
}


function formatearPythonDict(objeto) {

    const partes = [];

    for (const [key, value] of Object.entries(objeto)) {

        partes.push(
            `${JSON.stringify(key)}: ${convertirExpresion(value)}`
        );
    }

    return `{${partes.join(", ")}}`;
}


// ==========================================
// DETECTAR IMPORTS
// ==========================================

function detectarImports(ast) {

    const imports = [];

    if (contieneTipo(ast, "Request")) {
        imports.push("requests");
    }

    if (
        contieneTexto(ast, ".json") ||
        contieneTexto(ast, "json")
    ) {
        imports.push("json");
    }

    if (contieneTexto(ast, "tiempo") || contieneTexto(ast, "esperar")) {
        imports.push("time");
    }

    return imports;
}


// ==========================================
// UTILIDADES AST
// ==========================================

function contieneTipo(node, tipo) {

    if (!node) return false;

    if (node.type === tipo) {
        return true;
    }

    if (Array.isArray(node)) {

        return node.some(
            item => contieneTipo(item, tipo)
        );
    }

    if (typeof node === "object") {

        return Object.values(node).some(
            value => contieneTipo(value, tipo)
        );
    }

    return false;
}


function contieneTexto(node, texto) {

    if (!node) return false;

    if (typeof node === "string") {
        return node.includes(texto);
    }

    if (Array.isArray(node)) {

        return node.some(
            item => contieneTexto(item, texto)
        );
    }

    if (typeof node === "object") {

        return Object.values(node).some(
            value => contieneTexto(value, texto)
        );
    }

    return false;
}
