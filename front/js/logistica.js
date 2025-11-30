document.addEventListener("DOMContentLoaded", () => {

  // CREAR MAPA CENTRADO EN CÓRDOBA
  const map = L.map('map').setView([-31.417, -64.183], 13);

  // CAPA DE MAPA (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);


  // DATOS SIMULADOS (VENDRÁN DESDE BD EN EL FUTURO)
  const unidades = [
    {
      id: 1,
      cliente: "Pedro Martínez",
      detalle: "5 baños estándar",
      fecha: "27/05/25 - 31/05/25",
      ubicacion: "Obispo Salguero 450",
      coords: [-31.4234, -64.1830]
    },
    {
      id: 2,
      cliente: "Cooperativa Horizonte",
      detalle: "3 baños VIP",
      fecha: "12/06/25 - 20/06/25",
      ubicacion: "Sarmiento 251",
      coords: [-31.4168, -64.1883]
    },
    {
      id: 3,
      cliente: "Evento Social SRL",
      detalle: "2 cabinas de seguridad",
      fecha: "15/06/25 - 17/06/25",
      ubicacion: "Av. Poeta Lugones 200",
      coords: [-31.4115, -64.1901]
    }
  ];


  // RECORRER Y AGREGAR MARCADORES
  unidades.forEach(u => {
    const marker = L.marker(u.coords).addTo(map);

    const popupHTML = `
      <div>
        <div class="popup-title">${u.cliente}</div>
        <div><strong>Alquiler:</strong> ${u.detalle}</div>
        <div><strong>Ubicación:</strong> ${u.ubicacion}</div>
        <div><strong>Fecha:</strong> ${u.fecha}</div>
        <button style="
          margin-top:8px;
          padding:6px 10px;
          background:#ec1f26;
          border:none;
          color:white;
          border-radius:6px;
          cursor:pointer;
        ">Ver detalle</button>
      </div>
    `;

    marker.bindPopup(popupHTML);
  });

});
