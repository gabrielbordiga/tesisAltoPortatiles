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
            style: 'currency', 
            currency: 'ARS', 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(n || 0); 
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
                    position: 'right',
                    labels: { 
                        boxWidth: 12, 
                        font: { size: 11, family: 'Poppins' },
                        padding: 15 // Espaciado entre items de leyenda
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: true
                }
            },
            // Añade esto para separar los gajos del gráfico
            elements: {
                arc: {
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }
            }
        }

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

        const coloresDinamicos = [
            '#ec1f26', 
            '#222222', 
            '#43A047', 
            '#1E88E5', 
            '#FFB300', 
            '#8E24AA', 
            '#00ACC1'  
        ];

        pieChart = new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(unidades),
                datasets: [{ 
                    data: Object.values(unidades), 

                    backgroundColor: coloresDinamicos 
                }]
            },
            options: pieOptions 
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
        tbody.innerHTML = arr.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).map(r => {
            const esEntrada = r.tipo === 'Ingreso';
            const claseColorMonto = esEntrada ? 'monto-entrada' : 'monto-salida';

            return `
                <tr>
                    <td>${formatDate(r.fecha)}</td>
                    <td>${r.tipo}</td>
                    <td>${r.tercero}</td>
                    <td>${r.producto}</td>
                    <td class="text-right">${r.cantidad || '-'}</td>
                    <td class="text-right ${claseColorMonto}">${formatMoney(r.monto)}</td>
                    <td>${r.metodo}</td>
                </tr>`;
        }).join('');
    }

    btnGenerar.addEventListener('click', generarReporte);
    generarReporte();

    document.getElementById('btnExportarPDF')?.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const elemento = document.getElementById('seccionResultados');
        const tablaWrap = document.querySelector('.tabla-wrap');

        if (!elemento) return window.showAlert('Error', 'No hay datos para exportar', 'error');

        const btn = document.getElementById('btnExportarPDF');
        btn.textContent = 'Generando...';
        btn.disabled = true;

        const originalMaxHeight = tablaWrap.style.maxHeight;
        const originalOverflow = tablaWrap.style.overflowY;

        tablaWrap.style.maxHeight = 'none';
        tablaWrap.style.overflowY = 'visible';

        const originalWidth = elemento.style.width;

        try {
            // 2. FORZAMOS MODO ESCRITORIO (1024px es ideal para A4)
            // Esto hace que los KPIs y gráficos se pongan uno al lado del otro
            elemento.style.width = '1024px';
            
            // Damos un respiro para que el navegador re-renderice el ancho
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(elemento, {
                scale: 2, // Calidad alta
                useCORS: true,
                backgroundColor: '#ffffff',
                // Evitamos que el scroll del celu moleste la captura
                windowWidth: 1024 
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15; 
            const contentWidth = pageWidth - (margin * 2);
            
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

            // --- HEADER ROJO ---
            pdf.setFillColor(236, 31, 38); 
            pdf.rect(0, 0, pageWidth, 40, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(22);
            pdf.text("REPORTE DE GESTIÓN", margin, 20);
            
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.text("ALTO PORTÁTILES - Sistema de Administración", margin, 28);

            const fechaStr = new Date().toLocaleDateString();
            pdf.text(`Emisión: ${fechaStr}`, pageWidth - margin - 35, 28);

            // --- CONTENIDO ---
            // Si el contenido es más largo que una hoja, addImage lo achicará 
            // (Si tenés muchísimas filas, acá convendría paginar, pero esto arregla el corte lateral)
            pdf.addImage(imgData, 'PNG', margin, 45, contentWidth, imgHeight);
            
            pdf.save(`Reporte_AltoPortatiles_${Date.now()}.pdf`);

        } catch (e) {
            console.error(e);
            window.showAlert('Error', 'Fallo al exportar', 'error');
        } finally {
            // 3. VOLVEMOS TODO A LA NORMALIDAD
            elemento.style.width = originalWidth; // Restauramos ancho
            tablaWrap.style.maxHeight = originalMaxHeight;
            tablaWrap.style.overflowY = originalOverflow;
            btn.textContent = '📄 Exportar a PDF';
            btn.disabled = false;
        }
    });
});