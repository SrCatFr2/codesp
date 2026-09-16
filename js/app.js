// ============================================================
// CodEsp 0.2
// js/app.js
// Control principal de la aplicación
// ============================================================

import {
    tokenizar,
    tokensComoTexto
} from "./lexer.js";

import {
    analizar
} from "./parser.js";

import {
    Runtime
} from "./runtime.js";

import {
    convertirCurl
} from "./curl.js";

import {
    generarPython
} from "./python.js";

import {
    cargarProyecto,
    guardarProyecto,
    crearArchivo,
    eliminarArchivo,
    agregarArchivo,
    renombrarArchivo,
    ensureProject
} from "./proyecto.js";

import {
    renderPlugins,
    installPlugin,
    validatePlugin
} from "./plugins.js";


// ============================================================
// ESTADO GLOBAL
// ============================================================

const estado = {
    vista: "editor",

    proyecto: null,

    archivoActual: "principal.codesp",

    runtime: null,

    ejecutando: false,

    ultimoAST: null,

    ultimaRespuesta: null,

    ultimaRed: [],

    errores: [],

    panelInferior: "console",

    consola: []
};


// ============================================================
// REFERENCIAS DOM
// ============================================================

const workspace = document.getElementById("workspace");
const nav = document.getElementById("main-nav");
const runTop = document.getElementById("runTop");
const menuBtn = document.getElementById("menuBtn");

const filePicker = document.getElementById("filePicker");
const projectPicker = document.getElementById("projectPicker");


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {

    estado.proyecto = ensureProject();

    conectarNavegacion();

    conectarMenuMovil();

    conectarSelectoresDeArchivo();

    await cargarVista("editor");

    window.CodEsp = {
        estado,
        ejecutar,
        cargarVista,
        abrirArchivo,
        guardarArchivo,
        nuevoArchivo
    };
}


// ============================================================
// NAVEGACIÓN SPA
// ============================================================

function conectarNavegacion() {

    nav?.addEventListener("click", async event => {

        const boton = event.target.closest("[data-view]");

        if (!boton) return;

        const vista = boton.dataset.view;

        await cargarVista(vista);

        nav.classList.remove("mobile-open");
    });
}


async function cargarVista(vista) {

    const permitidas = [
        "editor",
        "plugins",
        "archivos",
        "ayuda"
    ];

    if (!permitidas.includes(vista)) {
        vista = "editor";
    }

    estado.vista = vista;

    const respuesta = await fetch(`views/${vista}.html`, {
        cache: "no-store"
    });

    if (!respuesta.ok) {
        workspace.innerHTML = `
            <section class="view generic-view">
                <div class="panel">
                    <div class="panel-title">ERROR</div>
                    <p>No se pudo cargar la vista.</p>
                </div>
            </section>
        `;

        return;
    }

    workspace.innerHTML = await respuesta.text();

    actualizarNavegacion();

    if (vista === "editor") {
        iniciarEditor();
    }

    if (vista === "plugins") {
        iniciarPlugins();
    }

    if (vista === "archivos") {
        iniciarArchivos();
    }
}


// ============================================================
// NAVEGACIÓN VISUAL
// ============================================================

function actualizarNavegacion() {

    nav?.querySelectorAll("[data-view]").forEach(boton => {

        boton.classList.toggle(
            "active",
            boton.dataset.view === estado.vista
        );

    });
}


// ============================================================
// MENÚ MÓVIL
// ============================================================

function conectarMenuMovil() {

    menuBtn?.addEventListener("click", () => {

        nav.classList.toggle("mobile-open");

    });
}


// ============================================================
// EDITOR
// ============================================================

function iniciarEditor() {

    const code = document.getElementById("code");

    if (!code) return;

    const archivo = estado.proyecto.archivos.find(
        archivo => archivo.nombre === estado.archivoActual
    );

    if (archivo) {
        code.value = archivo.contenido;
    }

    conectarEditor();

    renderFileTree();

    actualizarEditorVisual();

    conectarBotonesEditor();

    renderPanelInferior();

    actualizarInspector();
}


