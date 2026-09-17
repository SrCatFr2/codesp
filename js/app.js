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

import * as CurlModule from "./curl.js";
import * as PythonModule from "./python.js";


/* =====================================================
   ESTADO
===================================================== */

let project = loadProject();

let runtime = null;

let currentView = null;

let bottomPanel = "console";

let logs = [];

let networkLogs = [];

let errorLogs = [];


/* =====================================================
   HELPERS
===================================================== */

function $(selector) {
    return document.querySelector(selector);
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function showToast(message) {

    const container =
        $("#toastContainer");

    if (!container) return;

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transform =
            "translateY(8px)";

        setTimeout(
            () => toast.remove(),
            250
        );

    }, 2500);

}


/* =====================================================
   VIEW INIT
===================================================== */

document.addEventListener(
    "codesp:view-loaded",
    event => {

        currentView =
            event.detail.view;

        if (currentView === "editor") {
            initEditor();
        }

        if (currentView === "plugins") {
            initPlugins();
        }

        if (currentView === "archivos") {
            initFiles();
        }

        if (currentView === "ayuda") {
            initHelp();
        }

    }
);


/* =====================================================
   EDITOR
===================================================== */

function initEditor() {

    project =
        loadProject();

    if (!project.active) {

        const first =
            Object.keys(project.files)[0];

        project.active =
            first || null;

        saveProject(project);

    }

    renderFileTree();

    loadActiveFile();

    bindEditorToolbar();

    bindEditorInput();

    bindBottomPanels();

    bindEditorKeyboard();

    updateLineNumbers();

    updateHighlight();

    updateCursor();

    renderConsole();

}


/* =====================================================
   FILE TREE
===================================================== */

function renderFileTree() {

    const tree =
        $("#fileTree");

    if (!tree) return;

    tree.innerHTML = "";

    const files =
        Object.keys(project.files);

    if (!files.length) {

        tree.innerHTML = `
            <div class="empty-state">
                No hay archivos.
            </div>
        `;

        return;
    }


    files.forEach(file => {

        const button =
            document.createElement("button");

        button.className =
            "file-item" +
            (
                file === project.active
                    ? " active"
                    : ""
            );

        const icon =
            file.startsWith("plugins/")
                ? "◇"
                : "▱";

        button.innerHTML = `
            <span class="file-icon">
                ${icon}
            </span>

            <span>
                ${escapeHtml(
                    file.split("/").pop()
                )}
            </span>
        `;

        button.title = file;

        button.addEventListener(
            "click",
            () => {

                project.active = file;

                saveProject(project);

                renderFileTree();

                loadActiveFile();

            }
        );

        tree.appendChild(button);

    });

}


/* =====================================================
   ACTIVE FILE
===================================================== */

function loadActiveFile() {

    const textarea =
        $("#code");

    if (!textarea) return;

    const file =
        project.active;

    textarea.value =
        file && project.files[file]
            ? project.files[file]
            : "";

    const tab =
        $("#currentTab");

    if (tab) {

        tab.textContent =
            file
                ? file.split("/").pop()
                : "Sin archivo";

    }

    const path =
        document.querySelector(".tab-path");

    if (path) {

        path.textContent =
            file
                ? "/" +
                  file
                    .split("/")
                    .slice(0, -1)
                    .join("/")
                : "/";

    }

    updateLineNumbers();

    updateHighlight();

    updateCursor();

}


/* =====================================================
   EDITOR INPUT
===================================================== */

function bindEditorInput() {

    const textarea =
        $("#code");

    if (!textarea) return;

    textarea.addEventListener(
        "input",
        () => {

            if (project.active) {

                project.files[
                    project.active
                ] = textarea.value;

                saveProject(project);

            }

            updateLineNumbers();

            updateHighlight();

            updateCursor();

            updateTokenCount();

        }
    );


    textarea.addEventListener(
        "scroll",
        syncEditorScroll
    );


    textarea.addEventListener(
        "click",
        updateCursor
    );


    textarea.addEventListener(
        "keyup",
        updateCursor
    );


    textarea.addEventListener(
        "select",
        updateCursor
    );

}


/* =====================================================
   SCROLL
===================================================== */

