/*
 * Motor HTTP de CodEsp
 *
 * Funciones:
 * - GET / POST / PUT / PATCH / DELETE
 * - encabezados
 * - parámetros
 * - cuerpo
 * - sesiones
 * - cookies del navegador mediante credentials: "include"
 */

export class SessionStore {

    constructor() {
        this.sessions = new Map();
    }

    crear() {
        const id =
            "ses_" +
            crypto.randomUUID();

        const session = {
            id,
            headers: {},
            cookies: {},
            created: new Date().toISOString()
        };

        this.sessions.set(
            id,
            session
        );

        return session;
    }

    obtener(id) {
        return this.sessions.get(id);
    }

    eliminar(id) {
        this.sessions.delete(id);
    }

    limpiar() {
        this.sessions.clear();
    }

    listar() {
        return [...this.sessions.values()];
    }
}


/*
 * Convierte:
 *
 * {
 *   limite: "20",
 *   pagina: "2"
 * }
 *
 * en:
 *
 * ?limite=20&pagina=2
 */

function appendParameters(url, parameters) {

    if (!parameters || typeof parameters !== "object") {
        return url;
    }

    const entries =
        Object.entries(parameters);

    if (!entries.length) {
        return url;
    }

    const separator =
        url.includes("?")
            ? "&"
            : "?";

    const query =
        entries
            .map(([key, value]) => {
                return (
                    encodeURIComponent(key) +
                    "=" +
                    encodeURIComponent(
                        String(value)
                    )
                );
            })
            .join("&");

    return url + separator + query;
}


/*
 * Convierte el cuerpo CodEsp
 * en un cuerpo HTTP.
 */

function buildBody(body, headers) {

    if (
        body === null ||
        body === undefined
    ) {
        return undefined;
    }

    if (
        typeof body === "string" ||
        body instanceof Blob ||
        body instanceof FormData
    ) {
        return body;
    }

    const contentType =
        Object.entries(headers)
            .find(([key]) =>
                key.toLowerCase() ===
                "content-type"
            )?.[1];

    if (
        contentType &&
        String(contentType)
            .toLowerCase()
            .includes("application/json")
    ) {
        return JSON.stringify(body);
    }

    /*
     * Por defecto enviamos JSON para objetos.
     */

    if (typeof body === "object") {
        return JSON.stringify(body);
    }

    return String(body);
}


/*
 * Normaliza encabezados.
 */

function normalizeHeaders(headers = {}) {

    const result = {};

    for (const [key, value] of Object.entries(headers)) {

        result[String(key)] =
            String(value);
    }

    return result;
}


/*
 * Solicitud HTTP principal.
 */

export async function requestHTTP(
    method,
    url,
    options = {},
    onLog = () => {},
    onNetwork = () => {}
) {

    const started =
        performance.now();

    method =
        String(method).toUpperCase();

    url =
        String(url);

    let headers =
        normalizeHeaders(
            options.headers
        );

    /*
     * Si existe una sesión,
     * agregamos sus encabezados.
     */

    if (options.session) {

        headers = {
            ...options.session.headers,
            ...headers
        };
    }

    /*
     * Parámetros URL.
     */

    const finalURL =
        appendParameters(
            url,
            options.parameters
        );

    /*
     * Cuerpo.
     */

    const body =
        buildBody(
            options.body,
            headers
        );

    const requestInit = {
        method,
        headers,
        credentials:
            options.credentials ||
            "include"
    };

    if (
        ![
            "GET",
            "HEAD"
        ].includes(method)
    ) {
        requestInit.body =
            body;
    }

    onLog(
        "info",
        `→ ${method} ${finalURL}`
    );

    let response;

    try {

        response =
            await fetch(
                finalURL,
                requestInit
            );

    } catch (error) {

        const elapsed =
            Math.round(
                performance.now() -
                started
            );

        onLog(
            "err",
            `✕ Error de red: ${error.message}`
        );

        onNetwork({
            method,
            url: finalURL,
            estado: 0,
            ok: false,
            tiempo: elapsed,
            error: error.message
        });

        throw new Error(
            `Error de red al solicitar ${finalURL}: ${error.message}`
        );
    }

    const text =
        await response.text();

    let json = null;

    if (text.trim()) {

        try {
            json =
                JSON.parse(text);
        } catch {
            json = null;
        }
    }

    const elapsed =
        Math.round(
            performance.now() -
            started
        );

    const result = {

        estado:
            response.status,

        ok:
            response.ok,

        estadoTexto:
            response.statusText,

        texto:
            text,

        json,

        encabezados:
            Object.fromEntries(
                response.headers.entries()
            ),

        url:
            response.url,

        tiempo:
            elapsed,

        metodo:
            method
    };

    /*
     * Guardar información útil
     * dentro de la sesión.
     */

    if (options.session) {

        options.session.lastResponse =
            result;

        /*
         * Los navegadores no permiten
         * leer Set-Cookie mediante fetch.
         *
         * Las cookies HTTP normales del
         * navegador se conservan automáticamente
         * cuando el servidor las permite.
         */
    }

    onLog(
        response.ok
            ? "ok"
            : "err",
        `← ${response.status} ${response.statusText || ""} (${elapsed} ms)`
    );

    onNetwork({
        method,
        url: finalURL,
        estado: response.status,
        ok: response.ok,
        tiempo: elapsed
    });

    return result;
}


/*
 * Ejecutar múltiples solicitudes.
 */

export async function requestSimultaneous(
    requests,
    onLog = () => {},
    onNetwork = () => {}
) {

    return Promise.all(
        requests.map(
            request =>
                requestHTTP(
                    request.method,
                    request.url,
                    request.options,
                    onLog,
                    onNetwork
                )
        )
    );
}
