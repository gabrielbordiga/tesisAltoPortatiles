// front/js/reportes.js
document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('tbodyReportes');
  const inpDesde = document.getElementById('repDesde');
  const inpHasta = document.getElementById('repHasta');
  const selCategoria = document.getElementById('repCategoria');
  const btnGenerar = document.getElementById('btnGenerarReporte');

  const pieCanvas = document.getElementById('chartPie');
  const barCanvas = document.getElementById('chartBar');

  let pieChart = null;
  let barChart = null;

  // --------- Datos de ejemplo ---------
  // fecha en formato YYYY-MM-DD
  const REPORTES = [
    {
      fecha: '2025-09-01',
      categoria: 'Gastos',
      tercero: 'Limpieza S.A.',
      producto: 'Papel higiénico',
      cantidad: 50,
      precio: 150000,
      metodo: 'Transferencia'
    },
    {
      fecha: '2025-09-05',
      categoria: 'Gastos',
      tercero: 'Proveedor Químicos SRL',
      producto: 'Desinfectante baños químicos',
      cantidad: 20,
      precio: 80000,
      metodo: 'Efectivo'
    },
    {
      fecha: '2025-09-08',
      categoria: 'Ingresos',
      tercero: 'Constructora Norte',
      producto: 'Alquiler baños estándar',
      cantidad: 10,
      precio: 250000,
      metodo: 'Transferencia'
    },
    {
      fecha: '2025-09-15',
      categoria: 'Mantenimiento',
      tercero: 'ServiTruck',
      producto: 'Reparación camión cisterna',
      cantidad: 1,
      precio: 120000,
      metodo: 'Transferencia'
    },
    {
      fecha: '2025-09-20',
      categoria: 'Ingresos',
      tercero: 'Evento Social SA',
      producto: 'Alquiler baños VIP',
      cantidad: 6,
      precio: 180000,
      metodo: 'Tarjeta'
    },
    {
      fecha: '2025-09-28',
      categoria: 'Gastos',
      tercero: 'Estación YPF',
      producto: 'Combustible flota',
      cantidad: 1,
      precio: 95000,
      metodo: 'Tarjeta'
    }
  ];

  // Setear fechas iniciales (mes actual) solo para que quede lindo
  (() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    inpDesde.value = inicioMes.toISOString().slice(0, 10);
    inpHasta.value = finMes.toISOString().slice(0, 10);
  })();

  // --------- Helpers ---------
  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str + 'T00:00:00');
    return isNaN(d) ? null : d;
  }

  function formatDateForTable(str) {
    const d = parseDate(str);
    if (!d) return str;
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  function formatMoney(num) {
    return num.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  }

  // --------- Filtro principal ---------
  function filtrarReportes() {
    const desde = parseDate(inpDesde.value);
    const hasta = parseDate(inpHasta.value);
    const cat = selCategoria.value;

    return REPORTES.filter(r => {
      const fecha = parseDate(r.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (cat !== 'todos' && r.categoria !== cat) return false;
      return true;
    });
  }

  // --------- Render tabla ---------
  function renderTabla(data) {
    if (!data.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; opacity:.7;">No hay registros para los filtros seleccionados.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td>${formatDateForTable(r.fecha)}</td>
        <td>${r.categoria}</td>
        <td>${r.tercero}</td>
        <td>${r.producto}</td>
        <td>${r.cantidad}</td>
        <td>${formatMoney(r.precio)}</td>
        <td>${r.metodo}</td>
      </tr>
    `).join('');
  }

  // --------- Render charts ---------
  function renderCharts(data) {
    // limpiar si ya existían
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }
    if (barChart) {
      barChart.destroy();
      barChart = null;
    }

    if (!data.length) return;

    // Agrupamos por categoría
    const totales = {};
    data.forEach(r => {
      totales[r.categoria] = (totales[r.categoria] || 0) + r.precio;
    });

    const labels = Object.keys(totales);
    const values = Object.values(totales);

    // Colores diferentes
    const colors = [
      '#E53935', // rojo
      '#FB8C00', // naranja
      '#8E24AA', // violeta
      '#1E88E5', // azul
      '#43A047', // verde
      '#FDD835'  // amarillo
    ].slice(0, labels.length);

    // Pie
    pieChart = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 1
        }]
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });

    // Bar
    barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monto',
          data: values,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => formatMoney(val)
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // --------- Acción principal ---------
  function generar() {
    const filtrados = filtrarReportes();
    renderTabla(filtrados);
    renderCharts(filtrados);
  }

  btnGenerar.addEventListener('click', generar);

  // Ejecutar una vez al cargar
  generar();
});
