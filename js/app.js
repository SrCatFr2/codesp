// ============================================================
// CodEsp
// js/app.js
// Control principal de la aplicación
// ============================================================

import { tokenizar } from "./lexer.js";
import { parse } from "./parser.js";
import { Runtime } from "./runtime.js";

import {
    loadProject,
    saveProject,
    addFile,
    removeFile,
    renameFile
} from "./proyecto.js";

import { convertirCurl } from "./curl.js";
import { generarPython } from "./python.js";


// ============================================================
// ESTADO
// ============================================================

const state = {

    view: "editor",

    project: null,

    currentFile: "principal.codesp",

    runtime: null,

    running: false,

    ast: null,

    console: [],

    errors: [],

    network: [],

    activePanel: "console",

    lastResponse: null
};


// ============================================================
// DOM PRINCIPAL
// ============================================================

const workspace =
    document.getElementById("workspace");

const nav =
    document.getElementById("main-nav");

const runTop =
    document.getElementById("runTop");

const menuBtn =
    document.getElementById("menuBtn");

const filePicker =
    document.getElementById("filePicker");

const projectPicker =
    document.getElementById("projectPicker");


// ============================================================
// INICIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    try {

        // ------------------------------------------
        // CARGAR PROYECTO
        // ------------------------------------------

        state.project = loadProject();

        // Protección contra proyecto inválido
        if (
            !state.project ||
            typeof state.project !== "object"
        ) {
            state.project = crearProyectoSeguro();
        }

        // Protección contra files inexistente
        if (
            !state.project.files ||
            typeof state.project.files !== "object" ||
            Array.isArray(state.project.files)
        ) {
            state.project.files = {
                "principal.codesp": ""
            };
        }

        // Si no hay ningún archivo
        if (
            Object.keys(state.project.files).length === 0
        ) {
            state.project.files = {
                "principal.codesp": ""
            };
        }

        // ------------------------------------------
        // ARCHIVO ACTIVO
        // ------------------------------------------

        const files =
            obtenerArchivos();

        if (
            !state.project.active ||
            !Object.prototype.hasOwnProperty.call(
                state.project.files,
                state.project.active
            )
        ) {
            state.project.active =
                files[0] ||
                "principal.codesp";
        }

        state.currentFile =
            state.project.active;

        saveProject(state.project);

        // ------------------------------------------
        // CONFIGURAR UI
        // ------------------------------------------

        setupNavigation();

        setupMobileMenu();

        setupTopRunButton();

        setupFilePickers();

        // ------------------------------------------
        // CARGAR EDITOR
        // ------------------------------------------

        await loadView("editor");

    } catch (error) {

        console.error(
            "CodEsp: error durante el inicio:",
            error
        );

        if (workspace) {

            workspace.innerHTML = `
                <section class="view generic-view">

                    <div class="panel">

                        <div class="panel-title">
                            ERROR DE INICIO
                        </div>

                        <p>
                            CodEsp no pudo iniciar correctamente.
                        </p>

                        <pre>${escapeHTML(
                            error?.stack ||
                            error?.message ||
                            String(error)
                        )}</pre>

                    </div>

                </section>
            `;
        }
    }
}


// ============================================================
// PROYECTO SEGURO
// ============================================================

function crearProyectoSeguro() {

    return {

        name: "MiProyecto",

        version: "0.3.0",

        active: "principal.codesp",

        files: {

            "principal.codesp":
`# CodEsp

mostrar "Hola desde CodEsp"
`
        }
    };
}


// ============================================================
// OBTENER ARCHIVOS
// ============================================================

function obtenerArchivos() {

    if (
        !state.project ||
        !state.project.files ||
        typeof state.project.files !== "object" ||
        Array.isArray(state.project.files)
    ) {
        return [];
    }

    return Object.keys(
        state.project.files
    );
}


// ============================================================
// NAVEGACIÓN
// ============================================================