function syncEditorScroll() {

    const textarea =
        $("#code");

    const highlight =
        $("#highlight");

    const gutter =
        $("#gutter");

    if (!textarea) return;

    if (highlight) {

        highlight.scrollTop =
            textarea.scrollTop;

        highlight.scrollLeft =
            textarea.scrollLeft;

    }

    if (gutter) {

        gutter.scrollTop =
            textarea.scrollTop;

    }

}


/* =====================================================
   LINE NUMBERS
===================================================== */

function updateLineNumbers() {

    const textarea =
        $("#code");

    const gutter =
        $("#gutter");

    if (!textarea || !gutter) return;

    const lines =
        textarea.value.split("\n");

    gutter.innerHTML =
        lines.map(
            (_, index) => `
                <div
                    class="gutter-line"
                    data-line="${index + 1}"
                >
                    ${index + 1}
                </div>
            `
        ).join("");

    updateActiveLine();

}


/* =====================================================
   ACTIVE LINE
===================================================== */

function updateActiveLine() {

    const textarea =
        $("#code");

    const gutter =
        $("#gutter");

    if (!textarea || !gutter) return;

    const beforeCursor =
        textarea.value.slice(
            0,
            textarea.selectionStart
        );

    const line =
        beforeCursor.split("\n").length;


    gutter
        .querySelectorAll(".gutter-line")
        .forEach(element => {

            element.classList.toggle(
                "active",
                Number(
                    element.dataset.line
                ) === line
            );

        });

}


/* =====================================================
   CURSOR
===================================================== */

function updateCursor() {

    const textarea =
        $("#code");

    const output =
        $("#cursorPos");

    if (!textarea || !output) return;

    const before =
        textarea.value.slice(
            0,
            textarea.selectionStart
        );

    const parts =
        before.split("\n");

    const line =
        parts.length;

    const column =
        parts[parts.length - 1].length + 1;

    output.textContent =
        `Ln ${line} : Col ${column}`;

    updateActiveLine();

}


/* =====================================================
   SYNTAX HIGHLIGHT
===================================================== */

