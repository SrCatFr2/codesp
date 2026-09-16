import {
    requestHTTP,
    requestSimultaneous,
    SessionStore
} from "./http.js";


export class Runtime {

    constructor({
        log = () => {},
        network = () => {},
        variables = () => {},
        pluginLoader = () => null
    } = {}) {

        this.log = log;
        this.network = network;
        this.variables = variables;
        this.pluginLoader = pluginLoader;

        this.sessions =
            new SessionStore();

        this.env = {};

        this.functions = {};

        this.plugins = {};

        this.stopped = false;

        this.returnValue =
            undefined;
    }


    /*
     * Ejecutar programa completo.
     */

    async run(ast) {

        this.stopped = false;

        this.log(
            "info",
            "[RUNTIME] Iniciando ejecución"
        );

        this.log(
            "info",
            `[RUNTIME] ${ast.body.length} instrucciones`
        );

        try {

            await this.executeBlock(
                ast.body
            );

        } catch (error) {

            if (
                error instanceof ReturnSignal
            ) {

                this.returnValue =
                    error.value;

            } else {

                throw error;
            }
        }

        this.variables(
            this.env
        );

        return this.env;
    }


    /*
     * Detener ejecución.
     */

    stop() {

        this.stopped = true;

        this.log(
            "info",
            "[RUNTIME] Ejecución detenida"
        );
    }


    /*
     * Ejecutar un bloque.
     */

    async executeBlock(
        nodes,
        localEnv = null
    ) {

        for (
            let i = 0;
            i < nodes.length;
            i++
        ) {

            if (this.stopped) {
                break;
            }

            const node =
                nodes[i];

            await this.executeNode(
                node,
                localEnv
            );
        }
    }


    /*
     * Ejecutar nodo AST.
     */

    async executeNode(
        node,
        localEnv = null
    ) {

        const env =
            localEnv || this.env;


        /*
         * USAR
         */

        if (node.type === "Use") {

            await this.usePlugin(
                node.value
            );

            return;
        }


        /*
         * IMPORTAR
         */

        if (node.type === "Import") {

            this.log(
                "info",
                `[IMPORT] ${node.value}`
            );

            return;
        }


        /*
         * PLUGIN
         */

        if (node.type === "Plugin") {

            this.plugins[node.name] =
                node;

            this.log(
                "info",
                `[PLUGIN] Registrado: ${node.name}`
            );

            return;
        }


        /*
         * DEFINIR
         */

        if (
            node.type === "Define" ||
            node.type === "Assign"
        ) {

            env[node.name] =
                await this.evalExpression(
                    node.expression,
                    env
                );

            this.variables(
                this.env
            );

            return;
        }


        /*
         * MOSTRAR
         */

        if (node.type === "Show") {

            const value =
                await this.evalExpression(
                    node.expression,
                    env
                );

            this.log(
                "ok",
                this.format(value)
            );

            return;
        }


        /*
         * SOLICITUD HTTP
         */

        if (node.type === "Request") {

            await this.executeRequest(
                node,
                env
            );

            return;
        }


        /*
         * IF
         */

        if (node.type === "If") {

            const condition =
                await this.evalExpression(
                    node.condition,
                    env
                );

            if (this.truthy(condition)) {

                await this.executeBlock(
                    node.body,
                    env
                );

            }

            return;
        }


        /*
         * ELSE
         */

        if (node.type === "Else") {

            await this.executeBlock(
                node.body,
                env
            );

            return;
        }


        /*
         * WHILE
         */

        if (node.type === "While") {

            let guard = 0;

            while (
                this.truthy(
                    await this.evalExpression(
                        node.condition,
                        env
                    )
                )
            ) {

                if (this.stopped) {
                    break;
                }

                await this.executeBlock(
                    node.body,
                    env
                );

                guard++;

                /*
                 * Protección contra
                 * bucles infinitos.
                 */

                if (guard > 10000) {

                    throw new Error(
                        `Bucle mientras excedió 10000 iteraciones en línea ${node.line}`
                    );
                }
            }

            return;
        }


        /*
         * FOR
         */

        if (node.type === "For") {

            const iterable =
                await this.evalExpression(
                    node.iterable,
                    env
                );

            if (
                !iterable ||
                typeof iterable[
                    Symbol.iterator
                ] !== "function"
            ) {

                throw new Error(
                    `El valor de "${node.iterable}" no es iterable.`
                );
            }

            for (
                const value of iterable
            ) {

                if (this.stopped) {
                    break;
                }

                env[node.variable] =
                    value;

                await this.executeBlock(
                    node.body,
                    env
                );
            }

            this.variables(
                this.env
            );

            return;
        }


        /*
         * FUNCIÓN
         */

        if (node.type === "Function") {

            this.functions[node.name] =
                node;

            this.log(
                "info",
                `[FUNCIÓN] Registrada: ${node.name}()`
            );

            return;
        }


        /*
         * RETURN
         */

        if (node.type === "Return") {

            const value =
                await this.evalExpression(
                    node.expression,
                    env
                );

            throw new ReturnSignal(
                value
            );
        }


        /*
         * TRY / CATCH
         *
         * Estos nodos se manejan
         * cuando aparecen juntos.
         */

        if (node.type === "Try") {

            try {

                await this.executeBlock(
                    node.body,
                    env
                );

            } catch (error) {

                /*
                 * El parser normalmente
                 * dejará Catch como nodo
                 * independiente si no se
                 * enlaza todavía.
                 *
                 * Aquí lo exponemos.
                 */

                env.error =
                    this.errorObject(error);

                throw error;
            }

            return;
        }


        /*
         * CATCH
         */

        if (node.type === "Catch") {

            env[node.variable] =
                env.error ||
                null;

            await this.executeBlock(
                node.body,
                env
            );

            return;
        }
    }