function setupNavigation() {

    if (!nav) return;

    nav.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-view]"
                );

            if (!button) return;

            await loadView(
                button.dataset.view
            );

            nav.classList.remove(
                "mobile-open"
            );
        }
    );
}


async function loadView(view) {

    const allowed = [
        "editor",
        "plugins",
        "archivos",
        "ayuda"
    ];

    if (!allowed.includes(view)) {
        view = "editor";
    }

    state.view = view;

    try {

        const response =
            await fetch(
                `views/${view}.html?v=0.3.2`,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        workspace.innerHTML =
            await response.text();

    } catch (error) {

        workspace.innerHTML = `
            <section class="view generic-view">

                <div class="panel">

                    <div class="panel-title">
                        ERROR DE VISTA
                    </div>

                    <p>
                        No se pudo cargar
                        <b>${escapeHTML(view)}.html</b>
                    </p>

                    <pre>${escapeHTML(
                        error.message
                    )}</pre>

                </div>

            </section>
        `;

        console.error(error);

        return;
    }

    updateNavigation();

    if (view === "editor") {
        initEditor();
    }

    if (view === "plugins") {
        initPlugins();
    }

    if (view === "archivos") {
        initFiles();
    }
}


// ============================================================
// NAVEGACIÓN VISUAL
// ============================================================

function updateNavigation() {

    if (!nav) return;

    nav.querySelectorAll(
        "[data-view]"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.view ===
            state.view
        );

    });
}


// ============================================================
// MENÚ MÓVIL
// ============================================================

function setupMobileMenu() {

    if (!menuBtn || !nav) return;

    menuBtn.addEventListener(
        "click",
        () => {

            nav.classList.toggle(
                "mobile-open"
            );

        }
    );
}


// ============================================================
// BOTÓN EJECUTAR SUPERIOR
// ============================================================

function setupTopRunButton() {

    if (!runTop) return;

    runTop.addEventListener(
        "click",
        async () => {

            // Si estamos fuera del editor,
            // primero regresamos al editor.

            if (state.view !== "editor") {

                await loadView("editor");
            }

            runCode();
        }
    );
}


// ============================================================
// EDITOR
// ============================================================

function initEditor() {

    const editor =
        document.getElementById("code");

    if (!editor) return;

    // Protección adicional
    if (
        !state.project ||
        !state.project.files
    ) {
        state.project =
            crearProyectoSeguro();
    }

    const content =
        state.project.files[
            state.currentFile
        ];

    editor.value =
        content ?? "";

    const currentTab =
        document.getElementById(
            "currentTab"
        );

    if (currentTab) {

        currentTab.textContent =
            state.currentFile;
    }

    setupEditorEvents();

    setupEditorButtons();

    renderFileTree();

    updateEditor();

    renderBottomPanel();

    updateInspector();
}


// ============================================================
// EVENTOS DEL EDITOR
// ============================================================

function setupEditorEvents() {

    const editor =
        document.getElementById("code");

    if (!editor) return;

    editor.addEventListener(
        "input",
        () => {

            saveCurrentFile();

            updateEditor();

        }
    );

    editor.addEventListener(
        "scroll",
        syncScroll
    );

    editor.addEventListener(
        "keyup",
        updateCursor
    );

    editor.addEventListener(
        "click",
        updateCursor
    );

    editor.addEventListener(
        "keydown",
        event => {

            // TAB
            if (event.key === "Tab") {

                event.preventDefault();

                const start =
                    editor.selectionStart;

                const end =
                    editor.selectionEnd;

                editor.value =
                    editor.value.slice(
                        0,
                        start
                    ) +
                    "    " +
                    editor.value.slice(
                        end
                    );

                editor.selectionStart =
                    editor.selectionEnd =
                    start + 4;

                saveCurrentFile();

                updateEditor();
            }

            // CTRL + S
            if (
                (event.ctrlKey ||
                 event.metaKey) &&
                event.key.toLowerCase() === "s"
            ) {

                event.preventDefault();

                saveCurrentFile();

                showConsole(
                    "Archivo guardado.",
                    "success"
                );
            }

            // CTRL + ENTER
            if (
                (event.ctrlKey ||
                 event.metaKey) &&
                event.key === "Enter"
            ) {

                event.preventDefault();

                runCode();
            }
        }
    );
}


