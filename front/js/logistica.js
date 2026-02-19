(() => {
  'use strict';

  // --- Configuración ---
  const API_ALQUILERES = '/api/alquileres';
  const API_CLIENTES = '/api/clientes';
  const CACHE_KEY = 'ap_geo_cache'; // Para guardar coordenadas y no saturar la API
  
  let map;
  let markersGroup;
  let geoCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  let clientesCache = [];
  let colaGeocoding = [];
  let procesandoCola = false;

  // --- Inicialización ---
  document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    const [alquileres, clientes] = await Promise.all([loadAlquileres(), loadClientes()]);
    clientesCache = clientes || [];
    mapAlquileres(alquileres);
  });

  // 1. Inicializar Mapa (Leaflet)
  function initMap() {
    // Coordenadas por defecto (Centro de Argentina aprox, o Córdoba)
    // Se ajustará automáticamente si hay marcadores o geolocalización
    map = L.map('map').setView([-31.4201, -64.1888], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);

    // Intentar ubicar al usuario
    map.locate({ setView: true, maxZoom: 14 });
    map.on('locationfound', e => {
      L.circle(e.latlng, { radius: e.accuracy / 2, color: '#ec1f26', fillOpacity: 0.1 }).addTo(map);
    });
  }

  // 2. Cargar datos del backend
  async function loadAlquileres() {
      try {
        const res = await fetch(API_ALQUILERES);
        if (!res.ok) return [];
        const data = await res.json();
        
        const estadosPermitidos = ['ENTREGADO', 'SERVICIO PENDIENTE', 'PARA RETIRAR'];

        return data.filter(a => {
          const estadoActual = String(a.estado || '').toUpperCase().trim();
          
          return estadosPermitidos.includes(estadoActual);
        });
        
      } catch (e) {
        console.error("Error cargando alquileres:", e);
        return [];
      }
  }

  async function loadClientes() {
    try {
      const res = await fetch(API_CLIENTES);
      return res.ok ? await res.json() : [];
    } catch (e) {
      return [];
    }
  }

  // 3. Procesar y mostrar en mapa
  function mapAlquileres(lista) {
    if (!lista.length) return;

    lista.forEach(alq => {
      if (!alq.ubicacion) return;

      // Normalizar dirección para usarla como clave de caché
      const direccion = alq.ubicacion.trim();

      // Si ya tenemos las coordenadas en caché, mostramos directo
      if (geoCache[direccion]) {
        addMarker(alq, geoCache[direccion]);
      } else {
        // Si no, a la cola para buscar en la API
        encolarGeocodificacion(direccion, (coords) => {
          addMarker(alq, coords);
        });
      }
    });
  }

  // 4. Agregar marcador al mapa
  function addMarker(alq, coords) {
    const { lat, lon } = coords;
    
    // Contenido del Popup
    const c = clientesCache.find(x => String(x.idCliente) === String(alq.idCliente));
    const nombreCliente = c 
        ? (c.tipo === 'PERSONA' ? `${c.nombre} ${c.apellido}` : c.razonSocial) 
        : 'Cliente desconocido';

    const unidades = (alq.lineas || []).map(l => `<li>${l.cantidad} x ${l.unidad}</li>`).join('');
    
    // Calcular saldo para color (Verde si saldo <= 0)
    const pagado = (alq.pagos || []).reduce((acc, p) => acc + (Number(p.monto)||0), 0);
    const saldo = (Number(alq.precioTotal)||0) - pagado;
    const estadoClass = saldo <= 0 ? 'color:green' : 'color:#ec1f26';
    
    const popupContent = `
      <div style="min-width:200px;">
        <div class="popup-title" style="font-weight:bold; font-size:14px; margin-bottom:5px;">
          Pedido #${alq.idAlquiler || alq.idalquiler}
        </div>
        <div style="font-size:13px; margin-bottom:8px;">
          <strong>📍</strong> ${alq.ubicacion}<br>
          <strong>👤</strong> ${nombreCliente}
        </div>
        <div style="background:#f9f9f9; padding:5px; border-radius:4px; font-size:12px;">
          <ul style="padding-left:15px; margin:0;">${unidades || '<li>Sin unidades</li>'}</ul>
        </div>
        <div style="margin-top:6px; font-weight:600; font-size:12px; ${estadoClass}">
          Estado: ${alq.estado}
        </div>
      </div>
    `;

    const marker = L.marker([lat, lon]).addTo(markersGroup);
    marker.bindPopup(popupContent);
  }

  // --- Sistema de Geocodificación (Cola + Caché) ---
  // Nominatim tiene límite de 1 request por segundo. Usamos una cola.
  
  function encolarGeocodificacion(direccion, callback) {
    colaGeocoding.push({ direccion, callback });
    procesarCola();
  }

  function procesarCola() {
    if (procesandoCola || colaGeocoding.length === 0) return;

    procesandoCola = true;
    const item = colaGeocoding.shift();

    // Verificar caché de nuevo por si acaso
    if (geoCache[item.direccion]) {
      item.callback(geoCache[item.direccion]);
      procesandoCola = false;
      procesarCola(); // Siguiente inmediato
      return;
    }

    // Fetch a Nominatim
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(item.direccion)}&limit=1`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          
          // Guardar en caché
          geoCache[item.direccion] = coords;
          localStorage.setItem(CACHE_KEY, JSON.stringify(geoCache));
          
          item.callback(coords);
        } else {
          console.warn("No se encontró ubicación para:", item.direccion);
        }
      })
      .catch(err => console.error("Error geocoding:", err))
      .finally(() => {
        // Esperar 1.2 segundos antes del siguiente para respetar API
        setTimeout(() => {
          procesandoCola = false;
          procesarCola();
        }, 1200);
      });
  }

})();