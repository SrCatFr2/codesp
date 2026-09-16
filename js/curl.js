/*
 * Convertidor cURL → CodEsp
 *
 * Intenta conservar:
 * - método
 * - URL
 * - encabezados
 * - datos
 * - cookies
 * - parámetros
 */

export function curlToCodEsp(input) {

    const source =
        normalizeCurl(input);

    if (
        !/^curl(?:\s|$)/i.test(source)
    ) {
        throw new Error(
            "El texto proporcionado no parece ser un comando cURL."
        );
    }

    const method =
        getMethod(source);

    const url =
        getURL(source);

    if (!url) {
        throw new Error(
            "No se encontró una URL válida en el cURL."
        );
    }

    const headers =
        getHeaders(source);

    const cookies =
        getCookies(source);

    const data =
        getData(source);

    const parameters =
        getParameters(url);

    let cleanURL =
        removeQuery(url);

    /*
     * Si existe -G / --get,
     * los datos se convierten en parámetros.
     */

    const isGet =
        /\s(?:-G|--get)(?:\s|$)/i.test(source);

    let output =
        `respuesta = solicitar ${method} "${cleanURL}"`;

    const sections = [];

    /*
     * PARÁMETROS
     */

    if (
        isGet &&
        Object.keys(parameters).length
    ) {

        sections.push(
            createKeyValueBlock(
                "parametros",
                parameters
            )
        );
    }

    /*
     * ENCABEZADOS
     */

    const allHeaders = {
        ...headers
    };

    if (cookies) {
        allHeaders.cookie =
            cookies;
    }

    if (
        Object.keys(allHeaders).length
    ) {

        sections.push(
            createKeyValueBlock(
                "encabezados",
                allHeaders
            )
        );
    }

    /*
     * CUERPO
     */

    if (
        data !== null &&
        !isGet
    ) {

        sections.push(
            createKeyValueBlock(
                "enviar",
                {
                    cuerpo:
                        data
                }
            )
        );
    }

    if (sections.length) {
        output += ":\n";
        output += sections.join("\n");
    }

    return output;
}


/*
 * Normalizar continuaciones:
 *
 * curl \
 *   -H "..."
 *
 * → curl -H "..."
 */

function normalizeCurl(input) {

    return input
        .replace(/\\\r?\n/g, " ")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/*
 * Método.
 */

function getMethod(source) {

    const explicit =
        source.match(
            /(?:-X|--request)\s+["']?([A-Za-z]+)["']?/i
        );

    if (explicit) {
        return explicit[1].toUpperCase();
    }

    if (
        /(?:-d|--data|--data-raw|--data-binary|--data-urlencode)\s+/i
            .test(source)
    ) {
        return "POST";
    }

    return "GET";
}


/*
 * URL.
 */

function getURL(source) {

    /*
     * Primero URL entre comillas.
     */

    const quoted =
        source.match(
            /["'](https?:\/\/[^"']+)["']/i
        );

    if (quoted) {
        return quoted[1];
    }

    /*
     * Después URL sin comillas.
     */

    const plain =
        source.match(
            /(https?:\/\/[^\s'"]+)/i
        );

    return plain
        ? plain[1]
        : null;
}


/*
 * Encabezados.
 */

function getHeaders(source) {

    const headers = {};

    const regex =
        /(?:-H|--header)\s+(?:"([^"]*)"|'([^']*)'|([^\s]+))/gi;

    for (
        const match of source.matchAll(regex)
    ) {

        const value =
            match[1] ??
            match[2] ??
            match[3] ??
            "";

        const index =
            value.indexOf(":");

        if (index === -1) {
            continue;
        }

        const key =
            value
                .slice(0, index)
                .trim()
                .toLowerCase()
                .replace(/[^a-zA-Z0-9_ÁÉÍÓÚáéíóúÑñ]/g, "_");

        const headerValue =
            value
                .slice(index + 1)
                .trim();

        headers[key] =
            headerValue;
    }

    return headers;
}


/*
 * Cookies.
 */

function getCookies(source) {

    const match =
        source.match(
            /(?:-b|--cookie)\s+(?:"([^"]*)"|'([^']*)'|([^\s]+))/i
        );

    return (
        match?.[1] ??
        match?.[2] ??
        match?.[3] ??
        null
    );
}


/*
 * Datos.
 */

function getData(source) {

    const match =
        source.match(
            /(?:-d|--data|--data-raw|--data-binary|--data-urlencode)\s+(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\s]+))/i
        );

    if (!match) {
        return null;
    }

    return (
        match[1] ??
        match[2] ??
        match[3]
    );
}


/*
 * Query string → objeto.
 */

function getParameters(url) {

    const result = {};

    try {

        const parsed =
            new URL(url);

        parsed.searchParams.forEach(
            (value, key) => {
                result[key] = value;
            }
        );

    } catch {
        return {};
    }

    return result;
}


/*
 * Quitar query string.
 */

function removeQuery(url) {

    try {

        const parsed =
            new URL(url);

        parsed.search = "";

        return parsed.toString();

    } catch {

        return url.split("?")[0];
    }
}


/*
 * Crear bloque CodEsp.
 */

function createKeyValueBlock(
    name,
    values
) {

    const lines = [
        `    ${name}:`
    ];

    for (
        const [key, value]
        of Object.entries(values)
    ) {

        lines.push(
            `        ${key} = ${quote(value)}`
        );
    }

    return lines.join("\n");
}


/*
 * Escapar cadenas.
 */

function quote(value) {

    return JSON.stringify(
        String(value)
    );
}