// ============================================================
// BOTONES DEL EDITOR
// ============================================================

function setupEditorButtons() {

    bind(
        "newFile",
        "click",
        createNewFile
    );

    bind(
        "openFile",
        "click",
        () => filePicker?.click()
    );

    bind(
        "saveFile",
        "click",
        saveCurrentFile
    );

    bind(
        "runCode",
        "click",
        runCode
    );

    bind(
        "stopCode",
        "click",
        stopCode
    );

    bind(
        "importCurl",
        "click",
        importCurl
    );

    bind(
        "exportPython",
        "click",
        exportPython
    );

    bind(
        "newPlugin",
        "click",
        createPlugin
    );

    document
        .querySelectorAll(
            ".bottom-tabs button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    state.activePanel =
                        button.dataset.panel;

                    document
                        .querySelectorAll(
                            ".bottom-tabs button"
                        )
                        .forEach(
                            b =>
                                b.classList.remove(
                                    "active"
                                )
                        );

                    button.classList.add(
                        "active"
                    );

                    renderBottomPanel();
                }
            );
        });
}


// ============================================================
// BIND
// ============================================================

function bind(
    id,
    event,
    callback
) {

    const element =
        document.getElementById(id);

    if (!element) return;

    element.addEventListener(
        event,
        callback
    );
}


// ============================================================
// ARCHIVO ACTUAL
// ============================================================

function saveCurrentFile() {

    const editor =
        document.getElementById("code");

    if (!editor) return;

    if (
        !state.project ||
        typeof state.project !== "object"
    ) {
        state.project =
            crearProyectoSeguro();
    }

    if (
        !state.project.files ||
        typeof state.project.files !== "object"
    ) {
        state.project.files = {};
    }

    state.project.files[
        state.currentFile
    ] = editor.value;

    state.project.active =
        state.currentFile;

    saveProject(
        state.project
    );
}


// ============================================================
// ÁRBOL DE ARCHIVOS
// ============================================================

function renderFileTree() {

    const tree =
        document.getElementById(
            "fileTree"
        );

    if (!tree) return;

    tree.innerHTML = "";

    const files =
        obtenerArchivos();

    files.forEach(name => {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "file-row";

        if (
            name ===
            state.currentFile
        ) {

            button.classList.add(
                "active"
            );
        }

        button.innerHTML = `
            <span>▤</span>

            <span>
                ${escapeHTML(name)}
            </span>
        `;

        button.addEventListener(
            "click",
            () => openFile(name)
        );

        tree.appendChild(button);
    });
}


// ============================================================
// ABRIR ARCHIVO
// ============================================================

async function openFile(name) {

    saveCurrentFile();

    if (
        !state.project ||
        !state.project.files
    ) {
        return;
    }

    if (
        !Object.prototype.hasOwnProperty.call(
            state.project.files,
            name
        )
    ) {
        return;
    }

    state.currentFile =
        name;

    state.project.active =
        name;

    saveProject(
        state.project
    );

    if (state.view !== "editor") {

        await loadView("editor");

        return;
    }

    const editor =
        document.getElementById("code");

    if (!editor) return;

    editor.value =
        state.project.files[name] || "";

    const tab =
        document.getElementById(
            "currentTab"
        );

    if (tab) {
        tab.textContent = name;
    }

    renderFileTree();

    updateEditor();

    updateInspector();
}


// ============================================================
// NUEVO ARCHIVO
// ============================================================

