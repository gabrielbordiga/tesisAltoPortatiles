(() => {
    'use strict';

    const API_URL = '/api/unidades';

    // --- Refs DOM ---
    const modalGestion = document.getElementById('modalGestionUnidades');
    const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');
    const formGestion = document.getElementById('formGestionUnidades');
    const formNuevoTipo = document.getElementById('formNuevoTipoUnidad');
    const modalAcciones = document.getElementById('modalAccionesUnidad');
    const selectTipoUnidad = document.getElementById('tipoUnidad');
    const tbodyUnidades = document.getElementById('tbodyUnidades');

    // --- 1. SEGURIDAD: La llave maestra ---
    function getHeaders() {
        const token = localStorage.getItem('ap_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // --- Helper para limpiar errores visuales ---
    function mostrarError(el, msg) {
        el.classList.add('is-invalid');
        // ... lógica de error visual ...
    }
    function limpiarErrores() {
        document.querySelectorAll('.is-invalid').forEach(i => i.classList.remove('is-invalid'));
    }

    // --- 2. RENDERIZADO ROBUSTO (Traductor de mayúsculas/minúsculas) ---
    function renderTablaStock(data) {
        if (!tbodyUnidades) return;

        if (data.length === 0) {
            tbodyUnidades.innerHTML = '<tr><td colspan="6" class="text-center">No hay unidades registradas.</td></tr>';
            return;
        }

        tbodyUnidades.innerHTML = data.map(u => {
            // Mapeo inteligente: busca nombre O Nombre, disponibles O Disponibles...
            const nombre = u.nombre || u.Nombre || 'Sin nombre';
            const disp = u.disponibles ?? u.Disponibles ?? u.stock ?? 0;
            const alq = u.alquiladas ?? u.Alquiladas ?? 0;
            const serv = u.servicio ?? u.Servicio ?? u.EnServicio ?? 0;
            const precio = u.precio ?? u.Precio ?? 0;
            const id = u.idTipo || u.id_tipo || u.IDTipo || u.id;

            return `
            <tr>
                <td>${nombre}</td>
                <td>${disp}</td>
                <td>${alq}</td>
                <td>${serv}</td>
                <td>$${precio}</td>
                <td>
                    <button class="action btn-acciones" 
                            data-id="${id}" 
                            data-nombre="${nombre}" 
                            data-precio="${precio}">
                        Editar
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    // --- 3. CARGA DE DATOS ---
    async function cargarResumenStock() {
        const token = localStorage.getItem('ap_token');
        
        if (!token) {
            setTimeout(cargarResumenStock, 200);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/resumen`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            if (!res.ok) throw new Error('Error al cargar stock');
            
            const data = await res.json();
            renderTablaStock(data); 

        } catch (err) {
            console.error("Error al cargar stock:", err);
            if(tbodyUnidades) {
                tbodyUnidades.innerHTML = `<tr><td colspan="6" class="error">Error: ${err.message}</td></tr>`;
            }
        }
    }

    // Cargar combo del modal
    async function cargarComboTipos() {
        try {
            const res = await fetch(`${API_URL}/tipos`, { headers: getHeaders() });
            const tipos = await res.json();
            if (selectTipoUnidad && Array.isArray(tipos)) {
                selectTipoUnidad.innerHTML = tipos.map(t => {
                    const id = t.idTipo || t.id || t.ID;
                    const nom = t.nombre || t.Nombre;
                    return `<option value="${id}">${nom}</option>`;
                }).join('');
            }
        } catch (err) { console.error(err); }
    }

    // --- EVENTOS ---
    document.addEventListener('DOMContentLoaded', () => {
        cargarResumenStock();

        // Listeners para abrir modales
        document.getElementById('btnGestionUnidades')?.addEventListener('click', async () => {
            await cargarComboTipos();
            modalGestion.classList.remove('hidden');
        });

        // Listeners para cerrar modales
        document.getElementById('btnCerrarGestionUnidades')?.addEventListener('click', () => modalGestion.classList.add('hidden'));
        document.getElementById('btnCerrarNuevoTipoUnidad')?.addEventListener('click', () => modalNuevoTipo.classList.add('hidden'));
        document.getElementById('btnCerrarAcciones')?.addEventListener('click', () => modalAcciones.classList.add('hidden'));

        // Listener para abrir "Nuevo Tipo" desde dentro del modal de gestión
        document.getElementById('btnAbrirNuevoTipoUnidad')?.addEventListener('click', () => {
             modalNuevoTipo.classList.remove('hidden');
        });

        // Listener Botones de la tabla (Editar)
        tbodyUnidades?.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-acciones');
            if (btn) {
                const { id, nombre, precio } = btn.dataset;
                document.getElementById('idTipoAccion').value = id;
                document.getElementById('lblNombreUnidad').textContent = nombre;
                document.getElementById('editPrecio').value = precio && precio !== 'undefined' ? precio : '';
                modalAcciones.classList.remove('hidden');
            }
        });

        // Submit Gestión (Stock)
        formGestion?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cant = document.getElementById('cantidadUnidad').value;
            const prec = document.getElementById('precioUnidad').value;
            
            try {
                const res = await fetch(`${API_URL}/gestion`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        idTipo: selectTipoUnidad.value,
                        stock: cant,
                        estado: document.getElementById('estadoUnidad').value,
                        precio: prec
                    })
                });
                if(res.ok) {
                    modalGestion.classList.add('hidden');
                    formGestion.reset();
                    cargarResumenStock();
                    window.showAlert('Éxito', 'Stock actualizado', 'success');
                } else {
                     const d = await res.json();
                     window.showAlert('Error', d.error, 'error');
                }
            } catch(e) { window.showAlert('Error', e.message, 'error'); }
        });

        // Submit Precio / Acciones
        document.getElementById('btnGuardarPrecio')?.addEventListener('click', async () => {
            const id = document.getElementById('idTipoAccion').value;
            const precio = document.getElementById('editPrecio').value;
            // ... lógica de fetch igual que arriba usando getHeaders() ...
             try {
                const res = await fetch(`${API_URL}/gestion`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ idTipo: id, precio, accion: 'precio' })
                });
                if (res.ok) { 
                    window.showAlert('Éxito', 'Precio actualizado', 'success'); 
                    modalAcciones.classList.add('hidden');
                    cargarResumenStock(); 
                }
            } catch (e) { console.error(e); }
        });
    });
})();