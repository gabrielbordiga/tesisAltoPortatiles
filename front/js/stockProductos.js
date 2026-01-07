// ========================================
//  STOCK - PRODUCTOS / MOVIMIENTOS
// ========================================

// Datos simulados
let productos = [
    { id: 1, nombre: "Papel higiénico", unidad: "rollos" },
];

let proveedoresStock = [
    { id: 1, nombre: "Limpieza S.A" }
];

let movimientos = [
    {
        id: 1,
        fecha: "2025-07-01",
        proveedorId: 1,
        productoId: 1,
        cantidad: 50,
        precio: 150000,
        metodo: "Transferencia"
    }
];

let movEditId = null;

// ------------------------
// Render tabla movimientos
// ------------------------
function renderMovimientos(lista = movimientos) {
    const tbody = document.getElementById("tbodyMovimientos");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:14px;">Sin resultados</td></tr>`;
        return;
    }

    lista.forEach(mov => {
        const proveedor = proveedoresStock.find(p => p.id === mov.proveedorId)?.nombre || "-";
        const producto = productos.find(p => p.id === mov.productoId)?.nombre || "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td data-label="Fecha">${mov.fecha}</td>
            <td data-label="Proveedor">${proveedor}</td>
            <td data-label="Producto">${producto}</td>
            <td data-label="Cantidad">${mov.cantidad}</td>
            <td data-label="Precio">$${mov.precio.toLocaleString("es-AR")}</td>
            <td data-label="Metodo">${mov.metodo}</td>
            <td data-label="Acciones" class="acciones">
                <button class="action" data-edit="${mov.id}">Editar</button>
                <button class="action danger" data-del="${mov.id}">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------------
// Cargar selects
// ------------------------
function cargarSelects() {
    const selProv = document.getElementById("movProveedor");
    const selProd = document.getElementById("movProducto");

    selProv.innerHTML = proveedoresStock.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");
    selProd.innerHTML = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");
}

cargarSelects();

// ------------------------
// Buscar movimiento
// ------------------------
document.getElementById("movBuscar").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtrados = movimientos.filter(m =>
        m.fecha.includes(q) ||
        productos.find(p => p.id === m.productoId)?.nombre.toLowerCase().includes(q) ||
        proveedoresStock.find(p => p.id === m.proveedorId)?.nombre.toLowerCase().includes(q) ||
        m.metodo.toLowerCase().includes(q)
    );
    renderMovimientos(filtrados);
});

// ------------------------
// Guardar movimiento
// ------------------------
document.getElementById("formMovimiento").addEventListener("submit", e => {
    e.preventDefault();

    const mov = {
        fecha: document.getElementById("movFecha").value,
        proveedorId: Number(document.getElementById("movProveedor").value),
        productoId: Number(document.getElementById("movProducto").value),
        cantidad: Number(document.getElementById("movCantidad").value),
        precio: Number(document.getElementById("movPrecio").value),
        metodo: document.getElementById("movMetodo").value
    };

    if (movEditId) {
        const idx = movimientos.findIndex(m => m.id === movEditId);
        movimientos[idx] = { ...movimientos[idx], ...mov };
    } else {
        movimientos.push({ id: Date.now(), ...mov });
    }

    limpiarFormMovimiento();
    renderMovimientos();
});

// ------------------------
// Editar / eliminar movimiento
// ------------------------
document.getElementById("tbodyMovimientos").addEventListener("click", e => {
    if (e.target.dataset.edit) {
        cargarMovimientoEnForm(Number(e.target.dataset.edit));
    }

    if (e.target.dataset.del) {
        eliminarMovimiento(Number(e.target.dataset.del));
    }
});

function cargarMovimientoEnForm(id) {
    const mov = movimientos.find(m => m.id === id);
    movEditId = id;

    document.getElementById("movFecha").value = mov.fecha;
    document.getElementById("movProveedor").value = mov.proveedorId;
    document.getElementById("movProducto").value = mov.productoId;
    document.getElementById("movCantidad").value = mov.cantidad;
    document.getElementById("movPrecio").value = mov.precio;
    document.getElementById("movMetodo").value = mov.metodo;
}

function eliminarMovimiento(id) {
    if (!confirm("¿Eliminar movimiento?")) return;
    movimientos = movimientos.filter(m => m.id !== id);
    renderMovimientos();
}

// ------------------------
// Cancelar
// ------------------------
document.getElementById("movCancelar").addEventListener("click", limpiarFormMovimiento);

function limpiarFormMovimiento() {
    movEditId = null;
    document.getElementById("formMovimiento").reset();
}

// ------------------------
// Modal nuevo producto
// ------------------------
const modal = document.getElementById("modalNuevoProducto");
const btnAbrir = document.getElementById("btnNuevoProducto");
const btnCerrar = document.getElementById("btnCerrarNuevoProducto");

btnAbrir.addEventListener("click", () => modal.classList.remove("hidden"));
btnCerrar.addEventListener("click", () => modal.classList.add("hidden"));

document.getElementById("formNuevoProducto").addEventListener("submit", e => {
    e.preventDefault();

    const nombre = document.getElementById("prodNombre").value.trim();
    const unidad = document.getElementById("prodUnidad").value.trim();

    if (!nombre) return alert("El nombre es obligatorio");

    productos.push({ id: Date.now(), nombre, unidad });

    cargarSelects();
    modal.classList.add("hidden");
    e.target.reset();
});

// Inicio
renderMovimientos();
