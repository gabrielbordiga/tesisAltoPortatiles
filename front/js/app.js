// ==========================
// app.js – Sistema de sesión, roles y guardas de ruta
// ==========================

const KEY_USERS   = 'ap_usuarios';
const KEY_CURRENT = 'ap_current';

// ---------------- Helpers de storage ----------------
function seedIfEmpty() {
  if (!localStorage.getItem(KEY_USERS)) {
    const seed = [
      { id: 1, usuario: 'admin',  correo: 'admin@alto.com',         pass: 'admin',    rol: 'Administrador', estado: 'Activo',   area: 'Administración' },
      { id: 2, usuario: 'bordiga', correo: 'bordiga@gmail.com',     pass: 'admin',    rol: 'Administrador', estado: 'Activo',   area: 'Administración' },
      { id: 3, usuario: 'martina', correo: 'martina@alto.com',      pass: 'martina',  rol: 'Empleado',      estado: 'Activo',   area: 'Logística' },
      { id: 4, usuario: 'Pedro',  correo: 'pedro@alto.com',         pass: 'clave',    rol: 'Empleado',      estado: 'Inactivo', area: 'Ventas' }
    ];
    localStorage.setItem(KEY_USERS, JSON.stringify(seed));
  }
}
seedIfEmpty(); // sembrar apenas carga el archivo

function getUsers() {
  return JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
}
function setCurrent(user) {
  localStorage.setItem(KEY_CURRENT, JSON.stringify(user));
}
function getCurrent() {
  const data = localStorage.getItem(KEY_CURRENT);
  return data ? JSON.parse(data) : null;
}
function logout() {
  localStorage.removeItem(KEY_CURRENT);
  location.href = './login.html';
}

// ---------------- Guardas y visibilidad ----------------
function requireAuth() {
  const user = getCurrent();
  if (!user) {
    location.href = './login.html';
    return null;
  }
  return user;
}
function applyRoleVisibility(role) {
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.getAttribute('data-roles')
      .split(',')
      .map(r => r.trim().toLowerCase());
    if (!allowed.includes(role.toLowerCase())) {
      el.classList.add('hidden');
    }
  });
}

// Asegurar clase .hidden sin tocar styleSheets de otros orígenes
(function ensureHiddenRule() {
  if (document.getElementById('ap-hidden-style')) return;
  const st = document.createElement('style');
  st.id = 'ap-hidden-style';
  st.textContent = '.hidden{display:none!important;}';
  document.head.appendChild(st);
})();

// ---------------- Lógica principal ----------------
document.addEventListener('DOMContentLoaded', () => {
  // --- LOGIN (pública) ---
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      const user = getUsers().find(
        u => (u.usuario.toLowerCase() === username || u.correo.toLowerCase() === username) && u.pass === password
      );
      if (!user) return alert('Usuario o contraseña incorrectos.');
      if (user.estado !== 'Activo') return alert('Usuario inactivo.');

      setCurrent({ id: user.id, usuario: user.usuario, rol: user.rol, area: user.area });
      location.href = './inicio.html';
    });
    return; // login es pública, no seguir con guardas
  }

  // --- PÁGINAS PÚBLICAS (antes de requireAuth) ---
  // chequeo por DOM (res-password)
  if (document.getElementById('resPasswordForm')) {
    return; // pública
  }

  // chequeo por URL
  const path = location.pathname.toLowerCase(); 
  const isLoginPage   = /(^|\/)login(\.html)?$/i.test(path) || /\/html\/?$/.test(path);
  const isResPassPage = /(^|\/)res-password(\.html)?$/i.test(path);
  if (isLoginPage || isResPassPage) {
    return; // públicas => no pedimos sesión
  }

  // --- PÁGINAS INTERNAS ---
  const user = requireAuth(); // redirige si no hay sesión
  if (!user) return;

  applyRoleVisibility(user.rol);

  const whoami = document.getElementById('whoami');
  if (whoami) whoami.textContent = `${user.usuario} · ${user.rol}`;

  // Definimos file correctamente
  const file = location.pathname.split('/').pop().toLowerCase() || 'inicio.html';

  const restricted = {
    'usuarios.html': ['Administrador'],
    'reportes.html': ['Administrador'],
    'stock.html':    ['Administrador']
  };
  if (restricted[file] && !restricted[file].includes(user.rol)) {
    alert('No tenés permisos para acceder a esta sección.');
    location.href = './inicio.html';
    return;
  }

  // --- LOGOUT ---
  document.querySelectorAll('.logout .item, .btn-logout').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      logout();
    });
  });
});