function createNewFile() {

    let name =
        prompt(
            "Nombre del archivo:",
            "nuevo.codesp"
        );

    if (!name) return;

    name = name.trim();

    if (
        !name.toLowerCase()
            .endsWith(".codesp")
    ) {
        name += ".codesp";
    }

    if (
        state.project.files[name]
    ) {

        alert(
            "Ese archivo ya existe."
        );

        return;
    }

    addFile(
        state.project,
        name,
        ""
    );

    state.currentFile =
        name;

    state.project.active =
        name;

    saveProject(
        state.project
    );

    openFile(name);
}


// ============================================================
// CREAR PLUGIN
// ============================================================

function createPlugin() {

    let name =
        prompt(
            "Nombre del plugin:",
            "mi-plugin"
        );

    if (!name) return;

    name =
        name
            .trim()
            .replace(
                /\.codesp$/i,
                ""
            )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            );

    const file =
        `plugins/${name}.codesp`;

    if (
        state.project.files[file]
    ) {

        alert(
            "Ese plugin ya existe."
        );

        return;
    }

    const content =
`plugin "${name}":

    definir version = "1.0.0"

    funcion saludo(nombre):
        devolver "Hola " + nombre
`;

    addFile(
        state.project,
        file,
        content
    );

    state.currentFile =
        file;

    state.project.active =
        file;

    saveProject(
        state.project
    );

    openFile(file);
}


// ============================================================
// EJECUTAR
// ============================================================

async function runCode() {

    const editor =
        document.getElementById("code");

    if (!editor) return;

    if (state.running) {
        return;
    }

    saveCurrentFile();

    state.errors = [];

    state.network = [];

    state.console = [];

    state.lastResponse = null;

    state.running = true;

    setCompileState(
        "ANALIZANDO"
    );

    renderBottomPanel();

    try {

        const source =
            editor.value;


        // ----------------------------------------------------
        // LEXER
        // ----------------------------------------------------

        const tokens =
            tokenizar(source);

        const tokenState =
            document.getElementById(
                "tokenState"
            );

        if (tokenState) {

            tokenState.textContent =
                `${tokens.length} tokens`;
        }


        // ----------------------------------------------------
        // PARSER
        // ----------------------------------------------------

        const ast =
            parse(
                source,
                tokens
            );

        state.ast =
            ast;

        showAST(ast);


        // ----------------------------------------------------
        // RUNTIME
        // ----------------------------------------------------

        setCompileState(
            "EJECUTANDO"
        );

        state.runtime =
            new Runtime({

                onLog:
                    (message, type = "log") => {

                        showConsole(
                            message,
                            type
                        );
                    },

                onNetwork:
                    network => {

                        state.network.unshift(
                            network
                        );

                        if (
                            state.network.length >
                            100
                        ) {

                            state.network.pop();
                        }

                        state.lastResponse =
                            network;

                        updateInspector();

                        if (
                            state.activePanel ===
                            "network"
                        ) {

                            renderBottomPanel();
                        }
                    },

                onVariables:
                    variables => {

                        renderVariables(
                            variables
                        );
                    }
            });


        // ----------------------------------------------------
        // EJECUTAR AST
        // ----------------------------------------------------

        await state.runtime.run(
            ast
        );

        state.running =
            false;

        setCompileState(
            "LISTO"
        );

        showConsole(
            "Ejecución finalizada.",
            "success"
        );

        updateInspector();

    } catch (error) {

        state.running =
            false;

        state.errors.push({

            message:
                error?.message ||
                String(error),

            stack:
                error?.stack || ""
        });

        setCompileState(
            "ERROR"
        );

        showConsole(
            `ERROR: ${
                error?.message ||
                String(error)
            }`,
            "error"
        );

        renderBottomPanel();

        console.error(
            "CodEsp:",
            error
        );
    }
}


// ============================================================
// DETENER
// ============================================================

