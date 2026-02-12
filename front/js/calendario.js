document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !window.FullCalendar) return;

    const LS_REMINDERS = 'ap_recordatorios';
    const API_ALQUILERES = '/api/alquileres';
    const API_TAREAS = '/api/tareas';
    const API_CLIENTES = '/api/clientes';

    let clientesCache = [];

    // --- 1. SEGURIDAD: Obtener token ---
    function getHeaders() {
        const token = localStorage.getItem('ap_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // --- 2. CARGA INICIAL DE CLIENTES (Para mostrar nombres en vez de IDs) ---
    try {
        const resC = await fetch(API_CLIENTES, { headers: getHeaders() });
        if (resC.ok) clientesCache = await resC.json();
    } catch (e) { console.error("Error cargando clientes:", e); }

    // --- 3. CONFIGURACIÓN DE FULLCALENDAR ---
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Agenda'
        },
        
        // --- Carga dinámica de eventos ---
        events: async function(info, successCallback, failureCallback) {
            try {
                // Pedir datos al servidor
                const [resA, resT] = await Promise.all([
                    fetch(API_ALQUILERES, { headers: getHeaders() }),
                    fetch(API_TAREAS, { headers: getHeaders() })
                ]);

                const alquileres = resA.ok ? await resA.json() : [];
                const tareas = resT.ok ? await resT.json() : [];
                
                // Cargar recordatorios del navegador (LocalStorage)
                const reminders = JSON.parse(localStorage.getItem(LS_REMINDERS) || '[]');

                const eventosFinales = [];

                // A. Mapear Recordatorios Personales (Color Salmón)
                recordatoriosBD.forEach(r => {
                    eventosFinales.push({
                        id: r.id,
                        title: `📌 ${r.descripcion}`,
                        start: r.fecha,
                        backgroundColor: '#ff9f89',
                        borderColor: '#ff9f89',
                        allDay: true,
                        extendedProps: { tipo: 'RECORDATORIO' }
                    });
                });

                // B. Mapear Alquileres (Entregas y Retiros)
                alquileres.forEach(a => {
                    const c = clientesCache.find(x => String(x.idCliente) === String(a.idCliente));
                    const nom = c ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) : 'Cliente';
                    
                    if (a.fechaDesde && a.fechaHasta) {
                        const fFin = new Date(a.fechaHasta);
                        fFin.setDate(fFin.getDate() + 1);

                        eventos.push({
                            id: `alq-${a.idAlquiler}`,
                            title: `Alquiler: ${nom}`,
                            start: a.fechaDesde,
                            end: fFin.toISOString().split('T')[0],
                            backgroundColor: '#3788d8', 
                            borderColor: '#3788d8',
                            extendedProps: { tipo: 'ALQUILER', detalle: `Ubicación: ${a.ubicacion}` }
                        });
                    }
                });

                // C. Mapear Tareas (Verde/Rojo)
                tareas.forEach(t => {
                    const color = t.completada ? '#28a745' : '#ec1f26';
                    eventosFinales.push({
                        id: `tarea-${t.idTarea || t.id}`,
                        title: `Tarea: ${t.usuario?.nombre || 'Pendiente'}`,
                        start: t.fecha,
                        backgroundColor: color,
                        borderColor: color,
                        extendedProps: { tipo: 'TAREA', detalle: t.descripcion }
                    });
                });

                successCallback(eventosFinales);
            } catch (e) {
                console.error("Error en fetchEvents:", e);
                failureCallback(e);
            }
        },

        // --- Al hacer click en un evento ---
        eventClick: async function(info) {
            const p = info.event.extendedProps;
            
            if (p.tipo === 'RECORDATORIO') {
                // Opción para eliminar recordatorios desde el calendario
                const confirmar = await window.confirmAction('¿Eliminar recordatorio?', info.event.title);
                if (confirmar) {
                    let list = JSON.parse(localStorage.getItem(LS_REMINDERS) || '[]');
                    list = list.filter(r => r.id !== info.event.id);
                    localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
                    info.event.remove();
                    window.showAlert('Eliminado', 'El recordatorio se quitó de la lista', 'success');
                }
            } else {
                // Mostrar detalles de Alquileres/Tareas
                window.showAlert(info.event.title, p.detalle || 'Sin descripción adicional', 'info');
            }
        },

        // --- Al hacer click en un día vacío (Crear nuevo recordatorio) ---
        dateClick: function(info) {
            // Esto permite que el usuario use el calendario para agendar
            const msg = `Crear recordatorio para el ${info.dateStr}?`;
            // Aquí podrías disparar el modal de tu inicio si lo tienes referenciado
            console.log("Día clickeado:", info.dateStr);
        }
    });

    calendar.render();

    // Listener por si el usuario cierra el modal o cambia algo, refrescar datos
    window.refreshCalendario = () => {
        calendar.refetchEvents();
    };
});