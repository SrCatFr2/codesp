// ============================================================
// CodEsp 0.3
// js/proyecto.js
// Gestión local de proyectos y archivos
// ============================================================

const STORAGE_KEY = "codesp_project_v4";


// ============================================================
// ARCHIVOS PREDETERMINADOS
// ============================================================

const DEFAULT_FILES = [

    {
        nombre: "principal.codesp",

        contenido: `# CodEsp
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
    mostrar "Error HTTP:"
    mostrar respuesta.estado
`
    },

    {
        nombre: "plugins/utilidades.codesp",

        contenido: `plugin "utilidades":
    definir version = "1.0.0"

    funcion limpiar(texto):
        devolver texto.trim()

    funcion saludo(nombre):
        devolver "Hola " + nombre
`
    }

];


// ============================================================
// CREAR ARCHIVO
// ============================================================

export function crearArchivo(
    nombre,
    contenido = ""
) {

    if (!nombre) {
        throw new Error(
            "El nombre del archivo es obligatorio."
        );
    }

    nombre = normalizarRuta(nombre);

    if (!nombre.endsWith(".codesp")) {
        nombre += ".codesp";
    }

    return {
        nombre,
        contenido: String(contenido ?? "")
    };
}


// ============================================================
// CREAR PROYECTO
// ============================================================

export function createProject() {

    return {
        nombre: "MiProyecto",

        version: "0.3.0",

        archivoActual: "principal.codesp",

        archivos: DEFAULT_FILES.map(archivo =>
            crearArchivo(
                archivo.nombre,
                archivo.contenido
            )
        )
    };
}


// ============================================================
// COMPATIBILIDAD
// ============================================================

export function crearProyecto() {
    return createProject();
}


// ============================================================
// CARGAR PROYECTO
// ============================================================

export function loadProject() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) {
            return createProject();
        }

        const guardado =
            JSON.parse(raw);

        const proyecto =
            normalizarProyecto(guardado);

        return proyecto;

    } catch (error) {

        console.warn(
            "CodEsp: proyecto inválido, creando uno nuevo.",
            error
        );

        return createProject();
    }
}


// ============================================================
// COMPATIBILIDAD
// ============================================================

export function cargarProyecto() {
    return loadProject();
}


// ============================================================
// NORMALIZAR PROYECTO
// ============================================================

function normalizarProyecto(proyecto) {

    // --------------------------------------------------------
    // Proyecto nuevo
    // --------------------------------------------------------

    if (!proyecto || typeof proyecto !== "object") {
        return createProject();
    }


    // --------------------------------------------------------
    // Convertir formato antiguo:
    //
    // files: {
    //     "principal.codesp": "..."
    // }
    // --------------------------------------------------------

    if (
        proyecto.files &&
        typeof proyecto.files === "object" &&
        !Array.isArray(proyecto.files)
    ) {

        const archivos =
            Object.entries(
                proyecto.files
            ).map(([nombre, contenido]) =>
                crearArchivo(
                    nombre,
                    contenido
                )
            );

        return {
            nombre:
                proyecto.name ||
                "MiProyecto",

            version:
                proyecto.version ||
                "0.3.0",

            archivoActual:
                proyecto.active ||
                archivos[0]?.nombre ||
                null,

            archivos
        };
    }


    // --------------------------------------------------------
    // Formato actual
    // --------------------------------------------------------

    if (Array.isArray(proyecto.archivos)) {

        const archivos =
            proyecto.archivos
                .filter(
                    archivo =>
                        archivo &&
                        archivo.nombre
                )
                .map(archivo =>
                    crearArchivo(
                        archivo.nombre,
                        archivo.contenido
                    )
                );

        if (!archivos.length) {
            return createProject();
        }

        const archivoActual =
            proyecto.archivoActual ||
            proyecto.active;

        return {

            nombre:
                proyecto.nombre ||
                proyecto.name ||
                "MiProyecto",

            version:
                proyecto.version ||
                "0.3.0",

            archivoActual:
                archivos.some(
                    archivo =>
                        archivo.nombre === archivoActual
                )
                    ? archivoActual
                    : archivos[0].nombre,

            archivos
        };
    }


    return createProject();
}


// ============================================================
// GUARDAR PROYECTO
// ============================================================

export function saveProject(project) {

    if (!project) {
        throw new Error(
            "No existe un proyecto para guardar."
        );
    }

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(project)
    );

    return project;
}


// ============================================================
// COMPATIBILIDAD
// ============================================================

export function guardarProyecto(project) {
    return saveProject(project);
}