function stopCode() {

    if (
        state.runtime &&
        typeof state.runtime.stop ===
        "function"
    ) {

        state.runtime.stop();
    }

    state.running =
        false;

    setCompileState(
        "DETENIDO"
    );

    showConsole(
        "Ejecución detenida.",
        "warning"
    );
}


// ============================================================
// ESTADO
// ============================================================

function setCompileState(text) {

    const element =
        document.getElementById(
            "compileState"
        );

    if (element) {
        element.textContent =
            text;
    }
}


// ============================================================
// CONSOLA
// ============================================================

function showConsole(
    message,
    type = "log"
) {

    let text;

    if (
        typeof message ===
        "object"
    ) {

        try {

            text =
                JSON.stringify(
                    message,
                    null,
                    2
                );

        } catch {

            text =
                String(message);
        }

    } else {

        text =
            String(message);
    }

    state.console.push({

        text,

        type,

        date: new Date()
    });

    if (
        state.console.length >
        500
    ) {

        state.console.shift();
    }

    if (
        state.activePanel ===
        "console"
    ) {

        renderBottomPanel();
    }
}


// ============================================================
// PANEL INFERIOR
// ============================================================

function renderBottomPanel() {

    const content =
        document.getElementById(
            "bottomContent"
        );

    if (!content) return;


    // ------------------------------------------
    // CONSOLA
    // ------------------------------------------

    if (
        state.activePanel ===
        "console"
    ) {

        if (!state.console.length) {

            content.innerHTML = `
                <div class="empty-state">
                    Consola vacía.
                </div>
            `;

            return;
        }

        content.innerHTML =
            state.console
                .map(item => `

                    <div class="console-line ${
                        escapeHTML(item.type)
                    }">

                        <span class="console-prefix">
                            ${consoleIcon(
                                item.type
                            )}
                        </span>

                        <pre>${escapeHTML(
                            item.text
                        )}</pre>

                    </div>

                `)
                .join("");

        return;
    }


    // ------------------------------------------
    // RED
    // ------------------------------------------

    if (
        state.activePanel ===
        "network"
    ) {

        if (!state.network.length) {

            content.innerHTML = `
                <div class="empty-state">
                    No hay solicitudes HTTP.
                </div>
            `;

            return;
        }

        content.innerHTML =
            state.network
                .map(item => `

                    <div class="network-row">

                        <strong>
                            ${escapeHTML(
                                item.method ||
                                item.metodo ||
                                "HTTP"
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                item.url ||
                                ""
                            )}
                        </span>

                        <span>
                            ${
                                item.status ??
                                item.estado ??
                                "—"
                            }
                        </span>

                        <span>
                            ${
                                item.duration ??
                                item.duracion ??
                                "—"
                            } ms
                        </span>

                    </div>

                `)
                .join("");

        return;
    }


    // ------------------------------------------
    // ERRORES
    // ------------------------------------------

    if (
        state.activePanel ===
        "errors"
    ) {

        if (!state.errors.length) {

            content.innerHTML = `
                <div class="empty-state">
                    No hay errores.
                </div>
            `;

            return;
        }

        content.innerHTML =
            state.errors
                .map(error => `

                    <div class="error-entry">

                        <strong>
                            ${escapeHTML(
                                error.message
                            )}
                        </strong>

                        ${
                            error.stack
                                ? `
                                    <pre>${escapeHTML(
                                        error.stack
                                    )}</pre>
                                `
                                : ""
                        }

                    </div>

                `)
                .join("");
    }
}


function consoleIcon(type) {

    const icons = {

        log: "›",

        info: "i",

        success: "✓",

        warning: "!",

        error: "×"
    };

    return icons[type] || "›";
}


// ============================================================
// VARIABLES
// ============================================================

