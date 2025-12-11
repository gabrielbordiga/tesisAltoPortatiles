
let proveedores = [
    {
        id: 1,
        nombre: "Limpieza S.A",
        telefono: "3516789865",
        direccion: "Arturo Capdevila 2032",
        email: "limpiezasa@gmail.com"
    }
];

let provEditId = null;

// ------------------------
// Renderizar tabla
// ------------------------
function renderProveedores(lista = proveedores) {
    const tbody = document.getElementById("tbodyProveedores");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:14px;">Sin resultados</td></tr>`;
        return;
    }

    lista.forEach(prov => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${prov.nombre}</td>
            <td>${prov.telefono || "-"}</td>
            <td>${prov.direccion || "-"}</td>
            <td>${prov.email || "-"}</td>
            <td class="acciones">
                <button class="action" data-edit="${prov.id}">Editar</button>
                <button class="action danger" data-del="${prov.id}">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------------
// Buscar proveedores
// ------------------------
document.getElementById("provBuscar").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtrados = proveedores.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.telefono || "").toLowerCase().includes(q) ||
        (p.direccion || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
    renderProveedores(filtrados);
});

// ------------------------
// Guardar proveedor
// ------------------------
document.getElementById("formProveedor").addEventListener("submit", e => {
    e.preventDefault();

    const nombre = document.getElementById("provNombre").value.trim();
    const telefono = document.getElementById("provTelefono").value.trim();
    const direccion = document.getElementById("provDireccion").value.trim();
    const email = document.getElementById("provEmail").value.trim();

    if (!nombre) return alert("El nombre es obligatorio.");

    if (provEditId) {
        // Editar existente
        const prov = proveedores.find(p => p.id === provEditId);
        prov.nombre = nombre;
        prov.telefono = telefono;
        prov.direccion = direccion;
        prov.email = email;
    } else {
        // Agregar nuevo
        proveedores.push({
            id: Date.now(),
            nombre,
            telefono,
            direccion,
            email
        });
    }

    limpiarFormularioProveedor();
    renderProveedores();
});

// ------------------------
// Click en editar / eliminar
// ------------------------
document.getElementById("tbodyProveedores").addEventListener("click", e => {
    if (e.target.dataset.edit) {
        const id = Number(e.target.dataset.edit);
        cargarProveedorEnForm(id);
    }

    if (e.target.dataset.del) {
        const id = Number(e.target.dataset.del);
        eliminarProveedor(id);
    }
});

// ------------------------
// Cargar proveedor para edición
// ------------------------
function cargarProveedorEnForm(id) {
    const p = proveedores.find(x => x.id === id);
    provEditId = id;

    document.getElementById("provNombre").value = p.nombre;
    document.getElementById("provTelefono").value = p.telefono;
    document.getElementById("provDireccion").value = p.direccion;
    document.getElementById("provEmail").value = p.email;
}

// ------------------------
// Eliminar proveedor
// ------------------------
function eliminarProveedor(id) {
    if (!confirm("¿Eliminar proveedor permanentemente?")) return;
    proveedores = proveedores.filter(p => p.id !== id);
    renderProveedores();
}

// ------------------------
// Cancelar
// ------------------------
document.getElementById("provCancelar").addEventListener("click", limpiarFormularioProveedor);

function limpiarFormularioProveedor() {
    provEditId = null;
    document.getElementById("formProveedor").reset();
}

// Inicial
renderProveedores();