function highlightCode(source) {

    let text =
        escapeHtml(source);

    const placeholders = [];

    function protect(html) {

        const id =
            `@@CODESP_${placeholders.length}@@`;

        placeholders.push(html);

        return id;

    }


    /* Comentarios */

    text =
        text.replace(
            /(^|\n)(\s*#.*)/g,
            (_, start, comment) =>
                start +
                protect(
                    `<span class="code-comment">${comment}</span>`
                )
        );


    /* Strings */

    text =
        text.replace(
            /(["'])(?:\\.|(?!\1)[^\\\n])*\1/g,
            match =>
                protect(
                    `<span class="code-string">${match}</span>`
                )
        );


    /* Palabras */

    const keywords = [
        "usar",
        "definir",
        "si",
        "si no",
        "mientras",
        "para",
        "en",
        "intentar",
        "capturar",
        "devolver",
        "plugin",
        "funcion",
        "sesion",
        "crear",
        "solicitar",
        "simultaneamente",
        "mostrar"
    ];


    keywords.forEach(keyword => {

        const regex =
            new RegExp(
                `\\b${keyword.replace(
                    " ",
                    "\\s+"
                )}\\b`,
                "g"
            );

        text =
            text.replace(
                regex,
                match =>
                    `<span class="code-keyword">${match}</span>`
            );

    });


    /* Definiciones */

    text =
        text.replace(
            /\b(definir|funcion)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_][\wÁÉÍÓÚáéíóúÑñ]*)/g,
            (_, keyword, name) =>
                `<span class="code-keyword">${keyword}</span> ` +
                `<span class="code-definition">${name}</span>`
        );


    /* Funciones */

    text =
        text.replace(
            /\b([A-Za-zÁÉÍÓÚáéíóúÑñ_][\wÁÉÍÓÚáéíóúÑñ]*)\s*(?=\()/g,
            match =>
                `<span class="code-function">${match}</span>`
        );


    /* Números */

    text =
        text.replace(
            /\b\d+(?:\.\d+)?\b/g,
            match =>
                `<span class="code-number">${match}</span>`
        );


    /* Booleanos */

    text =
        text.replace(
            /\b(verdadero|falso|null|nulo)\b/g,
            match =>
                `<span class="code-boolean">${match}</span>`
        );


    /* Operadores */

    text =
        text.replace(
            /(==|!=|<=|>=|\+|-|\*|\/|=)/g,
            match =>
                `<span class="code-operator">${match}</span>`
        );


    /* Restaurar */

    placeholders.forEach(
        (html, index) => {

            text =
                text.replace(
                    `@@CODESP_${index}@@`,
                    html
                );

        }
    );


    return text;

}


function updateHighlight() {

    const textarea =
        $("#code");

    const highlight =
        $("#highlight");

    if (!textarea || !highlight) return;

    highlight.innerHTML =
        highlightCode(
            textarea.value
        ) + "\n";

    syncEditorScroll();

}


/* =====================================================
   TOKEN COUNT
===================================================== */

function updateTokenCount() {

    const textarea =
        $("#code");

    const target =
        $("#tokenState");

    if (!textarea || !target) return;

    try {

        const tokens =
            tokenizar(
                textarea.value
            );

        target.textContent =
            `${tokens?.length ?? 0} tokens`;

    } catch {

        target.textContent =
            "0 tokens";

    }

}


/* =====================================================
   KEYBOARD
===================================================== */

function bindEditorKeyboard() {

    const textarea =
        $("#code");

    if (!textarea) return;


    textarea.addEventListener(
        "keydown",
        event => {

            /* Ctrl + S */

            if (
                (event.ctrlKey ||
                 event.metaKey) &&
                event.key.toLowerCase() === "s"
            ) {

                event.preventDefault();

                saveCurrentFile();

                return;
            }


            /* Ctrl + Enter */

            if (
                event.ctrlKey &&
                event.key === "Enter"
            ) {

                event.preventDefault();

                runCode();

                return;
            }


            /* TAB */

            if (event.key === "Tab") {

                event.preventDefault();

                const start =
                    textarea.selectionStart;

                const end =
                    textarea.selectionEnd;

                textarea.setRangeText(
                    "    ",
                    start,
                    end,
                    "end"
                );

                textarea.dispatchEvent(
                    new Event("input")
                );

            }

        }
    );

}


/* =====================================================
   TOOLBAR
===================================================== */

function bindEditorToolbar() {

    $("#newFile")
        ?.addEventListener(
            "click",
            createNewFile
        );


    $("#openFile")
        ?.addEventListener(
            "click",
            openCodeFile
        );


    $("#saveFile")
        ?.addEventListener(
            "click",
            saveCurrentFile
        );


    $("#runCode")
        ?.addEventListener(
            "click",
            runCode
        );


    $("#stopCode")
        ?.addEventListener(
            "click",
            stopCode
        );


    $("#importCurl")
        ?.addEventListener(
            "click",
            importCurl
        );


    $("#exportPython")
        ?.addEventListener(
            "click",
            exportPython
        );


    $("#newPlugin")
        ?.addEventListener(
            "click",
            createPlugin
        );


    $("#runTop")
        ?.addEventListener(
            "click",
            () => {

                if (currentView !== "editor") {

                    location.hash =
                        "#editor";

                    return;

                }

                runCode();

            }
        );

}


/* =====================================================
   NEW FILE
===================================================== */

function createNewFile() {

    const name =
        prompt(
            "Nombre del archivo:",
            "nuevo.codesp"
        );

    if (!name) return;

    try {

        addFile(
            project,
            name,
            ""
        );

        project =
            loadProject();

        renderFileTree();

        loadActiveFile();

        showToast(
            "Archivo creado."
        );

    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* =====================================================
   OPEN FILE
===================================================== */

function openCodeFile() {

    const picker =
        $("#filePicker");

    if (!picker) return;

    picker.value = "";

    picker.onchange =
        async () => {

            const file =
                picker.files?.[0];

            if (!file) return;

            const content =
                await file.text();

            const name =
                file.name.endsWith(".codesp")
                    ? file.name
                    : file.name + ".codesp";

            addFile(
                project,
                name,
                content
            );

            project =
                loadProject();

            renderFileTree();

            loadActiveFile();

            showToast(
                "Archivo abierto."
            );

        };

    picker.click();

}


/* =====================================================
   SAVE
===================================================== */

function saveCurrentFile() {

    const textarea =
        $("#code");

    if (!textarea || !project.active) {

        showToast(
            "No hay archivo abierto."
        );

        return;

    }

    project.files[
        project.active
    ] = textarea.value;

    saveProject(project);

    const state =
        $("#compileState");

    if (state) {
        state.textContent =
            "GUARDADO";
    }

    showToast(
        "Archivo guardado."
    );

    setTimeout(() => {

        if (state) {
            state.textContent =
                "LISTO";
        }

    }, 1200);

}


/* =====================================================
   RUN
===================================================== */

async function runCode() {

    const textarea =
        $("#code");

    if (!textarea) return;

    const source =
        textarea.value;

    clearOutput();

    const state =
        $("#compileState");

    if (state) {
        state.textContent =
            "EJECUTANDO";
    }

    try {

        const tokens =
            tokenizar(source);

        const ast =
            parse(
                source,
                tokens
            );

        renderAst(ast);

        runtime =
            createRuntime();

        if (
            runtime &&
            typeof runtime.ejecutar === "function"
        ) {

            await runtime.ejecutar(ast);

        } else if (
            runtime &&
            typeof runtime.run === "function"
        ) {

            await runtime.run(ast);

        } else {

            log(
                "AST generado correctamente.",
                "success"
            );

        }

        if (state) {
            state.textContent =
                "LISTO";
        }

    } catch (error) {

        errorLogs.push(error);

        log(
            error.message ||
            String(error),
            "error"
        );

        renderErrors();

        if (state) {
            state.textContent =
                "ERROR";
        }

    }

}


/* =====================================================
   RUNTIME
===================================================== */

function createRuntime() {

    try {

        return new Runtime({

            onLog(message) {

                log(
                    message,
                    "info"
                );

            },

            onNetwork(request) {

                networkLogs.push(
                    request
                );

                renderNetwork();

            },

            onVariables(variables) {

                renderVariables(
                    variables
                );

            }

        });

    } catch {

        try {

            return new Runtime();

        } catch {

            return null;

        }

    }

}


/* =====================================================
   STOP
===================================================== */

function stopCode() {

    if (
        runtime &&
        typeof runtime.stop === "function"
    ) {

        runtime.stop();

    }

    log(
        "Ejecución detenida.",
        "muted"
    );

}


/* =====================================================
   CONSOLE
===================================================== */

function log(message, type = "info") {

    logs.push({
        message:
            String(message),
        type
    });

    renderConsole();

}


function clearOutput() {

    logs = [];

    networkLogs = [];

    errorLogs = [];

    renderConsole();

    renderNetwork();

    renderErrors();

}


function renderConsole() {

    const container =
        $("#bottomContent");

    if (
        !container ||
        bottomPanel !== "console"
    ) return;

    if (!logs.length) {

        container.innerHTML =
            `<div class="console-muted">
                Consola lista.
            </div>`;

        return;

    }

    container.innerHTML =
        logs.map(
            item =>
                `<div class="console-line console-${item.type}">
                    ${escapeHtml(item.message)}
                </div>`
        ).join("");

}


/* =====================================================
   NETWORK
===================================================== */

function renderNetwork() {

    const container =
        $("#bottomContent");

    if (
        !container ||
        bottomPanel !== "network"
    ) return;

    if (!networkLogs.length) {

        container.innerHTML =
            `<div class="console-muted">
                No hay solicitudes.
            </div>`;

        return;

    }

    container.innerHTML =
        networkLogs.map(
            item => {

                const method =
                    item.method ||
                    item.metodo ||
                    "HTTP";

                const url =
                    item.url ||
                    item.href ||
                    "";

                const status =
                    item.status ||
                    item.estado ||
                    "";

                return `
                    <div class="network-card">

                        <span class="network-method">
                            ${escapeHtml(method)}
                        </span>

                        ${escapeHtml(url)}

                        ${
                            status
                                ? ` — ${escapeHtml(status)}`
                                : ""
                        }

                    </div>
                `;

            }
        ).join("");

}


/* =====================================================
   VARIABLES
===================================================== */

function renderVariables(variables) {

    const target =
        $("#variables");

    if (!target) return;

    if (
        !variables ||
        typeof variables !== "object"
    ) {

        target.textContent =
            "Sin variables.";

        return;

    }

    target.textContent =
        JSON.stringify(
            variables,
            null,
            2
        );

}


/* =====================================================
   AST
===================================================== */

function renderAst(ast) {

    const target =
        $("#astInfo");

    if (!target) return;

    target.textContent =
        JSON.stringify(
            ast,
            null,
            2
        );

}


/* =====================================================
   ERRORS
===================================================== */

function renderErrors() {

    const container =
        $("#bottomContent");

    if (
        !container ||
        bottomPanel !== "errors"
    ) return;

    if (!errorLogs.length) {

        container.innerHTML =
            `<div class="console-success">
                No hay errores.
            </div>`;

        return;

    }

    container.innerHTML =
        errorLogs.map(
            error =>
                `<div class="console-line console-error">
                    ${escapeHtml(
                        error.message ||
                        String(error)
                    )}
                </div>`
        ).join("");

}


/* =====================================================
   BOTTOM PANELS
===================================================== */

function bindBottomPanels() {

    document
        .querySelectorAll(
            ".bottom-tabs button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    bottomPanel =
                        button.dataset.panel;

                    document
                        .querySelectorAll(
                            ".bottom-tabs button"
                        )
                        .forEach(btn => {

                            btn.classList.toggle(
                                "active",
                                btn === button
                            );

                        });

                    renderBottomPanel();

                }
            );

        });

}


function renderBottomPanel() {

    if (
        bottomPanel === "console"
    ) {
        renderConsole();
    }

    if (
        bottomPanel === "network"
    ) {
        renderNetwork();
    }

    if (
        bottomPanel === "errors"
    ) {
        renderErrors();
    }

}


/* =====================================================
   CURL
===================================================== */

function importCurl() {

    const curl =
        prompt(
            "Pega aquí el comando cURL:"
        );

    if (!curl) return;

    try {

        const converter =
            CurlModule.convertirCurl ||
            CurlModule.curlToCodesp ||
            CurlModule.default;

        if (
            typeof converter !==
            "function"
        ) {

            throw new Error(
                "curl.js no exporta una función de conversión compatible."
            );

        }

        const result =
            converter(curl);

        const textarea =
            $("#code");

        if (!textarea) return;

        textarea.value =
            result;

        textarea.dispatchEvent(
            new Event("input")
        );

        showToast(
            "cURL convertido a CodEsp."
        );

    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* =====================================================
   PYTHON
===================================================== */

function exportPython() {

    const textarea =
        $("#code");

    if (!textarea) return;

    try {

        const converter =
            PythonModule.generarPython ||
            PythonModule.codespToPython ||
            PythonModule.default;

        if (
            typeof converter !==
            "function"
        ) {

            throw new Error(
                "python.js no exporta una función compatible."
            );

        }

        const result =
            converter(
                textarea.value
            );

        const blob =
            new Blob(
                [result],
                {
                    type:
                        "text/x-python"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = url;

        a.download =
            "principal.py";

        a.click();

        URL.revokeObjectURL(url);

        showToast(
            "Python generado."
        );

    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* =====================================================
   PLUGIN
===================================================== */

function createPlugin() {

    const name =
        prompt(
            "Nombre del plugin:",
            "mi-plugin"
        );

    if (!name) return;

    const filename =
        `plugins/${name
            .replace(/\.codesp$/i, "")
            .replace(/[^\w-]/g, "-")
        }.codesp`;

    const content =
`plugin "${name}":
    definir version = "1.0.0"

    funcion ejecutar():
        mostrar "Plugin ${name} activo"
`;

    addFile(
        project,
        filename,
        content
    );

    project =
        loadProject();

    renderFileTree();

    loadActiveFile();

    showToast(
        "Plugin creado."
    );

}


/* =====================================================
   PLUGINS VIEW
===================================================== */

function initPlugins() {

    const list =
        $("#pluginList");

    if (!list) return;

    const plugins =
        Object.keys(
            project.files
        ).filter(
            file =>
                file.startsWith(
                    "plugins/"
                ) &&
                file.endsWith(
                    ".codesp"
                )
        );


    if (!plugins.length) {

        list.innerHTML =
            `<div class="empty-state">
                No hay plugins instalados.
            </div>`;

    } else {

        list.innerHTML =
            plugins.map(
                file => `
                    <button
                        class="plugin-item"
                        data-plugin="${escapeHtml(file)}"
                    >
                        <span class="plugin-symbol">
                            ◇
                        </span>

                        <span>
                            <strong>
                                ${escapeHtml(
                                    file
                                        .split("/")
                                        .pop()
                                )}
                            </strong>

                            <small>
                                Plugin CodEsp
                            </small>
                        </span>
                    </button>
                `
            ).join("");

        list
            .querySelectorAll(
                ".plugin-item"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        showPlugin(
                            button.dataset.plugin
                        );

                    }
                );

            });

    }


    $("#installPlugin")
        ?.addEventListener(
            "click",
            openPlugin
        );

}


function showPlugin(file) {

    const detail =
        $("#pluginDetail");

    if (!detail) return;

    const content =
        project.files[file] || "";

    detail.innerHTML = `
        <div class="plugin-detail-head">

            <div class="plugin-big-icon">
                ◇
            </div>

            <div>
                <h2>
                    ${escapeHtml(
                        file.split("/").pop()
                    )}
                </h2>

                <p>
                    ${escapeHtml(file)}
                </p>
            </div>

        </div>

        <pre class="plugin-code">${escapeHtml(
            content
        )}</pre>
    `;

}


function openPlugin() {

    openCodeFile();

}


/* =====================================================
   ARCHIVOS VIEW
===================================================== */

function initFiles() {

    renderAllFiles();

    $("#newFilePage")
        ?.addEventListener(
            "click",
            () => {

                createNewFile();

                setTimeout(
                    () => {
                        location.hash =
                            "#archivos";
                    },
                    50
                );

            }
        );


    $("#openFilePage")
        ?.addEventListener(
            "click",
            openCodeFile
        );

}


function renderAllFiles() {

    const target =
        $("#allFiles");

    if (!target) return;

    const files =
        Object.keys(
            project.files
        );


    if (!files.length) {

        target.innerHTML =
            `<div class="empty-state">
                No hay archivos.
            </div>`;

        return;

    }


    target.innerHTML =
        files.map(
            file => `

                <div class="file-row">

                    <div class="file-row-name">

                        <span>
                            ${
                                file.startsWith(
                                    "plugins/"
                                )
                                    ? "◇"
                                    : "▱"
                            }
                        </span>

                        <strong>
                            ${escapeHtml(file)}
                        </strong>

                    </div>

                    <div class="file-row-actions">

                        <button
                            data-open="${escapeHtml(file)}"
                        >
                            Abrir
                        </button>

                        <button
                            data-delete="${escapeHtml(file)}"
                            class="danger"
                        >
                            Eliminar
                        </button>

                    </div>

                </div>

            `
        ).join("");


    target
        .querySelectorAll(
            "[data-open]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    project.active =
                        button.dataset.open;

                    saveProject(project);

                    location.hash =
                        "#editor";

                }
            );

        });


    target
        .querySelectorAll(
            "[data-delete]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const file =
                        button.dataset.delete;

                    if (
                        !confirm(
                            `¿Eliminar ${file}?`
                        )
                    ) return;

                    removeFile(
                        project,
                        file
                    );

                    project =
                        loadProject();

                    renderAllFiles();

                    showToast(
                        "Archivo eliminado."
                    );

                }
            );

        });

}


/* =====================================================
   HELP
===================================================== */

function initHelp() {

    document
        .querySelectorAll(
            "[data-help-example]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const code =
                        button.dataset.helpExample;

                    project.active =
                        "principal.codesp";

                    project.files[
                        project.active
                    ] = code;

                    saveProject(project);

                    location.hash =
                        "#editor";

                }
            );

        });

}


/* =====================================================
   THEME
===================================================== */

if (
    localStorage.getItem(
        "codesp_theme"
    ) === "dark"
) {

    document.body.classList.add(
        "dark-mode"
    );

}


/* =====================================================
   FILE PICKER GLOBAL
===================================================== */

document
    .getElementById("filePicker")
    ?.addEventListener(
        "change",
        () => {}
    );