function renderVariables(
    variables
) {

    const element =
        document.getElementById(
            "variables"
        );

    if (!element) return;

    if (
        !variables ||
        typeof variables !== "object" ||
        !Object.keys(variables).length
    ) {

        element.textContent =
            "Sin variables.";

        return;
    }

    element.innerHTML =
        Object.entries(variables)
            .map(
                ([name, value]) => {

                    let text;

                    try {

                        text =
                            typeof value === "object"
                                ? JSON.stringify(
                                    value,
                                    null,
                                    2
                                )
                                : String(value);

                    } catch {

                        text =
                            "[objeto]";
                    }

                    return `
                        <div class="variable-row">

                            <b>
                                ${escapeHTML(name)}
                            </b>

                            <pre>${escapeHTML(text)}</pre>

                        </div>
                    `;
                }
            )
            .join("");
}


// ============================================================
// INSPECTOR
// ============================================================

function updateInspector() {

    if (
        state.runtime
    ) {

        renderVariables(
            state.runtime.env
        );
    }

    const request =
        document.getElementById(
            "requestInfo"
        );

    if (!request) return;

    const last =
        state.lastResponse;

    if (!last) {

        request.textContent =
            "Sin solicitud.";

        return;
    }

    request.innerHTML = `

        <div>
            Método:
            <b>
                ${escapeHTML(
                    last.method ||
                    last.metodo ||
                    "HTTP"
                )}
            </b>
        </div>

        <div>
            Estado:
            <b>
                ${
                    last.status ??
                    last.estado ??
                    "—"
                }
            </b>
        </div>

        <div>
            Duración:
            <b>
                ${
                    last.duration ??
                    last.duracion ??
                    "—"
                } ms
            </b>
        </div>

        <div class="inspect-url">
            ${escapeHTML(
                last.url || ""
            )}
        </div>

    `;
}


// ============================================================
// AST
// ============================================================

function showAST(ast) {

    const element =
        document.getElementById(
            "astInfo"
        );

    if (!element) return;

    try {

        element.textContent =
            JSON.stringify(
                ast,
                null,
                2
            );

    } catch {

        element.textContent =
            "No se pudo mostrar el AST.";
    }
}


// ============================================================
// EDITOR VISUAL
// ============================================================

function updateEditor() {

    const editor =
        document.getElementById(
            "code"
        );

    if (!editor) return;

    const highlight =
        document.getElementById(
            "highlight"
        );

    const gutter =
        document.getElementById(
            "gutter"
        );

    if (highlight) {

        highlight.innerHTML =
            highlightCode(
                editor.value
            );
    }

    if (gutter) {

        const lines =
            Math.max(
                editor.value
                    .split("\n")
                    .length,
                1
            );

        gutter.innerHTML =
            Array.from(
                {
                    length: lines
                },
                (_, index) =>
                    `<span>${
                        index + 1
                    }</span>`
            ).join("");
    }

    updateCursor();

    syncScroll();
}


// ============================================================
// HIGHLIGHT
// ============================================================

