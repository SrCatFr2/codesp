import {
    loadProject,
    saveProject,
    addFile
} from "./proyecto.js";


export function pluginFiles() {

    const project =
        loadProject();

    return Object.entries(
        project.files
    )
        .filter(
            ([name]) =>
                name.startsWith("plugins/") &&
                name.endsWith(".codesp")
        );
}


/*
 * Analiza la información básica
 * de un plugin.
 */

export function inspectPlugin(
    name,
    code
) {

    const pluginMatch =
        code.match(
            /^\s*plugin\s+["'](.+?)["']/m
        );

    const versionMatch =
        code.match(
            /definir\s+version\s*=\s*["'](.+?)["']/m
        );

    const functions = [
        ...code.matchAll(
            /funcion\s+([A-Za-zÁÉÍÓÚáéíóúÑñ_]\w*)\s*\(/g
        )
    ].map(
        match => match[1]
    );

    return {

        archivo: name,

        nombre:
            pluginMatch?.[1] ||
            name.split("/").pop(),

        version:
            versionMatch?.[1] ||
            "desconocida",

        funciones:
            functions,

        lineas:
            code.split("\n").length,

        codigo:
            code
    };
}


/*
 * Renderizar lista.
 */

export function renderPlugins(
    container,
    onSelect
) {

    const plugins =
        pluginFiles();

    container.innerHTML = "";

    if (!plugins.length) {

        container.innerHTML =
            `<div class="empty-state">
                No hay plugins instalados.
            </div>`;

        return;
    }

    for (
        const [name, code]
        of plugins
    ) {

        const info =
            inspectPlugin(
                name,
                code
            );

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "plugin-item";

        element.innerHTML = `
            <strong>
                ${escapeHTML(info.nombre)}
                <span class="plugin-badge">
                    CODESP
                </span>
            </strong>

            <small>
                v${escapeHTML(info.version)}
                · ${info.lineas} líneas
                · ${info.funciones.length} funciones
            </small>
        `;

        element.onclick = () => {

            container
                .querySelectorAll(
                    ".plugin-item"
                )
                .forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );

            element.classList.add(
                "active"
            );

            onSelect(
                name,
                code,
                info
            );
        };

        container.appendChild(
            element
        );
    }
}


/*
 * Instalar plugin.
 */

export function installPlugin(
    name,
    code
) {

    if (
        !name.toLowerCase()
            .endsWith(".codesp")
    ) {
        throw new Error(
            "Los plugins deben utilizar la extensión .codesp"
        );
    }

    const project =
        loadProject();

    const filename =
        name
            .replaceAll("\\", "/")
            .split("/")
            .pop();

    addFile(
        project,
        `plugins/${filename}`,
        code
    );

    saveProject(
        project
    );

    return project;
}


/*
 * Validar plugin.
 */

export function validatePlugin(
    code
) {

    if (
        !/^\s*plugin\s+["'](.+?)["']\s*:/m
            .test(code)
    ) {

        return {
            valid: false,
            error:
                "El archivo no contiene una declaración plugin válida."
        };
    }

    return {
        valid: true
    };
}


function escapeHTML(
    value
) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
