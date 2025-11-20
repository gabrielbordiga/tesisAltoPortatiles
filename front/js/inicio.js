// --- Datos de ejemplo ---
const UNIDADES = [
  { id: 1, nombre: 'Baño estándar', tipo: 'banios', disp: 50, alquiladas: 15, servicio: 3 },
  { id: 2, nombre: 'Baño para obras', tipo: 'banios', disp: 28, alquiladas: 10, servicio: 2 },
  { id: 3, nombre: 'Baños VIP',      tipo: 'banios', disp: 12, alquiladas: 4,  servicio: 1 },
  { id: 4, nombre: 'Cabinas de seguridad', tipo: 'cabinas', disp: 7, alquiladas: 2, servicio: 0 }
];

const RECORDATORIOS = [
  { tipo: 'date',  texto: '25/05 Cobranza a nombre de Juan Pérez (Contrato #1823).' },
  { tipo: 'warn',  texto: 'Retiro de baños químicos (3) en obra Manantiales – 17:30 hs.' }
];

// --- Helpers de render ---
function renderUnidades(filtro = 'todos') {
  const tb = document.getElementById('tbodyUnidades');
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
  ul.innerHTML = RECORDATORIOS.map(r => `
    <li>
      <div class="ico ${r.tipo}">${r.tipo === 'warn' ? '❗' : '📅'}</div>
      <div class="text">${r.texto}</div>
    </li>
  `).join('');
}

// --- Eventos ---
document.addEventListener('DOMContentLoaded', () => {
  renderUnidades('todos');
  renderRecordatorios();

  const filtro = document.getElementById('filtroTipo');
  filtro.addEventListener('change', () => renderUnidades(filtro.value));

  document.getElementById('btnCalendario').addEventListener('click', () => {
    alert('Abrir calendario (mock).');
  });

});

// =============================================
//  MODALES DE UNIDADES
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const modalGestion = document.getElementById('modalGestionUnidades');
  const modalNuevoTipo = document.getElementById('modalNuevoTipoUnidad');

  const btnGestion = document.getElementById('btnGestionUnidades');
  const btnCerrarGestion = document.getElementById('btnCerrarGestionUnidades');

  const btnAbrirNuevoTipo = document.getElementById('btnAbrirNuevoTipoUnidad');
  const btnCerrarNuevoTipo = document.getElementById('btnCerrarNuevoTipoUnidad');

  if (!modalGestion || !modalNuevoTipo) return;

  const abrir = (modal) => modal.classList.add('is-open');
  const cerrar = (modal) => modal.classList.remove('is-open');

  // --- ABRIR modal de gestionar unidades ---
  btnGestion.addEventListener('click', () => {
    abrir(modalGestion);
  });

  // --- CERRAR modal de gestionar unidades ---
  btnCerrarGestion.addEventListener('click', () => {
    cerrar(modalGestion);
  });

  // --- ABRIR modal chico al apretar "+" ---
  btnAbrirNuevoTipo.addEventListener('click', () => {
    abrir(modalNuevoTipo);
  });

  // --- CERRAR modal chico ---
  btnCerrarNuevoTipo.addEventListener('click', () => {
    cerrar(modalNuevoTipo);
  });

  // Cerrar haciendo click afuera
  [modalGestion, modalNuevoTipo].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrar(modal);
    });
  });
});