function highlightCode(source) {

    if (!source) return "";

    let html =
        escapeHTML(source);

    // Comentarios

    html =
        html.replace(
            /(^|\n)(\s*#.*)/g,
            "$1<span class=\"tok comment\">$2</span>"
        );

    // Strings

    html =
        html.replace(
            /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
            '<span class="tok string">$1</span>'
        );

    // Palabras clave

    const keywords = [

        "usar",
        "importar",
        "definir",
        "asignar",
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
        "mostrar",
        "solicitar",
        "simultaneamente",
        "sesion",
        "encabezados",
        "parametros",
        "enviar"
    ];

    const keywordPattern =
        new RegExp(
            `\\b(${keywords.join("|")})\\b`,
            "g"
        );

    html =
        html.replace(
            keywordPattern,
            '<span class="tok keyword">$1</span>'
        );

    // Métodos HTTP

    html =
        html.replace(
            /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
            '<span class="tok http">$1</span>'
        );

    // Números

    html =
        html.replace(
            /\b\d+(?:\.\d+)?\b/g,
            '<span class="tok number">$&</span>'
        );

    return html;
}


// ============================================================
// SCROLL
// ============================================================

function syncScroll() {

    const editor =
        document.getElementById(
            "code"
        );

    const highlight =
        document.getElementById(
            "highlight"
        );

    const gutter =
        document.getElementById(
            "gutter"
        );

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


// ============================================================
// CURSOR
// ============================================================

function updateCursor() {

    const editor =
        document.getElementById(
            "code"
        );

    const indicator =
        document.getElementById(
            "cursorPos"
        );

    if (
        !editor ||
        !indicator
    ) return;

    const position =
        editor.selectionStart ||
        0;

    const before =
        editor.value.slice(
            0,
            position
        );

    const lines =
        before.split("\n");

    const line =
        lines.length;

    const column =
        lines[
            lines.length - 1
        ].length + 1;

    indicator.textContent =
        `Ln ${line} : Col ${column}`;
}


// ============================================================
// CURL
// ============================================================

function importCurl() {

    const curl =
        prompt(
            "Pega aquí el comando cURL:"
        );

    if (!curl) return;

    try {

        const result =
            convertirCurl(curl);

        const editor =
            document.getElementById(
                "code"
            );

        if (!editor) return;

        editor.value =
            result;

        saveCurrentFile();

        updateEditor();

        showConsole(
            "cURL convertido correctamente.",
            "success"
        );

    } catch (error) {

        showConsole(
            `Error al convertir cURL: ${
                error.message
            }`,
            "error"
        );
    }
}


// ============================================================
// PYTHON
// ============================================================

function exportPython() {

    const editor =
        document.getElementById(
            "code"
        );

    if (!editor) return;

    try {

        const tokens =
            tokenizar(
                editor.value
            );

        const ast =
            parse(
                editor.value,
                tokens
            );

        const python =
            generarPython(ast);

        downloadText(
            state.currentFile
                .replace(
                    /\.codesp$/i,
                    ""
                ) +
                ".py",
            python
        );

        showConsole(
            "Python generado correctamente.",
            "success"
        );

    } catch (error) {

        showConsole(
            `Error al generar Python: ${
                error.message
            }`,
            "error"
        );
    }
}


// ============================================================
// PLUGINS
// ============================================================

function initPlugins() {

    const list =
        document.getElementById(
            "pluginList"
        );

    const detail =
        document.getElementById(
            "pluginDetail"
        );

    if (!list) return;

    const plugins =
        Object.entries(
            state.project?.files || {}
        )
        .filter(
            ([name]) =>
                name.startsWith(
                    "plugins/"
                ) &&
                name.endsWith(
                    ".codesp"
                )
        );


    if (!plugins.length) {

        list.innerHTML = `
            <div class="empty-state">
                No hay plugins instalados.
            </div>
        `;

    } else {

        list.innerHTML =
            plugins
                .map(
                    ([name]) => `

                        <button
                            class="file-row"
                            data-plugin="${escapeHTML(
                                name
                            )}"
                        >

                            <span>◆</span>

                            <span>
                                ${escapeHTML(
                                    name.replace(
                                        "plugins/",
                                        ""
                                    )
                                )}
                            </span>

                        </button>

                    `
                )
                .join("");

        list
            .querySelectorAll(
                "[data-plugin]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const name =
                                button.dataset
                                    .plugin;

                            if (!detail) {
                                return;
                            }

                            detail.innerHTML = `
                                <h2>
                                    ${escapeHTML(
                                        name
                                    )}
                                </h2>

                                <pre>${escapeHTML(
                                    state.project.files[
                                        name
                                    ]
                                )}</pre>
                            `;
                        }
                    );
                }
            );
    }


    const install =
        document.getElementById(
            "installPlugin"
        );

    if (install) {

        install.addEventListener(
            "click",
            installPlugin
        );
    }
}


