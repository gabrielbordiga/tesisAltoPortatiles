// ==========================
// app.js – Sistema de sesión, roles y guardas de ruta
// ==========================

const KEY_CURRENT = "ap_current";

// --- SWEETALERT2 & HELPERS ---
(function() {
  if (!document.getElementById('swal-lib')) {
    const s = document.createElement('script');
    s.id = 'swal-lib';
    s.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    document.head.appendChild(s);
  }
})();

window.showAlert = function(title, text, icon='info') {
  if (typeof Swal !== 'undefined') {
    return Swal.fire({ title, text, icon, confirmButtonColor: '#3085d6' });
  }
  alert(title + '\n' + (text||''));
  return Promise.resolve();
};

window.confirmAction = async function(title, text='') {
  if (typeof Swal !== 'undefined') {
    const r = await Swal.fire({
      title, text, icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, confirmar', cancelButtonText: 'Cancelar'
    });
    return r.isConfirmed;
  }
  return confirm(title);
};

// ---------------- Helpers de storage ----------------
function setCurrent(user) {
  localStorage.setItem(KEY_CURRENT, JSON.stringify(user));
}

function getCurrent() {
  const data = localStorage.getItem(KEY_CURRENT);
  return data ? JSON.parse(data) : null;
}

function clearCurrent() {
  localStorage.removeItem(KEY_CURRENT);
}

async function logout() {
  clearCurrent();
  location.href = "./login.html";
}

// ---------------- Guardas y visibilidad ----------------
function requireAuth() {
  const user = getCurrent();
  if (!user) {
    location.href = "./login.html";
    return null;
  }
  return user;
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();

  if (r === "admin" || r === "administrador" || r === "administrator") return "administrador";
  if (r === "empleado" || r === "employee") return "empleado";

  return r;
}

function roleLabel(role) {
  const r = normalizeRole(role);
  if (r === "administrador") return "Administrador";
  if (r === "empleado") return "Empleado";
  return String(role || "");
}

function applyRoleVisibility(role) {
  const roleNorm = normalizeRole(role);

  document.querySelectorAll("[data-roles]").forEach((el) => {
    const allowed = (el.getAttribute("data-roles") || "")
      .split(",")
      .map((x) => normalizeRole(x))
      .filter(Boolean);

    if (!allowed.includes(roleNorm)) el.classList.add("hidden");
    else el.classList.remove("hidden");
  });
}

// Asegurar clase .hidden sin tocar styleSheets de otros orígenes
(function ensureHiddenRule() {
  if (document.getElementById("ap-hidden-style")) return;
  const st = document.createElement("style");
  st.id = "ap-hidden-style";
  st.textContent = ".hidden{display:none!important;}";
  document.head.appendChild(st);
})();

// ---------------- Lógica principal ----------------
document.addEventListener("DOMContentLoaded", async () => {
  // --- LOGIN (pública) ---
  const formLogin = document.getElementById("formLogin");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (document.getElementById("username")?.value || "").trim();
      const password = document.getElementById("password")?.value || "";

      try {
        // 1) Login contra TU Backend (API propia)
        // Ajustamos la URL al puerto donde corre tu servidor (3000)
        const res = await fetch('/api/usuarios/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            correo: email, 
            contrasena: password 
          })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Error al iniciar sesión');
        }

        const { token, usuario } = data;

        // Validar estado (tu controlador devuelve 'estado', no 'activo')
        if (!usuario.activo) { // Ahora es booleano (true/false)
          window.showAlert("Error", "Usuario inactivo.", "error");
          return;
        }

        // 2) Guardar sesión local mapeando los campos de tu tabla 'usuarios'
        setCurrent({
          token: token,
          idUsuarios: usuario.idUsuarios,
          usuario: usuario.usuario,
          email: usuario.email,
          rol: usuario.rol,
          idArea: usuario.idArea
        });

        location.href = "./inicio.html";
      } catch (err) {
        console.error("Login error:", err);
        window.showAlert("Error", err.message || "Error al iniciar sesión.", "error");
      }
    });

    return; // login es pública
  }

  // --- PÁGINAS PÚBLICAS (antes de requireAuth) ---
  if (document.getElementById("resPasswordForm")) return;

  const path = location.pathname.toLowerCase();
  const isLoginPage = /(^|\/)login(\.html)?$/i.test(path) || /\/html\/?$/.test(path);
  const isResPassPage =
    /(^|\/)res-passwrod(\.html)?$/i.test(path) || /(^|\/)res-password(\.html)?$/i.test(path);

  if (isLoginPage || isResPassPage) return;

  // --- PÁGINAS INTERNAS ---
  const user = requireAuth();
  if (!user) return;

  applyRoleVisibility(user.rol);

  const whoami = document.getElementById("whoami");
  if (whoami) {
    const name = user.usuario || user.email || "";
    whoami.innerHTML = `<a href="./mis-datos.html" style="color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,0.5); cursor: pointer;" title="Ver mis datos">${name} · ${roleLabel(user.rol)}</a>`;
  }

  // Restricción por página (además del data-roles)
  const file = (location.pathname.split("/").pop() || "inicio.html").toLowerCase();

  const restricted = {
    "usuarios.html": ["administrador"],
    "reportes.html": ["administrador"],
    "stock.html": ["administrador"]
  };

  const roleNorm = normalizeRole(user.rol);
  if (restricted[file] && !restricted[file].includes(roleNorm)) {
    await window.showAlert("Acceso denegado", "No tenés permisos para acceder a esta sección.", "error");
    location.href = "./inicio.html";
    return;
  }

  // --- LOGOUT ---
  document.querySelectorAll(".logout .item, .btn-logout, .logout-item").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
    });
  });
});
