const API_URL = '/api/unidades';

// --- Refs DOM ---
const modalGestion = document.getElementById('modalGestionUnidades');
const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
const formGestion = document.getElementById('formGestionUnidades');
const formNuevoTipo = document.getElementById('formNuevoTipoUnidad');
const modalAcciones = document.getElementById('modalAccionesUnidad');
const selectTipoUnidad = document.getElementById('tipoUnidad');

// --- Helpers Visuales ---
function mostrarError(el, msg) {
    el.classList.add('is-invalid');
    let span = el.parentElement.querySelector('.error-message') || document.createElement('span');
    span.className = 'error-message';
    span.innerText = msg;
    if (!el.parentElement.querySelector('.error-message')) el.parentElement.appendChild(span);
}

function limpiarErrores() {
    document.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid'));
    document.querySelectorAll('.error-message').forEach(m => m.remove());
}

// --- Cargas API ---
async function cargarResumenStock() {
    const res = await fetch(`${API_URL}/resumen`);
    const data = await res.json();
    if (Array.isArray(data)) {
        document.getElementById('tbodyUnidades').innerHTML = data
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }))
            .map(u => `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.disponibles}</td>
                <td>${u.alquiladas}</td>
                <td>${u.servicio}</td>
                <td>$${Number(u.precio || 0).toLocaleString('es-AR')}</td>
                <td>
                    <button class="action btn-acciones" style="background:var(--rojo); color:#fff; border-color:var(--rojo);" data-id="${u.idTipo}" data-nombre="${u.nombre}" data-precio="${u.precio}">Editar</button>
                </td>
            </tr>`).join('');
    }
}

async function cargarComboTipos() {
    const res = await fetch(`${API_URL}/tipos`);
    const tipos = await res.json();
    if (selectTipoUnidad && Array.isArray(tipos)) {
        selectTipoUnidad.innerHTML = tipos.map(t => `<option value="${t.idTipo}">${t.nombre}</option>`).join('');
    }
}

// --- Eventos ---
document.addEventListener('DOMContentLoaded', () => {
    cargarResumenStock();

    // VALIDACIÓN: Solo números en cantidad y precio
    [document.getElementById('cantidadUnidad'), document.getElementById('precioUnidad')].forEach(input => {
        input?.addEventListener('input', (e) => {
            e.target.value = e.target.id === 'precioUnidad' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value.replace(/[^0-9]/g, '');
            e.target.classList.remove('is-invalid');
        });
    });

    document.getElementById('btnGestionUnidades')?.addEventListener('click', async () => {
        await cargarComboTipos();
        modalGestion.classList.remove('hidden');
    });

    // Submit Gestión (Guardar Stock)
    formGestion?.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarErrores();
        
        const cant = document.getElementById('cantidadUnidad');
        const prec = document.getElementById('precioUnidad');
        if (!cant.value || cant.value <= 0) return mostrarError(cant, "Cantidad inválida");
        if (!prec.value || prec.value <= 0) return mostrarError(prec, "Precio inválido");

        const res = await fetch(`${API_URL}/gestion`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                idTipo: selectTipoUnidad.value,
                stock: cant.value,
                estado: document.getElementById('estadoUnidad').value,
                precio: prec.value
            })
        });

        const data = await res.json();
        if (res.ok) {
            modalGestion.classList.add('hidden');
            formGestion.reset();
            cargarResumenStock();
            window.showAlert('Éxito', 'Stock actualizado correctamente', 'success');
        } else {
            window.showAlert('Error', data.error, 'error');
        }
    });

    // Submit Nuevo Tipo (Nombre Único)
    formNuevoTipo?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('nombreNuevoTipoUnidad');
        const res = await fetch(`${API_URL}/tipos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nombre: nom.value })
        });
        const data = await res.json();
        if (res.ok) {
            modalNuevoTipo.classList.add('hidden');
            formNuevoTipo.reset();
            cargarComboTipos();
            window.showAlert('Éxito', 'Tipo de unidad creado', 'success');
        } else {
            window.showAlert('Error', data.error, 'error');
        }
    });

    // Botones Cancelar
    document.getElementById('btnCerrarGestionUnidades')?.addEventListener('click', () => modalGestion.classList.add('hidden'));
    document.getElementById('btnCerrarNuevoTipoUnidad')?.addEventListener('click', () => modalNuevoTipo.classList.add('hidden'));
    document.getElementById('btnAbrirNuevoTipoUnidad')?.addEventListener('click', () => modalNuevoTipo.classList.remove('hidden'));

    // --- Lógica Modal Acciones (Edición / Baja / Movimiento) ---
    
    // Abrir modal desde la tabla
    document.getElementById('tbodyUnidades').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-acciones');
        if (btn) {
            const { id, nombre, precio } = btn.dataset;
            document.getElementById('idTipoAccion').value = id;
            document.getElementById('lblNombreUnidad').textContent = nombre;
            document.getElementById('editPrecio').value = precio && precio !== 'undefined' ? precio : '';
            modalAcciones.classList.remove('hidden');
        }
    });

    document.getElementById('btnCerrarAcciones')?.addEventListener('click', () => modalAcciones.classList.add('hidden'));

    // Cambio de acción (mostrar/ocultar campos)
    document.getElementById('accionStock')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const bloqueMover = document.getElementById('bloqueMover');
        const bloqueEliminar = document.getElementById('bloqueEliminar');
        
        if (val === 'mover') {
            bloqueMover.classList.remove('hidden');
            bloqueEliminar.classList.add('hidden');
        } else { // baja
            bloqueMover.classList.add('hidden');
            bloqueEliminar.classList.remove('hidden');
        }
    });

    // Guardar Precio
    document.getElementById('btnGuardarPrecio')?.addEventListener('click', async () => {
        const id = document.getElementById('idTipoAccion').value;
        const precio = document.getElementById('editPrecio').value;
        const res = await fetch(`${API_URL}/gestion`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ idTipo: id, precio, accion: 'precio' })
        });
        if (res.ok) { 
            window.showAlert('Éxito', 'Precio actualizado', 'success'); 
            cargarResumenStock(); 
        } else { 
            const d = await res.json(); 
            window.showAlert('Error', d.error, 'error'); 
        }
    });

    // Guardar Acción de Stock
    document.getElementById('formAccionesStock')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idTipoAccion').value;
        const accion = document.getElementById('accionStock').value;
        const cantidad = document.getElementById('stockCantidad').value;
        const origen = document.getElementById('stockOrigen').value;
        const destino = document.getElementById('stockDestino').value;
        const eliminarDe = document.getElementById('stockEliminar').value;

        if (!cantidad || Number(cantidad) <= 0) return window.showAlert('Atención', 'Ingresá una cantidad válida mayor a 0', 'warning');

        const payload = { idTipo: id, stock: cantidad, accion, origen: (accion==='mover'?origen:null), destino: (accion==='mover'?destino:null), estado: (accion==='baja'?eliminarDe:null) };
        const res = await fetch(`${API_URL}/gestion`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const d = await res.json();
        if (res.ok) { 
            window.showAlert('Éxito', d.mensaje, 'success'); 
            modalAcciones.classList.add('hidden'); 
            document.getElementById('formAccionesStock').reset(); 
            cargarResumenStock(); 
        }
        else window.showAlert('Error', d.error, 'error');
    });
});