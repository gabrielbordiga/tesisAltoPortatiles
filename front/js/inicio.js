const API_URL = '/api/unidades';

// --- Refs DOM ---
const modalGestion = document.getElementById('modalGestionUnidades');
const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
const formGestion = document.getElementById('formGestionUnidades');
const formNuevoTipo = document.getElementById('formNuevoTipoUnidad');
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
        document.getElementById('tbodyUnidades').innerHTML = data.map(u => `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.disponibles}</td>
                <td>${u.alquiladas}</td>
                <td>${u.servicio}</td>
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
        } else {
            alert(data.error); // Muestra "Stock insuficiente" si falla la resta
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
        } else {
            alert(data.error); // "Ese tipo de unidad ya existe"
        }
    });

    // Botones Cancelar
    document.getElementById('btnCerrarGestionUnidades')?.addEventListener('click', () => modalGestion.classList.add('hidden'));
    document.getElementById('btnCerrarNuevoTipoUnidad')?.addEventListener('click', () => modalNuevoTipo.classList.add('hidden'));
    document.getElementById('btnAbrirNuevoTipoUnidad')?.addEventListener('click', () => modalNuevoTipo.classList.remove('hidden'));
});