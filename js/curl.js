// ==========================================
// CodEsp — Conversor cURL → CodEsp
// ==========================================

export function convertirCurl(curl) {

    if (!curl || !String(curl).trim()) {
        throw new Error("No se recibió ningún comando cURL.");
    }

    curl = String(curl)
        .replace(/\\\r?\n/g, " ")
        .replace(/\r?\n/g, " ")
        .trim();

    if (!/^curl\s+/i.test(curl)) {
        throw new Error("El texto no parece ser un comando cURL.");
    }

    const tokens = tokenizarCurl(curl);

    let url = null;
    let method = "GET";
    const headers = {};
    let body = null;

    for (let i = 0; i < tokens.length; i++) {

        const token = tokens[i];

        // ------------------------------------------
        // URL
        // ------------------------------------------

        if (
            !url &&
            /^https?:\/\//i.test(token)
        ) {
            url = token;
            continue;
        }

        // ------------------------------------------
        // MÉTODO
        // ------------------------------------------

        if (
            token === "-X" ||
            token === "--request"
        ) {
            method = (tokens[++i] || "GET").toUpperCase();
            continue;
        }

        // ------------------------------------------
        // HEADERS
        // ------------------------------------------

        if (
            token === "-H" ||
            token === "--header"
        ) {
            const header = tokens[++i];

            if (!header) continue;

            const separator = header.indexOf(":");

            if (separator !== -1) {

                const name = header
                    .slice(0, separator)
                    .trim();

                const value = header
                    .slice(separator + 1)
                    .trim();

                headers[name] = value;
            }

            continue;
        }

        // ------------------------------------------
        // DATOS POST
        // ------------------------------------------

        if (
            token === "-d" ||
            token === "--data" ||
            token === "--data-raw" ||
            token === "--data-binary"
        ) {
            body = tokens[++i] || "";
            continue;
        }

        // ------------------------------------------
        // DATA URL ENCODED
        // ------------------------------------------

        if (token === "--data-urlencode") {
            const data = tokens[++i] || "";

            if (body) {
                body += "&" + data;
            } else {
                body = data;
            }

            continue;
        }

        // ------------------------------------------
        // GET CON DATOS
        // ------------------------------------------

        if (token === "-G" || token === "--get") {
            method = "GET";
            continue;
        }

        // ------------------------------------------
        // COOKIE
        // ------------------------------------------

        if (
            token === "-b" ||
            token === "--cookie"
        ) {
            const cookie = tokens[++i];

            if (cookie) {
                headers["Cookie"] = cookie;
            }

            continue;
        }

        // ------------------------------------------
        // USER AGENT
        // ------------------------------------------

        if (
            token === "-A" ||
            token === "--user-agent"
        ) {
            const agent = tokens[++i];

            if (agent) {
                headers["User-Agent"] = agent;
            }

            continue;
        }
    }

    if (!url) {
        throw new Error("No se encontró la URL del cURL.");
    }

    // Si hay body y no se especificó método,
    // cURL normalmente estaría haciendo POST.
    if (body !== null && method === "GET") {
        method = "POST";
    }

    // ------------------------------------------
    // GENERAR CODESP
    // ------------------------------------------

    let codigo = "";

    codigo += `respuesta = solicitar ${method} ${formatearValor(url)}`;

    if (
        Object.keys(headers).length > 0 ||
        body !== null
    ) {
        codigo += ":";
    }

    // Headers

    if (Object.keys(headers).length > 0) {

        codigo += "\n    encabezados:";

        for (const [name, value] of Object.entries(headers)) {

            codigo +=
                `\n        ${nombreSeguro(name)} = ${formatearValor(value)}`;
        }
    }

    // Body

    if (body !== null) {

        codigo += "\n    enviar:";

        const datos = convertirBody(body);

        for (const [name, value] of Object.entries(datos)) {

            codigo +=
                `\n        ${nombreSeguro(name)} = ${formatearValor(value)}`;
        }
    }

    codigo += "\n";

    return codigo;
}


// ==========================================
// TOKENIZADOR cURL
// ==========================================

function tokenizarCurl(texto) {

    const tokens = [];

    let actual = "";
    let comilla = null;

    for (let i = 0; i < texto.length; i++) {

        const char = texto[i];

        // Dentro de comillas

        if (comilla) {

            if (char === comilla) {
                comilla = null;
            } else {
                actual += char;
            }

            continue;
        }

        // Inicio de comillas

        if (char === '"' || char === "'") {
            comilla = char;
            continue;
        }

        // Espacio

        if (/\s/.test(char)) {

            if (actual) {
                tokens.push(actual);
                actual = "";
            }

            continue;
        }

        actual += char;
    }

    if (actual) {
        tokens.push(actual);
    }

    return tokens;
}


// ==========================================
// CONVERTIR BODY
// ==========================================

function convertirBody(body) {

    body = String(body).trim();

    // JSON

    if (
        (body.startsWith("{") && body.endsWith("}")) ||
        (body.startsWith("[") && body.endsWith("]"))
    ) {

        try {

            const json = JSON.parse(body);

            if (
                json &&
                typeof json === "object" &&
                !Array.isArray(json)
            ) {
                return json;
            }

        } catch {
            // Si no es JSON válido,
            // se trata como texto normal.
        }
    }

    // application/x-www-form-urlencoded

    const resultado = {};

    if (body.includes("=")) {

        for (const parte of body.split("&")) {

            const index = parte.indexOf("=");

            if (index === -1) continue;

            const key = decodeURIComponent(
                parte.slice(0, index)
            );

            const value = decodeURIComponent(
                parte.slice(index + 1)
            );

            resultado[key] = value;
        }

        if (Object.keys(resultado).length > 0) {
            return resultado;
        }
    }

    // Body como texto

    return {
        datos: body
    };
}


// ==========================================
// IDENTIFICADORES CODESP
// ==========================================

function nombreSeguro(nombre) {

    let resultado = String(nombre)
        .trim()
        .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9_]/g, "_");

    if (/^[0-9]/.test(resultado)) {
        resultado = "_" + resultado;
    }

    return resultado || "dato";
}


// ==========================================
// VALORES CODESP
// ==========================================

function formatearValor(valor) {

    if (valor === null) {
        return "nulo";
    }

    if (typeof valor === "boolean") {
        return valor ? "verdadero" : "falso";
    }

    if (typeof valor === "number") {
        return String(valor);
    }

    const texto = String(valor)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");

    return `"${texto}"`;
}