// ============================================================
// INSTALAR PLUGIN
// ============================================================

function installPlugin() {

    const input =
        document.createElement(
            "input"
        );

    input.type = "file";

    input.accept =
        ".codesp,text/plain";

    input.addEventListener(
        "change",
        async () => {

            const file =
                input.files?.[0];

            if (!file) return;

            const content =
                await file.text();

            let name =
                file.name;

            if (
                !name.endsWith(
                    ".codesp"
                )
            ) {
                name += ".codesp";
            }

            const path =
                name.startsWith(
                    "plugins/"
                )
                    ? name
                    : `plugins/${name}`;

            if (
                state.project.files[path]
            ) {

                const replace =
                    confirm(
                        "Ese plugin ya existe. ¿Reemplazarlo?"
                    );

                if (!replace) {
                    return;
                }
            }

            addFile(
                state.project,
                path,
                content
            );

            saveProject(
                state.project
            );

            await loadView(
                "plugins"
            );
        }
    );

    input.click();
}


// ============================================================
// ARCHIVOS
// ============================================================

function initFiles() {

    const container =
        document.getElementById(
            "allFiles"
        );

    if (container) {

        const files =
            obtenerArchivos();

        if (!files.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No hay archivos.
                </div>
            `;

        } else {

            container.innerHTML =
                files
                    .map(
                        name => `

                            <div class="file-row">

                                <span>▤</span>

                                <span class="file-name">
                                    ${escapeHTML(
                                        name
                                    )}
                                </span>

                                <button
                                    data-open-file="${escapeHTML(
                                        name
                                    )}"
                                >
                                    Abrir
                                </button>

                            </div>

                        `
                    )
                    .join("");
        }


        container
            .querySelectorAll(
                "[data-open-file]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            openFile(
                                button.dataset
                                    .openFile
                            );

                        }
                    );
                }
            );
    }


    bind(
        "newFilePage",
        "click",
        createNewFile
    );

    bind(
        "openFilePage",
        "click",
        () => filePicker?.click()
    );
}


// ============================================================
// SELECTORES DE ARCHIVOS
// ============================================================

function setupFilePickers() {

    if (filePicker) {

        filePicker.addEventListener(
            "change",
            async event => {

                const file =
                    event.target.files?.[0];

                if (!file) return;

                let name =
                    file.name;

                if (
                    !name.toLowerCase()
                        .endsWith(".codesp")
                ) {
                    name += ".codesp";
                }

                const content =
                    await file.text();

                addFile(
                    state.project,
                    name,
                    content
                );

                state.currentFile =
                    name;

                saveProject(
                    state.project
                );

                await loadView(
                    "editor"
                );

                filePicker.value =
                    "";
            }
        );
    }


    if (projectPicker) {

        projectPicker.addEventListener(
            "change",
            async event => {

                const files =
                    [...event.target.files];

                for (
                    const file of files
                ) {

                    if (
                        !file.name
                            .toLowerCase()
                            .endsWith(
                                ".codesp"
                            )
                    ) {
                        continue;
                    }

                    const content =
                        await file.text();

                    addFile(
                        state.project,
                        file.name,
                        content
                    );
                }

                saveProject(
                    state.project
                );

                await loadView(
                    "editor"
                );

                projectPicker.value =
                    "";
            }
        );
    }
}


// ============================================================
// DESCARGAR TEXTO
// ============================================================

function downloadText(
    filename,
    content
) {

    const blob =
        new Blob(
            [content],
            {
                type:
                    "text/plain;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
        url
    );
}


// ============================================================
// ESCAPAR HTML
// ============================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );
}


// ============================================================
// API GLOBAL
// ============================================================

window.CodEsp = {

    run:
        runCode,

    stop:
        stopCode,

    open:
        openFile,

    save:
        saveCurrentFile,

    newFile:
        createNewFile,

    view:
        loadView,

    importCurl,

    exportPython,

    state
};
