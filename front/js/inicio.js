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

  document.getElementById('btnGestionUnidades').addEventListener('click', () => {
    alert('Ir a Gestión de unidades (mock).');
  });
});