// ============================================================
// EVENTOS DEL EDITOR
// ============================================================

function conectarEditor() {

    const code = document.getElementById("code");

    if (!code) return;

    code.addEventListener("input", () => {

        guardarContenidoActual();

        actualizarEditorVisual();

    });

    code.addEventListener("scroll", sincronizarScroll);

    code.addEventListener("keyup", actualizarCursor);

    code.addEventListener("click", actualizarCursor);

    code.addEventListener("select", actualizarCursor);

    code.addEventListener("keydown", event => {

        // TAB = 4 espacios
        if (event.key === "Tab") {

            event.preventDefault();

            const inicio = code.selectionStart;
            const fin = code.selectionEnd;

            const antes = code.value.substring(0, inicio);
            const despues = code.value.substring(fin);

            code.value =
                antes +
                "    " +
                despues;

            code.selectionStart =
                code.selectionEnd =
                inicio + 4;

            guardarContenidoActual();
            actualizarEditorVisual();
        }

        // Ctrl/Cmd + S
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s"
        ) {

            event.preventDefault();

            guardarArchivo();
        }

        // Ctrl/Cmd + Enter
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
        ) {

            event.preventDefault();

            ejecutar();
        }
    });
}


// ============================================================
// BOTONES EDITOR
// ============================================================

function conectarBotonesEditor() {

    document
        .getElementById("newFile")
        ?.addEventListener("click", nuevoArchivo);

    document
        .getElementById("openFile")
        ?.addEventListener("click", () => filePicker?.click());

    document
        .getElementById("saveFile")
        ?.addEventListener("click", guardarArchivo);

    document
        .getElementById("runCode")
        ?.addEventListener("click", ejecutar);

    document
        .getElementById("stopCode")
        ?.addEventListener("click", detener);

    document
        .getElementById("importCurl")
        ?.addEventListener("click", importarCurl);

    document
        .getElementById("exportPython")
        ?.addEventListener("click", exportarPython);

    document
        .getElementById("newPlugin")
        ?.addEventListener("click", crearPlugin);

    document
        .querySelectorAll(".bottom-tabs button")
        .forEach(boton => {

            boton.addEventListener("click", () => {

                estado.panelInferior =
                    boton.dataset.panel;

                document
                    .querySelectorAll(".bottom-tabs button")
                    .forEach(b => b.classList.remove("active"));

                boton.classList.add("active");

                renderPanelInferior();
            });

        });
}


// ============================================================
// ARCHIVO ACTUAL
// ============================================================

function guardarContenidoActual() {

    const editor = document.getElementById("code");

    if (!editor || !estado.proyecto) return;

    const archivo = estado.proyecto.archivos.find(
        archivo => archivo.nombre === estado.archivoActual
    );

    if (!archivo) return;

    archivo.contenido = editor.value;

    guardarProyecto(estado.proyecto);
}


// ============================================================
// ÁRBOL DE ARCHIVOS
// ============================================================

function renderFileTree() {

    const tree = document.getElementById("fileTree");

    if (!tree) return;

    tree.innerHTML = "";

    estado.proyecto.archivos.forEach(archivo => {

        const fila = document.createElement("button");

        fila.className = "file-row";

        if (archivo.nombre === estado.archivoActual) {
            fila.classList.add("active");
        }

        fila.innerHTML = `
            <span>▤</span>
            <span>${escaparHTML(archivo.nombre)}</span>
        `;

        fila.addEventListener("click", () => {

            abrirArchivo(archivo.nombre);

        });

        tree.appendChild(fila);
    });
}


// ============================================================
// ABRIR ARCHIVO
// ============================================================

function abrirArchivo(nombre) {

    guardarContenidoActual();

    const archivo = estado.proyecto.archivos.find(
        archivo => archivo.nombre === nombre
    );

    if (!archivo) return;

    estado.archivoActual = nombre;

    if (estado.vista !== "editor") {

        cargarVista("editor").then(() => {

            const editor =
                document.getElementById("code");

            if (editor) {
                editor.value = archivo.contenido;
                actualizarEditorVisual();
            }

        });

        return;
    }

    const editor =
        document.getElementById("code");

    if (editor) {

        editor.value = archivo.contenido;

        document.getElementById("currentTab").textContent =
            archivo.nombre;

        actualizarEditorVisual();

        renderFileTree();
    }
}