    /*
     * Ejecutar solicitud HTTP.
     */

    async executeRequest(
        node,
        env
    ) {

        let url =
            await this.evalExpression(
                node.target,
                env
            );

        url =
            String(url);


        /*
         * Resolver encabezados.
         */

        const headers = {};

        for (
            const [key, expression]
            of Object.entries(
                node.headers || {}
            )
        ) {

            headers[key] =
                await this.evalExpression(
                    expression,
                    env
                );
        }


        /*
         * Resolver parámetros.
         */

        const parameters = {};

        for (
            const [key, expression]
            of Object.entries(
                node.parameters || {}
            )
        ) {

            parameters[key] =
                await this.evalExpression(
                    expression,
                    env
                );
        }


        /*
         * Resolver cuerpo.
         */

        let body = null;

        if (node.body) {

            body = {};

            for (
                const [key, expression]
                of Object.entries(
                    node.body
                )
            ) {

                body[key] =
                    await this.evalExpression(
                        expression,
                        env
                    );
            }
        }


        /*
         * Resolver sesión.
         */

        let session = null;

        if (node.session) {

            session =
                await this.evalExpression(
                    node.session,
                    env
                );

            if (
                typeof session !== "object" ||
                !session
            ) {

                throw new Error(
                    `La sesión "${node.session}" no es válida.`
                );
            }
        }


        const result =
            await requestHTTP(
                node.method,
                url,
                {
                    headers,
                    parameters,
                    body,
                    session
                },
                this.log,
                this.network
            );


        env[node.name] =
            result;

        this.variables(
            this.env
        );
    }


    /*
     * Evaluador de expresiones.
     */