// ============================================================
// ASEGURAR PROYECTO
// ============================================================

export function ensureProject() {

    const project =
        loadProject();

    saveProject(project);

    return project;
}


// ============================================================
// AGREGAR ARCHIVO
// ============================================================
//
// Compatible con:
// agregarArchivo(proyecto, archivo)
//
// ============================================================

export function agregarArchivo(
    project,
    archivo
) {

    if (!project) {
        throw new Error(
            "El proyecto no existe."
        );
    }

    if (!archivo) {
        throw new Error(
            "El archivo no existe."
        );
    }

    if (!Array.isArray(project.archivos)) {
        project.archivos = [];
    }

    const nuevo =
        crearArchivo(
            archivo.nombre,
            archivo.contenido
        );

    const existente =
        project.archivos.find(
            archivoActual =>
                archivoActual.nombre ===
                nuevo.nombre
        );

    if (existente) {

        existente.contenido =
            nuevo.contenido;

    } else {

        project.archivos.push(nuevo);
    }

    project.archivoActual =
        nuevo.nombre;

    saveProject(project);

    return nuevo;
}


// ============================================================
// ALIAS EN INGLÉS
// ============================================================

export function addFile(
    project,
    name,
    content = ""
) {

    return agregarArchivo(
        project,
        crearArchivo(
            name,
            content
        )
    );
}


// ============================================================
// ELIMINAR ARCHIVO
// ============================================================

export function eliminarArchivo(
    project,
    nombre
) {

    if (!project || !Array.isArray(project.archivos)) {
        return false;
    }

    const posicion =
        project.archivos.findIndex(
            archivo =>
                archivo.nombre === nombre
        );

    if (posicion === -1) {
        return false;
    }

    project.archivos.splice(
        posicion,
        1
    );

    if (
        project.archivoActual === nombre
    ) {

        project.archivoActual =
            project.archivos[0]?.nombre ||
            null;
    }

    saveProject(project);

    return true;
}


// ============================================================
// ALIAS EN INGLÉS
// ============================================================

export function removeFile(
    project,
    nombre
) {

    return eliminarArchivo(
        project,
        nombre
    );
}


// ============================================================
// RENOMBRAR ARCHIVO
// ============================================================

export function renombrarArchivo(
    project,
    nombreAnterior,
    nombreNuevo
) {

    if (
        !project ||
        !Array.isArray(project.archivos)
    ) {

        throw new Error(
            "Proyecto inválido."
        );
    }

    const archivo =
        project.archivos.find(
            archivo =>
                archivo.nombre ===
                nombreAnterior
        );

    if (!archivo) {

        throw new Error(
            "El archivo original no existe."
        );
    }

    const nuevo =
        normalizarRuta(nombreNuevo);

    if (!nuevo.endsWith(".codesp")) {
        nombreNuevo = nuevo + ".codesp";
    } else {
        nombreNuevo = nuevo;
    }

    if (
        project.archivos.some(
            archivo =>
                archivo.nombre ===
                nombreNuevo &&
                archivo !== archivo
        )
    ) {

        throw new Error(
            "Ya existe un archivo con ese nombre."
        );
    }

    archivo.nombre =
        nombreNuevo;

    if (
        project.archivoActual ===
        nombreAnterior
    ) {

        project.archivoActual =
            nombreNuevo;
    }

    saveProject(project);

    return archivo;
}


// ============================================================
// ALIAS EN INGLÉS
// ============================================================

export function renameFile(
    project,
    oldName,
    newName
) {

    return renombrarArchivo(
        project,
        oldName,
        newName
    );
}


// ============================================================
// BUSCAR ARCHIVO
// ============================================================

export function obtenerArchivo(
    project,
    nombre
) {

    if (
        !project ||
        !Array.isArray(project.archivos)
    ) {
        return null;
    }

    return project.archivos.find(
        archivo =>
            archivo.nombre === nombre
    ) || null;
}


// ============================================================
// ACTUALIZAR CONTENIDO
// ============================================================

export function actualizarArchivo(
    project,
    nombre,
    contenido
) {

    const archivo =
        obtenerArchivo(
            project,
            nombre
        );

    if (!archivo) {
        throw new Error(
            "Archivo no encontrado."
        );
    }

    archivo.contenido =
        String(contenido ?? "");

    saveProject(project);

    return archivo;
}


// ============================================================
// NORMALIZAR RUTAS
// ============================================================

function normalizarRuta(nombre) {

    return String(nombre)
        .replaceAll("\\", "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/")
        .trim();
}