// ============================================================
// NUEVO ARCHIVO
// ============================================================

function nuevoArchivo() {

    const nombre = prompt(
        "Nombre del archivo:",
        "nuevo.codesp"
    );

    if (!nombre) return;

    if (!nombre.endsWith(".codesp")) {

        alert("Los archivos CodEsp deben terminar en .codesp.");

        return;
    }

    if (
        estado.proyecto.archivos.some(
            archivo => archivo.nombre === nombre
        )
    ) {

        alert("Ese archivo ya existe.");

        return;
    }

    agregarArchivo(
        estado.proyecto,
        crearArchivo(nombre)
    );

    guardarProyecto(estado.proyecto);

    estado.archivoActual = nombre;

    abrirArchivo(nombre);
}


// ============================================================
// GUARDAR
// ============================================================

function guardarArchivo() {

    guardarContenidoActual();

    guardarProyecto(estado.proyecto);

    mostrarConsola(
        `Archivo guardado: ${estado.archivoActual}`,
        "info"
    );

    const estadoUI =
        document.getElementById("compileState");

    if (estadoUI) {
        estadoUI.textContent = "GUARDADO";
    }
}


// ============================================================
// ARCHIVOS EXTERNOS
// ============================================================

function conectarSelectoresDeArchivo() {

    filePicker?.addEventListener("change", async event => {

        const archivo = event.target.files?.[0];

        if (!archivo) return;

        const contenido = await archivo.text();

        const nombre =
            archivo.name.endsWith(".codesp")
                ? archivo.name
                : `${archivo.name}.codesp`;

        const existente =
            estado.proyecto.archivos.find(
                a => a.nombre === nombre
            );

        if (existente) {

            existente.contenido = contenido;

        } else {

            agregarArchivo(
                estado.proyecto,
                crearArchivo(nombre, contenido)
            );
        }

        guardarProyecto(estado.proyecto);

        estado.archivoActual = nombre;

        await cargarVista("editor");

        filePicker.value = "";
    });


    projectPicker?.addEventListener("change", async event => {

        const archivos = [...event.target.files];

        for (const archivo of archivos) {

            if (!archivo.name.endsWith(".codesp")) {
                continue;
            }

            const contenido = await archivo.text();

            const existente =
                estado.proyecto.archivos.find(
                    a => a.nombre === archivo.name
                );

            if (existente) {

                existente.contenido = contenido;

            } else {

                agregarArchivo(
                    estado.proyecto,
                    crearArchivo(
                        archivo.name,
                        contenido
                    )
                );
            }
        }

        guardarProyecto(estado.proyecto);

        await cargarVista("editor");

        projectPicker.value = "";
    });
}


// ============================================================
// NUEVO PLUGIN
// ============================================================

