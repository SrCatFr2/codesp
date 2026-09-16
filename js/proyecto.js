const STORAGE_KEY =
    "codesp_project_v3";


const DEFAULT_FILES = {

    "principal.codesp": `# CodEsp
# Programa de ejemplo

usar sesiones

definir api = "https://jsonplaceholder.typicode.com/users"

sesion = crear sesion

respuesta = solicitar GET api:
    sesion: sesion

si respuesta.estado == 200:
    mostrar "Respuesta recibida"
    mostrar respuesta.json
si no:
    mostrar "Error HTTP:", respuesta.estado
`,

    "plugins/utilidades.codesp": `plugin "utilidades":
    definir version = "1.0.0"

    funcion limpiar(texto):
        devolver texto.trim()

    funcion saludo(nombre):
        devolver "Hola " + nombre
`
};


export function createProject() {

    return {
        name: "MiProyecto",
        version: "0.3.0",
        active: "principal.codesp",
        files: {
            ...DEFAULT_FILES
        }
    };
}


export function loadProject() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) {
            return createProject();
        }

        const project =
            JSON.parse(raw);

        if (
            !project.files ||
            typeof project.files !== "object"
        ) {
            return createProject();
        }

        return {
            ...createProject(),
            ...project
        };

    } catch {

        return createProject();
    }
}


export function saveProject(
    project
) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(project)
    );
}


export function ensureProject() {

    const project =
        loadProject();

    saveProject(project);

    return project;
}


export function addFile(
    project,
    name,
    content = ""
) {

    if (
        !name ||
        !String(name).trim()
    ) {
        throw new Error(
            "El nombre del archivo es obligatorio."
        );
    }

    name =
        String(name)
            .replaceAll("\\", "/")
            .replace(/^\/+/, "");

    if (
        !name.endsWith(".codesp")
    ) {
        name += ".codesp";
    }

    project.files[name] =
        content;

    project.active =
        name;

    saveProject(project);

    return project;
}


export function removeFile(
    project,
    name
) {

    if (
        !project.files[name]
    ) {
        return false;
    }

    delete project.files[name];

    if (
        project.active === name
    ) {

        const remaining =
            Object.keys(
                project.files
            );

        project.active =
            remaining[0] ||
            null;
    }

    saveProject(project);

    return true;
}


export function renameFile(
    project,
    oldName,
    newName
) {

    if (
        !project.files[oldName]
    ) {
        throw new Error(
            "El archivo original no existe."
        );
    }

    if (
        !newName.endsWith(".codesp")
    ) {
        newName += ".codesp";
    }

    project.files[newName] =
        project.files[oldName];

    delete project.files[oldName];

    project.active =
        newName;

    saveProject(project);

    return project;
}