    async evalExpression(
        expression,
        env = this.env
    ) {

        if (
            expression === undefined ||
            expression === null
        ) {
            return null;
        }

        let expr =
            String(expression).trim();


        /*
         * BOOLEANOS
         */

        if (expr === "verdadero") {
            return true;
        }

        if (expr === "falso") {
            return false;
        }

        if (expr === "nulo") {
            return null;
        }


        /*
         * CADENAS
         */

        if (
            (
                expr.startsWith('"') &&
                expr.endsWith('"')
            ) ||
            (
                expr.startsWith("'") &&
                expr.endsWith("'")
            )
        ) {

            return this.unescapeString(
                expr.slice(
                    1,
                    -1
                )
            );
        }


        /*
         * NÚMEROS
         */

        if (
            /^-?\d+(\.\d+)?$/.test(expr)
        ) {

            return Number(expr);
        }


        /*
         * CREAR SESIÓN
         */

        if (
            expr === "crear sesion"
        ) {

            return this.sessions.crear();
        }


        /*
         * OPERADORES LÓGICOS
         */

        const logical =
            this.findOperator(
                expr,
                [
                    "||",
                    "&&"
                ]
            );

        if (logical) {

            const left =
                await this.evalExpression(
                    logical.left,
                    env
                );

            const right =
                await this.evalExpression(
                    logical.right,
                    env
                );

            if (
                logical.operator === "&&"
            ) {
                return (
                    this.truthy(left) &&
                    this.truthy(right)
                );
            }

            return (
                this.truthy(left) ||
                this.truthy(right)
            );
        }


        /*
         * COMPARACIONES
         */

        const comparison =
            this.findOperator(
                expr,
                [
                    "==",
                    "!=",
                    ">=",
                    "<=",
                    ">",
                    "<"
                ]
            );

        if (comparison) {

            const left =
                await this.evalExpression(
                    comparison.left,
                    env
                );

            const right =
                await this.evalExpression(
                    comparison.right,
                    env
                );

            switch (
                comparison.operator
            ) {

                case "==":
                    return left == right;

                case "!=":
                    return left != right;

                case ">":
                    return left > right;

                case "<":
                    return left < right;

                case ">=":
                    return left >= right;

                case "<=":
                    return left <= right;
            }
        }


        /*
         * SUMA / CONCATENACIÓN
         */

        const addition =
            this.splitOperator(
                expr,
                "+"
            );

        if (
            addition.length > 1
        ) {

            const values = [];

            for (
                const part
                of addition
            ) {

                values.push(
                    await this.evalExpression(
                        part,
                        env
                    )
                );
            }

            /*
             * Si todos son números,
             * hacemos suma.
             *
             * Si existe string,
             * concatenamos.
             */

            if (
                values.every(
                    value =>
                        typeof value ===
                        "number"
                )
            ) {

                return values.reduce(
                    (a, b) => a + b,
                    0
                );
            }

            return values
                .map(value =>
                    value === null ||
                    value === undefined
                        ? ""
                        : String(value)
                )
                .join("");
        }


        /*
         * RESTA
         */

        const subtraction =
            this.splitOperator(
                expr,
                "-"
            );

        if (
            subtraction.length > 1 &&
            !expr.startsWith("-")
        ) {

            const values = [];

            for (
                const part
                of subtraction
            ) {

                values.push(
                    Number(
                        await this.evalExpression(
                            part,
                            env
                        )
                    )
                );
            }

            return values.slice(1).reduce(
                (a, b) => a - b,
                values[0]
            );
        }


        /*
         * MULTIPLICACIÓN
         */

        const multiplication =
            this.splitOperator(
                expr,
                "*"
            );

        if (
            multiplication.length > 1
        ) {

            const values = [];

            for (
                const part
                of multiplication
            ) {

                values.push(
                    Number(
                        await this.evalExpression(
                            part,
                            env
                        )
                    )
                );
            }

            return values.reduce(
                (a, b) => a * b,
                1
            );
        }


        /*
         * DIVISIÓN
         */

        const division =
            this.splitOperator(
                expr,
                "/"
            );

        if (
            division.length > 1
        ) {

            const values = [];

            for (
                const part
                of division
            ) {

                values.push(
                    Number(
                        await this.evalExpression(
                            part,
                            env
                        )
                    )
                );
            }

            return values.slice(1).reduce(
                (a, b) => a / b,
                values[0]
            );
        }


        /*
         * FUNCIONES INTERNAS
         */

        const functionMatch =
            expr.match(
                /^([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\((.*)\)$/
            );

        if (functionMatch) {

            const name =
                functionMatch[1];

            const argumentText =
                functionMatch[2];

            const args =
                this.parseArguments(
                    argumentText
                );

            const values = [];

            for (
                const argument
                of args
            ) {

                values.push(
                    await this.evalExpression(
                        argument,
                        env
                    )
                );
            }

            return this.callFunction(
                name,
                values,
                env
            );
        }


        /*
         * ACCESO A PROPIEDADES
         *
         * respuesta.estado
         * respuesta.json.usuario
         */

        if (
            /^[A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*(\.[A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)+$/
                .test(expr)
        ) {

            const parts =
                expr.split(".");

            let value =
                env[parts.shift()];

            for (
                const property
                of parts
            ) {

                if (
                    value === null ||
                    value === undefined
                ) {

                    return undefined;
                }

                value =
                    value[property];
            }

            return value;
        }


        /*
         * ARRAY SIMPLE
         */

        if (
            expr.startsWith("[") &&
            expr.endsWith("]")
        ) {

            const content =
                expr.slice(1, -1);

            const args =
                this.parseArguments(
                    content
                );

            const result = [];

            for (
                const arg
                of args
            ) {

                result.push(
                    await this.evalExpression(
                        arg,
                        env
                    )
                );
            }

            return result;
        }


        /*
         * VARIABLE
         */

        if (
            Object.prototype.hasOwnProperty.call(
                env,
                expr
            )
        ) {

            return env[expr];
        }


        /*
         * MÉTODOS SENCILLOS
         */

        const method =
            expr.match(
                /^(.+)\.(trim|minusculas|mayusculas|longitud)\(\)$/
            );

        if (method) {

            const value =
                await this.evalExpression(
                    method[1],
                    env
                );

            switch (
                method[2]
            ) {

                case "trim":
                    return String(
                        value
                    ).trim();

                case "minusculas":
                    return String(
                        value
                    ).toLowerCase();

                case "mayusculas":
                    return String(
                        value
                    ).toUpperCase();

                case "longitud":
                    return value?.length || 0;
            }
        }


        /*
         * Si no reconocemos la expresión,
         * la devolvemos como texto.
         */

        return expr;
    }


    /*
     * Llamar función CodEsp.
     */

    async callFunction(
        name,
        args,
        parentEnv
    ) {

        const fn =
            this.functions[name];

        if (!fn) {

            throw new Error(
                `Función no definida: ${name}`
            );
        }

        const localEnv = {
            ...parentEnv
        };

        fn.params.forEach(
            (param, index) => {
                localEnv[param] =
                    args[index];
            }
        );

        try {

            await this.executeBlock(
                fn.body,
                localEnv
            );

        } catch (error) {

            if (
                error instanceof ReturnSignal
            ) {

                return error.value;
            }

            throw error;
        }

        return null;
    }


    /*
     * Cargar plugin.
     */

    async usePlugin(name) {

        const clean =
            String(name)
                .replace(/^["']|["']$/g, "")
                .replace(/\.codesp$/i, "");

        this.log(
            "info",
            `[PLUGIN] Cargando ${clean}`
        );

        const plugin =
            await this.pluginLoader(
                clean
            );

        if (!plugin) {

            this.log(
                "info",
                `[PLUGIN] No se encontró ${clean}`
            );

            return;
        }

        this.plugins[clean] =
            plugin;

        this.log(
            "ok",
            `[PLUGIN] ✓ ${clean} cargado`
        );
    }


    /*
     * Buscar operador respetando
     * cadenas y paréntesis.
     */

    findOperator(
        expression,
        operators
    ) {

        let depth = 0;
        let quote = null;

        for (
            let i = expression.length - 1;
            i >= 0;
            i--
        ) {

            const char =
                expression[i];

            if (
                char === '"' ||
                char === "'"
            ) {

                if (
                    expression[i - 1] !== "\\"
                ) {

                    quote =
                        quote === char
                            ? null
                            : quote || char;
                }

                continue;
            }

            if (quote) {
                continue;
            }

            if (char === ")") {
                depth++;
                continue;
            }

            if (char === "(") {
                depth--;
                continue;
            }

            if (depth !== 0) {
                continue;
            }

            for (
                const operator
                of operators
            ) {

                const start =
                    i -
                    operator.length +
                    1;

                if (
                    start < 0
                ) {
                    continue;
                }

                if (
                    expression.slice(
                        start,
                        i + 1
                    ) === operator
                ) {

                    return {
                        left:
                            expression.slice(
                                0,
                                start
                            ),

                        operator,

                        right:
                            expression.slice(
                                i + 1
                            )
                    };
                }
            }
        }

        return null;
    }


    /*
     * Separar operadores.
     */

    splitOperator(
        expression,
        operator
    ) {

        const result = [];

        let current = "";

        let depth = 0;

        let quote = null;

        for (
            let i = 0;
            i < expression.length;
            i++
        ) {

            const char =
                expression[i];

            if (
                char === '"' ||
                char === "'"
            ) {

                if (
                    expression[i - 1] !== "\\"
                ) {

                    quote =
                        quote === char
                            ? null
                            : quote || char;
                }
            }

            if (!quote) {

                if (char === "(") {
                    depth++;
                }

                if (char === ")") {
                    depth--;
                }

                if (
                    depth === 0 &&
                    char === operator
                ) {

                    result.push(
                        current.trim()
                    );

                    current = "";

                    continue;
                }
            }

            current += char;
        }

        result.push(
            current.trim()
        );

        return result;
    }


    /*
     * Argumentos de función.
     */

    parseArguments(text) {

        if (!text.trim()) {
            return [];
        }

        const result = [];

        let current = "";

        let depth = 0;

        let quote = null;

        for (
            let i = 0;
            i < text.length;
            i++
        ) {

            const char =
                text[i];

            if (
                char === '"' ||
                char === "'"
            ) {

                if (
                    text[i - 1] !== "\\"
                ) {

                    quote =
                        quote === char
                            ? null
                            : quote || char;
                }
            }

            if (!quote) {

                if (char === "(") {
                    depth++;
                }

                if (char === ")") {
                    depth--;
                }

                if (
                    char === "," &&
                    depth === 0
                ) {

                    result.push(
                        current.trim()
                    );

                    current = "";

                    continue;
                }
            }

            current += char;
        }

        if (current.trim()) {
            result.push(
                current.trim()
            );
        }

        return result;
    }


    /*
     * Conversión booleana.
     */

    truthy(value) {

        return Boolean(value);
    }


    /*
     * Mostrar valores en consola.
     */

    format(value) {

        if (
            typeof value === "string"
        ) {
            return value;
        }

        if (
            value === undefined
        ) {
            return "indefinido";
        }

        try {

            return JSON.stringify(
                value,
                null,
                2
            );

        } catch {

            return String(value);
        }
    }


    /*
     * Error estructurado.
     */

    errorObject(error) {

        return {
            mensaje:
                error?.message ||
                String(error),

            nombre:
                error?.name ||
                "Error"
        };
    }


    /*
     * Escape de cadenas.
     */

    unescapeString(value) {

        return value
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\");
    }
}


class ReturnSignal {

    constructor(value) {
        this.value = value;
    }
}