function crearPlugin() {

    const nombre = prompt(
        "Nombre del plugin:",
        "mi-plugin"
    );

    if (!nombre) return;

    const limpio = nombre
        .replace(/\.codesp$/i, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-");

    const archivo =
        `plugins/${limpio}.codesp`;

    if (
        estado.proyecto.archivos.some(
            a => a.nombre === archivo
        )
    ) {

        alert("Ese plugin ya existe.");

        return;
    }

    const contenido = `plugin "${limpio}":

    definir version = "1.0.0"

    funcion saludo(nombre):
        devolver "Hola " + nombre
`;

    agregarArchivo(
        estado.proyecto,
        crearArchivo(archivo, contenido)
    );

    guardarProyecto(estado.proyecto);

    estado.archivoActual = archivo;

    abrirArchivo(archivo);
}


// ============================================================
// EJECUCIÓN
// ============================================================

async function ejecutar() {

    const editor = document.getElementById("code");

    if (!editor) return;

    guardarContenidoActual();

    limpiarErrores();

    estado.ejecutando = true;

    actualizarEstadoCompilacion("ANALIZANDO");

    limpiarConsola();

    mostrarConsola(
        `Ejecutando ${estado.archivoActual}`,
        "info"
    );

    try {

        const codigo = editor.value;

        // ------------------------------------------
        // LEXER
        // ------------------------------------------

        const tokens = tokenizar(codigo);

        document.getElementById("tokenState").textContent =
            `${tokens.length} tokens`;

        // ------------------------------------------
        // PARSER
        // ------------------------------------------

        actualizarEstadoCompilacion("ANALIZANDO");

        const ast = analizar(tokens);

        estado.ultimoAST = ast;

        mostrarAST(ast);

        // ------------------------------------------
        // RUNTIME
        // ------------------------------------------

        actualizarEstadoCompilacion("EJECUTANDO");

        estado.runtime = new Runtime({

            onLog: (mensaje, tipo = "log") => {

                mostrarConsola(
                    mensaje,
                    tipo
                );
            },

            onNetwork: registro => {

                estado.ultimaRed.unshift(registro);

                if (estado.ultimaRed.length > 100) {
                    estado.ultimaRed.pop();
                }

                estado.ultimaRespuesta =
                    registro;

                actualizarInspector();

                if (
                    estado.panelInferior === "network"
                ) {
                    renderPanelInferior();
                }
            },

            onVariables: variables => {

                renderVariables(variables);

            }
        });

        // ------------------------------------------
        // CARGAR PLUGINS
        // ------------------------------------------

        await cargarPluginsEnRuntime(
            estado.runtime
        );

        // ------------------------------------------
        // RUN
        // ------------------------------------------

        await estado.runtime.run(ast);

        estado.ejecutando = false;

        actualizarEstadoCompilacion("LISTO");

        mostrarConsola(
            "Ejecución finalizada.",
            "success"
        );

        actualizarInspector();

    } catch (error) {

        estado.ejecutando = false;

        estado.errores.push({
            mensaje: error.message,
            pila: error.stack
        });

        actualizarEstadoCompilacion("ERROR");

        mostrarConsola(
            `ERROR: ${error.message}`,
            "error"
        );

        renderPanelInferior();
    }
}


// ============================================================
// DETENER
// ============================================================

function detener() {

    if (estado.runtime) {

        estado.runtime.stop?.();

    }

    estado.ejecutando = false;

    actualizarEstadoCompilacion("DETENIDO");

    mostrarConsola(
        "Ejecución detenida.",
        "warning"
    );
}


// ============================================================
// ESTADO DEL COMPILADOR
// ============================================================

function actualizarEstadoCompilacion(texto) {

    const elemento =
        document.getElementById("compileState");

    if (elemento) {
        elemento.textContent = texto;
    }
}


// ============================================================
// CONSOLA
// ============================================================

function mostrarConsola(mensaje, tipo = "log") {

    const texto =
        typeof mensaje === "object"
            ? JSON.stringify(mensaje, null, 2)
            : String(mensaje);

    estado.consola.push({
        texto,
        tipo,
        fecha: new Date()
    });

    if (estado.consola.length > 500) {
        estado.consola.shift();
    }

    if (estado.panelInferior === "console") {
        renderPanelInferior();
    }
}


function limpiarConsola() {

    estado.consola = [];

    renderPanelInferior();
}


// ============================================================
// PANELES INFERIORES
// ============================================================

function renderPanelInferior() {

    const contenedor =
        document.getElementById("bottomContent");

    if (!contenedor) return;

    if (estado.panelInferior === "console") {

        contenedor.innerHTML =
            renderConsolaHTML();

        return;
    }

    if (estado.panelInferior === "network") {

        contenedor.innerHTML =
            renderRedHTML();

        return;
    }

    if (estado.panelInferior === "errors") {

        contenedor.innerHTML =
            renderErroresHTML();

        return;
    }
}


function renderConsolaHTML() {

    if (!estado.consola.length) {

        return `
            <div class="empty-state">
                Consola vacía.
            </div>
        `;
    }

    return estado.consola
        .map(item => `
            <div class="console-line ${escaparHTML(item.tipo)}">
                <span class="console-prefix">
                    ${iconoConsola(item.tipo)}
                </span>
                <pre>${escaparHTML(item.texto)}</pre>
            </div>
        `)
        .join("");
}


function iconoConsola(tipo) {

    const iconos = {
        log: "›",
        info: "i",
        success: "✓",
        warning: "!",
        error: "×"
    };

    return iconos[tipo] || "›";
}


function renderRedHTML() {

    if (!estado.ultimaRed.length) {

        return `
            <div class="empty-state">
                No hay solicitudes HTTP.
            </div>
        `;
    }

    return estado.ultimaRed
        .map(red => {

            const estadoHTTP =
                red.estado ?? "—";

            return `
                <div class="network-row">

                    <strong>
                        ${escaparHTML(
                            red.metodo || "HTTP"
                        )}
                    </strong>

                    <span>
                        ${escaparHTML(
                            red.url || ""
                        )}
                    </span>

                    <span>
                        ${estadoHTTP}
                    </span>

                    <span>
                        ${red.duracion ?? "—"} ms
                    </span>

                </div>
            `;
        })
        .join("");
}


function renderErroresHTML() {

    if (!estado.errores.length) {

        return `
            <div class="empty-state">
                No hay errores.
            </div>
        `;
    }

    return estado.errores
        .map(error => `
            <div class="error-entry">

                <strong>
                    ${escaparHTML(error.mensaje)}
                </strong>

                ${
                    error.pila
                        ? `<pre>${escaparHTML(error.pila)}</pre>`
                        : ""
                }

            </div>
        `)
        .join("");
}


// ============================================================
// VARIABLES
// ============================================================

function renderVariables(variables) {

    const contenedor =
        document.getElementById("variables");

    if (!contenedor) return;

    if (!variables || !Object.keys(variables).length) {

        contenedor.textContent =
            "Sin variables.";

        return;
    }

    contenedor.innerHTML =
        Object.entries(variables)
            .map(([nombre, valor]) => {

                let texto;

                try {

                    texto =
                        typeof valor === "object"
                            ? JSON.stringify(
                                valor,
                                null,
                                2
                            )
                            : String(valor);

                } catch {

                    texto = "[objeto]";
                }

                return `
                    <div class="variable-row">
                        <b>${escaparHTML(nombre)}</b>
                        <pre>${escaparHTML(texto)}</pre>
                    </div>
                `;
            })
            .join("");
}


// ============================================================
// INSPECTOR
// ============================================================

function actualizarInspector() {

    if (!estado.runtime) return;

    renderVariables(
        estado.runtime.env
    );

    const solicitud =
        document.getElementById("requestInfo");

    if (solicitud) {

        if (!estado.ultimaRespuesta) {

            solicitud.textContent =
                "Sin solicitud.";

        } else {

            const red =
                estado.ultimaRespuesta;

            solicitud.innerHTML = `
                <div>Método: <b>${escaparHTML(
                    red.metodo || "—"
                )}</b></div>

                <div>Estado: <b>${red.estado ?? "—"}</b></div>

                <div>Duración: <b>${
                    red.duracion ?? "—"
                } ms</b></div>

                <div class="inspect-url">
                    ${escaparHTML(red.url || "")}
                </div>
            `;
        }
    }
}


// ============================================================
// AST
// ============================================================

function mostrarAST(ast) {

    const contenedor =
        document.getElementById("astInfo");

    if (!contenedor) return;

    try {

        contenedor.textContent =
            JSON.stringify(ast, null, 2);

    } catch {

        contenedor.textContent =
            "No se pudo representar el AST.";
    }
}


// ============================================================
// SINTAXIS / HIGHLIGHT
// ============================================================

function actualizarEditorVisual() {

    const editor =
        document.getElementById("code");

    const highlight =
        document.getElementById("highlight");

    const gutter =
        document.getElementById("gutter");

    if (!editor) return;

    actualizarCursor();

    if (highlight) {

        highlight.innerHTML =
            resaltarCodigo(editor.value);

    }

    if (gutter) {

        const cantidad =
            Math.max(
                editor.value.split("\n").length,
                1
            );

        gutter.innerHTML =
            Array.from(
                { length: cantidad },
                (_, i) => `<span>${i + 1}</span>`
            ).join("");
    }

    const tab =
        document.getElementById("currentTab");

    if (tab) {
        tab.textContent =
            estado.archivoActual;
    }
}


function sincronizarScroll() {

    const editor =
        document.getElementById("code");

    const highlight =
        document.getElementById("highlight");

    const gutter =
        document.getElementById("gutter");

    if (!editor) return;

    if (highlight) {

        highlight.scrollTop =
            editor.scrollTop;

        highlight.scrollLeft =
            editor.scrollLeft;
    }

    if (gutter) {

        gutter.scrollTop =
            editor.scrollTop;
    }
}


function resaltarCodigo(codigo) {

    const tokens = tokenizar(codigo);

    let salida = "";

    for (const token of tokens) {

        const valor =
            escaparHTML(token.value);

        let clase = "tok";

        switch (token.type) {

            case "keyword":
                clase += " keyword";
                break;

            case "http":
                clase += " http";
                break;

            case "string":
                clase += " string";
                break;

            case "number":
                clase += " number";
                break;

            case "operator":
                clase += " operator";
                break;

            case "comment":
                clase += " comment";
                break;

            case "identifier":
                clase += " identifier";
                break;

            default:
                break;
        }

        salida +=
            `<span class="${clase}">${valor}</span>`;
    }

    return salida;
}


// ============================================================
// CURSOR
// ============================================================

function actualizarCursor() {

    const editor =
        document.getElementById("code");

    const indicador =
        document.getElementById("cursorPos");

    if (!editor || !indicador) return;

    const posicion =
        editor.selectionStart || 0;

    const antes =
        editor.value.substring(
            0,
            posicion
        );

    const lineas =
        antes.split("\n");

    const linea =
        lineas.length;

    const columna =
        lineas[lineas.length - 1].length + 1;

    indicador.textContent =
        `Ln ${linea} : Col ${columna}`;
}


// ============================================================
// IMPORTAR CURL
// ============================================================

function importarCurl() {

    const curl = prompt(
        "Pega aquí el comando cURL:"
    );

    if (!curl) return;

    try {

        const resultado =
            convertirCurl(curl);

        const editor =
            document.getElementById("code");

        if (!editor) return;

        editor.value =
            resultado;

        guardarContenidoActual();

        actualizarEditorVisual();

        mostrarConsola(
            "cURL convertido correctamente.",
            "success"
        );

    } catch (error) {

        mostrarConsola(
            `No se pudo convertir cURL: ${error.message}`,
            "error"
        );
    }
}


// ============================================================
// EXPORTAR PYTHON
// ============================================================

function exportarPython() {

    const editor =
        document.getElementById("code");

    if (!editor) return;

    try {

        const tokens =
            tokenizar(editor.value);

        const ast =
            analizar(tokens);

        const python =
            generarPython(ast);

        descargarTexto(
            `${estado.archivoActual.replace(
                /\.codesp$/i,
                ""
            )}.py`,
            python
        );

        mostrarConsola(
            "Python generado correctamente.",
            "success"
        );

    } catch (error) {

        mostrarConsola(
            `Error al generar Python: ${error.message}`,
            "error"
        );
    }
}


// ============================================================
// PLUGINS
// ============================================================

function iniciarPlugins() {

    renderPlugins(
        estado.proyecto,
        {
            onSelect: plugin => {

                mostrarDetallePlugin(plugin);

            },

            onInstall: archivo => {

                abrirArchivo(archivo.nombre);

            }
        }
    );

    document
        .getElementById("installPlugin")
        ?.addEventListener(
            "click",
            instalarPluginExterno
        );
}


function mostrarDetallePlugin(plugin) {

    const detalle =
        document.getElementById("pluginDetail");

    if (!detalle) return;

    detalle.innerHTML = `
        <h2>${escaparHTML(
            plugin.nombre
        )}</h2>

        <p>
            Archivo:
            <code>${escaparHTML(
                plugin.archivo
            )}</code>
        </p>

        <pre>${escaparHTML(
            plugin.contenido
        )}</pre>
    `;
}


async function instalarPluginExterno() {

    const input =
        document.createElement("input");

    input.type = "file";
    input.accept = ".codesp,text/plain";

    input.onchange = async () => {

        const archivo =
            input.files?.[0];

        if (!archivo) return;

        const contenido =
            await archivo.text();

        const validacion =
            validatePlugin(contenido);

        if (!validacion.valido) {

            alert(
                "Plugin inválido:\n\n" +
                validacion.errores.join("\n")
            );

            return;
        }

        const nombre =
            archivo.name.endsWith(".codesp")
                ? archivo.name
                : `${archivo.name}.codesp`;

        const ruta =
            `plugins/${nombre}`;

        agregarArchivo(
            estado.proyecto,
            crearArchivo(
                ruta,
                contenido
            )
        );

        guardarProyecto(
            estado.proyecto
        );

        await cargarVista("plugins");
    };

    input.click();
}


// ============================================================
// CARGAR PLUGINS EN RUNTIME
// ============================================================

async function cargarPluginsEnRuntime(runtime) {

    const plugins =
        estado.proyecto.archivos.filter(
            archivo =>
                archivo.nombre.startsWith("plugins/") &&
                archivo.nombre.endsWith(".codesp")
        );

    for (const plugin of plugins) {

        try {

            const tokens =
                tokenizar(plugin.contenido);

            const ast =
                analizar(tokens);

            await runtime.cargarPluginAST?.(
                ast,
                plugin.nombre
            );

        } catch (error) {

            mostrarConsola(
                `Plugin ${plugin.nombre}: ${error.message}`,
                "warning"
            );
        }
    }
}


// ============================================================
// ARCHIVOS
// ============================================================

function iniciarArchivos() {

    const contenedor =
        document.getElementById("allFiles");

    if (contenedor) {

        contenedor.innerHTML =
            estado.proyecto.archivos
                .map(archivo => `

                    <div class="file-row">

                        <span>▤</span>

                        <span class="file-name">
                            ${escaparHTML(
                                archivo.nombre
                            )}
                        </span>

                        <button
                            data-open-file="${escaparHTML(
                                archivo.nombre
                            )}"
                        >
                            Abrir
                        </button>

                    </div>

                `)
                .join("");

        contenedor
            .querySelectorAll(
                "[data-open-file]"
            )
            .forEach(boton => {

                boton.addEventListener(
                    "click",
                    () => {

                        abrirArchivo(
                            boton.dataset.openFile
                        );

                    }
                );
            });
    }


    document
        .getElementById("newFilePage")
        ?.addEventListener(
            "click",
            nuevoArchivo
        );

    document
        .getElementById("openFilePage")
        ?.addEventListener(
            "click",
            () => filePicker?.click()
        );
}


// ============================================================
// DESCARGA
// ============================================================

function descargarTexto(nombre, contenido) {

    const blob =
        new Blob(
            [contenido],
            {
                type: "text/plain;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const enlace =
        document.createElement("a");

    enlace.href = url;

    enlace.download = nombre;

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    URL.revokeObjectURL(url);
}


// ============================================================
// UTILIDADES
// ============================================================

function limpiarErrores() {

    estado.errores = [];

    renderPanelInferior();
}


function escaparHTML(valor) {

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// EXPORTS / COMPATIBILIDAD
// ============================================================

window.CodEspApp = {
    ejecutar,
    detener,
    cargarVista,
    abrirArchivo,
    nuevoArchivo,
    guardarArchivo,
    importarCurl,
    exportarPython
};
