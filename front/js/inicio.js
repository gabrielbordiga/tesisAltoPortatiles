// ===================================================================
// DATOS DE EJEMPLO
// ===================================================================
const UNIDADES = [
  { id: 1, nombre: 'Baño estándar', tipo: 'banios', disp: 50, alquiladas: 15, servicio: 3 },
  { id: 2, nombre: 'Baño para obras', tipo: 'banios', disp: 28, alquiladas: 10, servicio: 2 },
  { id: 3, nombre: 'Baños VIP',      tipo: 'banios', disp: 12, alquiladas: 4,  servicio: 1 },
  { id: 4, nombre: 'Cabinas de seguridad', tipo: 'cabinas', disp: 7, alquiladas: 2, servicio: 0 }
];

const RECORDATORIOS = [
  { tipo: 'date', texto: '25/05 Cobranza a nombre de Juan Pérez (Contrato #1823).' },
  { tipo: 'warn', texto: 'Retiro de baños químicos (3) en obra Manantiales – 17:30 hs.' }
];

// Tipos para el select de gestión
let TIPOS_UNIDAD = [
  'Baño estándar',
  'Baño para obras',
  'Baños VIP',
  'Cabinas de seguridad'
];

// ===================================================================
// HELPERS DE UI
// ===================================================================
function renderUnidades(filtro = 'todos') {
  const tb = document.getElementById('tbodyUnidades');
  if (!tb) return;

  const data = UNIDADES.filter(u => filtro === 'todos' ? true : u.tipo === filtro);

  tb.innerHTML = data.map(u => `
    <tr>
      <td>${u.nombre}</td>
      <td>${u.disp}</td>
      <td>${u.alquiladas}</td>
      <td>${u.servicio}</td>
    </tr>
  `).join('');
}

function renderRecordatorios() {
  const ul = document.getElementById('listaRecordatorios');
  if (!ul) return;

  ul.innerHTML = RECORDATORIOS.map(r => `
    <li>
      <div class="ico ${r.tipo}">${r.tipo === 'warn' ? '❗' : '📅'}</div>
      <div class="text">${r.texto}</div>
    </li>
  `).join('');
}

function loadTiposUnidad(select) {
  if (!select) return;
  select.innerHTML = '';
  TIPOS_UNIDAD.forEach((t) => {
    const op = document.createElement('option');
    op.textContent = t;
    op.value = t;
    select.appendChild(op);
  });
}

function openModal(el) {
  el?.classList.remove('hidden');
}

function closeModal(el) {
  el?.classList.add('hidden');
}

// ===================================================================
// EVENTOS PRINCIPALES
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {

  // Render inicial
  renderUnidades();
  renderRecordatorios();
  loadTiposUnidad(document.getElementById('tipoUnidad'));

  // Filtros
  document.getElementById('filtroTipo')?.addEventListener('change', (e) => {
    renderUnidades(e.target.value);
  });

 document.getElementById('btnCalendario')?.addEventListener('click', () => {
    // Ir a la pantalla de calendario de recordatorios
    location.href = './calendario.html';
  });


  // ===================================================================
  // MODAL: GESTIONAR UNIDADES
  // ===================================================================
  const modalGestion = document.getElementById('modalGestionUnidades');
  const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');

  const btnGestion = document.getElementById('btnGestionUnidades');
  const btnCerrarGestion = document.getElementById('btnCerrarGestionUnidades');

  const btnAbrirNuevoTipo = document.getElementById('btnAbrirNuevoTipoUnidad');
  const btnCerrarNuevoTipo = document.getElementById('btnCerrarNuevoTipoUnidad');

  // abrir mod. gestión
  btnGestion?.addEventListener('click', () => {
    loadTiposUnidad(document.getElementById('tipoUnidad'));
    openModal(modalGestion);
  });

  // cerrar mod. gestión
  btnCerrarGestion?.addEventListener('click', () => {
    closeModal(modalGestion);
  });

  // abrir mod. Nuevo Tipo
  btnAbrirNuevoTipo?.addEventListener('click', () => {
    openModal(modalNuevoTipo);
  });

  // cerrar mod. Nuevo Tipo
  btnCerrarNuevoTipo?.addEventListener('click', () => {
    closeModal(modalNuevoTipo);
  });

  // Escape → cierra modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(modalGestion);
      closeModal(modalNuevoTipo);
    }
  });
});
