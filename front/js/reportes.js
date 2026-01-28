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

    function formatMoney(n) { 
        return new Intl.NumberFormat('es-AR', { 
            style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 
        }).format(Math.round(n || 0)); 
    }

    function formatDate(s) { return s ? new Date(s).toLocaleDateString('es-AR') : '-'; }

    (() => {
        const hoy = new Date();
        inpDesde.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        inpHasta.value = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
    })();

    async function generarReporte() {
        const desde = inpDesde.value;
        const hasta = inpHasta.value;
        const catFiltro = selCategoria.value;

        try {
            const res = await fetch(`/api/reportes?desde=${desde}&hasta=${hasta}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al obtener datos');

            // PROCESAMIENTO CON VALIDACIÓN DE ARREGLOS
            const ingresos = (data.ingresos || []).map(i => ({
                fecha: i.fechaDesde,
                monto: Number(i.precioTotal) || 0,
                tercero: i.cliente ? (i.cliente.razonSocial || `${i.cliente.nombre} ${i.cliente.apellido}`) : 'Sin Cliente',
                metodo: i.pagos?.length ? [...new Set(i.pagos.map(p => p.metodo))].join(', ') : 'S/D',
                producto: i.lineas?.map(l => `${l.cantidad} ${l.unidades?.tipo?.nombre}`).join(', ') || 'Alquiler',
                cantidad: i.lineas?.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0) || 0,
                lineasRaw: i.lineas || []
            }));

            const gastos = (data.gastos || []).map(g => ({
                fecha: g.fecha,
                monto: Number(g.precio) || 0,
                tercero: g.proveedor?.nombre || 'S/D',
                producto: g.productoRef?.nombre || g.producto || 'Insumo',
                cantidad: g.cantidad || 0,
                metodo: g.metodoPago || 'S/D'
            }));

            // LÓGICA DINÁMICA ASEGURANDO ARREGLOS
            if (catFiltro === 'todos') {
                updateKPITodos(ingresos, gastos);
                renderChartsTodos(ingresos, gastos);
                renderTabla([...ingresos.map(i => ({...i, tipo: 'Ingreso'})), ...gastos.map(g => ({...g, tipo: 'Gasto'}))]);
            } else if (catFiltro === 'Ingresos') {
                updateKPIIngresos(ingresos);
                renderChartsIngresos(ingresos);
                renderTabla(ingresos.map(i => ({...i, tipo: 'Ingreso'})));
            } else {
                updateKPIGastos(gastos, ingresos); 
                renderChartsGastos(gastos);
                renderTabla(gastos.map(g => ({...g, tipo: 'Gasto'})));
            }

        } catch (error) {
            window.showAlert('Error', error.message, 'error');
        }
    }

    // --- FUNCIONES DE KPIs CON BLINDAJE ---
    function updateKPITodos(ing = [], gas = []) {
        // Aseguramos que sean arreglos antes de usar reduce
        const arrIng = Array.isArray(ing) ? ing : [];
        const arrGas = Array.isArray(gas) ? gas : [];

        const tIng = arrIng.reduce((a, b) => a + (b.monto || 0), 0);
        const tGas = arrGas.reduce((a, b) => a + (b.monto || 0), 0);
        
        document.getElementById('lab1').innerText = "Unidad más alquilada";
        document.getElementById('val1').innerText = getTopUnidad(arrIng);
        document.getElementById('lab2').innerText = "Mayor gasto en";
        document.getElementById('val2').innerText = arrGas.length ? arrGas.sort((a,b) => (b.monto || 0) - (a.monto || 0))[0].producto : '-';
        document.getElementById('val3').innerText = formatMoney(tIng);
        if(document.getElementById('val4')) document.getElementById('val4').innerText = formatMoney(tGas);
        if(document.getElementById('valBalance')) document.getElementById('valBalance').innerText = formatMoney(tIng - tGas);
    }

    function updateKPIIngresos(ing = []) {
        const arrIng = Array.isArray(ing) ? ing : [];
        const tIng = arrIng.reduce((a, b) => a + (b.monto || 0), 0);

        document.getElementById('lab1').innerText = "Unidad más alquilada";
        document.getElementById('val1').innerText = getTopUnidad(arrIng);
        document.getElementById('lab2').innerText = "Total Alquileres";
        document.getElementById('val2').innerText = arrIng.length;
        document.getElementById('val3').innerText = formatMoney(tIng);
    }

    function updateKPIGastos(gas = [], ing = []) { 
        const arrGas = Array.isArray(gas) ? gas : [];
        const arrIng = Array.isArray(ing) ? ing : [];

        const provs = {};
        arrGas.forEach(g => provs[g.tercero] = (provs[g.tercero] || 0) + 1);
        const topProv = Object.entries(provs).sort((a,b) => b[1]-a[1])[0];

        document.getElementById('lab1').innerText = "Producto más comprado";
        document.getElementById('val1').innerText = arrGas.length ? arrGas.sort((a,b) => (b.monto || 0) - (a.monto || 0))[0].producto : '-';
        document.getElementById('lab2').innerText = "Proveedor recurrente";
        document.getElementById('val2').innerText = topProv ? topProv[0] : '-';

        const tIng = arrIng.reduce((acc, curr) => acc + (curr.monto || 0), 0);
        const tGas = arrGas.reduce((acc, curr) => acc + (curr.monto || 0), 0);

        document.getElementById('val3').innerText = formatMoney(tIng); 
        document.getElementById('val4').innerText = formatMoney(tGas);
        if(document.getElementById('valBalance')) document.getElementById('valBalance').innerText = formatMoney(tIng - tGas);
    }

    // --- GRÁFICOS CON BLINDAJE ---
    function renderChartsTodos(ing = [], gas = []) {
        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();

        const tIng = (Array.isArray(ing) ? ing : []).reduce((a, b) => a + (b.monto || 0), 0);
        const tGas = (Array.isArray(gas) ? gas : []).reduce((a, b) => a + (b.monto || 0), 0);

        pieChart = new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [{ data: [tIng, tGas], backgroundColor: ['#43A047', '#E53935'] }]
            }
        });

        barChart = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: ['Balance Financiero'],
                datasets: [
                    { label: 'Ingresos', data: [tIng], backgroundColor: '#43A047' },
                    { label: 'Gastos', data: [tGas], backgroundColor: '#E53935' }
                ]
            }
        });
    }

    function renderChartsIngresos(ing = []) {
        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();
        const arrIng = Array.isArray(ing) ? ing : [];

        // --- CONFIGURACIÓN VISUAL AQUÍ ---
        const pieOptions = {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', 
            plugins: {
                legend: {
                    position: 'right', // Leyenda a la derecha para no pisar el gráfico
                    labels: { boxWidth: 12, font: { size: 11, family: 'Poppins' } }
                }
            }
        };

        const barOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { font: { size: 10 } } }
            }
        };

        // --- CREACIÓN DE GRÁFICOS USANDO LAS OPTIONS ---
        const unidades = {};
        arrIng.forEach(i => (i.lineasRaw || []).forEach(l => {
            const n = l.unidades?.tipo?.nombre || 'Unidad';
            unidades[n] = (unidades[n] || 0) + l.cantidad;
        }));

        pieChart = new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(unidades),
                datasets: [{ 
                    data: Object.values(unidades), 
                    backgroundColor: ['#cf142b', '#333333', '#666666', '#999999'] 
                }]
            },
            options: pieOptions // <--- Aplicamos las opciones aquí
        });

        const fechas = {};
        arrIng.forEach(i => fechas[i.fecha] = (fechas[i.fecha] || 0) + i.monto);

        barChart = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(fechas).map(f => formatDate(f)),
                datasets: [{ 
                    label: 'Ingresos', 
                    data: Object.values(fechas), 
                    backgroundColor: '#2e7d32',
                    borderRadius: 5
                }]
            },
            options: barOptions // <--- Aplicamos las opciones aquí
        });
    }

    function renderChartsGastos(gas = []) {
        if (pieChart) pieChart.destroy();
        if (barChart) barChart.destroy();
        const arrGas = Array.isArray(gas) ? gas : [];

        const prods = {};
        arrGas.forEach(g => prods[g.producto] = (prods[g.producto] || 0) + g.monto);

        pieChart = new Chart(pieCanvas, {
            type: 'pie',
            data: {
                labels: Object.keys(prods),
                datasets: [{ data: Object.values(prods), backgroundColor: ['#f44336', '#ff9800', '#9c27b0'] }]
            }
        });

        const fechas = {};
        arrGas.forEach(g => fechas[g.fecha] = (fechas[g.fecha] || 0) + 1);

        barChart = new Chart(barCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(fechas).map(f => formatDate(f)),
                datasets: [{ label: 'Frecuencia de compras', data: Object.values(fechas), backgroundColor: '#f44336' }]
            }
        });
    }

    function getTopUnidad(ing = []) {
        const unidadesMap = {};
        (Array.isArray(ing) ? ing : []).forEach(i => (i.lineasRaw || []).forEach(l => {
            const nombre = l.unidades?.tipo?.nombre || 'Unidad';
            unidadesMap[nombre] = (unidadesMap[nombre] || 0) + (l.cantidad || 0);
        }));
        const top = Object.entries(unidadesMap).sort((a,b) => b[1] - a[1])[0];
        return top ? `${top[0]} (${top[1]})` : '-';
    }

    function renderTabla(data = []) {
        const arr = Array.isArray(data) ? data : [];
        tbody.innerHTML = arr.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map(r => `
            <tr>
                <td>${formatDate(r.fecha)}</td>
                <td><span class="tag ${r.tipo === 'Ingreso' ? 'success' : 'danger'}">${r.tipo}</span></td>
                <td>${r.tercero}</td>
                <td>${r.producto}</td>
                <td>${r.cantidad || '-'}</td>
                <td>${formatMoney(r.monto)}</td>
                <td>${r.metodo}</td>
            </tr>`).join('');
    }

    btnGenerar.addEventListener('click', generarReporte);
    generarReporte();
});