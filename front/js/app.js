// ======================================================
// app.js – Sistema de sesión, roles, seguridad y contraseñas
// ======================================================

(() => {
// 1. CONFIGURACIÓN INICIAL (Reemplaza con tus datos de Supabase)
const SB_URL = 'https://xpxvbtdhzylmokkguljk.supabase.co'; 
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweHZidGRoenlsbW9ra2d1bGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjc4ODYsImV4cCI6MjA3NTYwMzg4Nn0.fjPD6yMwENx_7JWFr5QqhTbsRmao2leuyjzwbFMZEDI';

const KEY_CURRENT = "ap_current";
const KEY_TOKEN = "ap_token";

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

// --- HELPERS DE STORAGE ---

function getCurrent() {
    const data = localStorage.getItem(KEY_CURRENT);
    return data ? JSON.parse(data) : null;
}

function setCurrent(user) {
    localStorage.setItem(KEY_CURRENT, JSON.stringify(user));
    if (user.token) localStorage.setItem(KEY_TOKEN, user.token);
}

function clearCurrent() {
    localStorage.removeItem(KEY_CURRENT);
    localStorage.removeItem(KEY_TOKEN);
}

// --- GUARDAS Y SEGURIDAD ---

function requireAuth() {
    const user = getCurrent();
    if (!user) {
        location.href = "./login.html";
        return null;
    }
    return user;
}

async function logout() {
    clearCurrent();
    location.href = "./login.html";
}

function normalizeRole(role) {
    const r = String(role || "").trim().toLowerCase();
    if (r === "admin" || r === "administrador" || r === "administrator") return "administrador";
    if (r === "empleado" || r === "employee") return "empleado";
    return r;
}

function roleLabel(role) {
    const r = normalizeRole(role);
    return r === "administrador" ? "Administrador" : "Empleado";
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

// Estilo para ocultar elementos
(function ensureHiddenRule() {
    if (document.getElementById("ap-hidden-style")) return;
    const st = document.createElement("style");
    st.id = "ap-hidden-style";
    st.textContent = ".hidden{display:none!important;}";
    document.head.appendChild(st);
})();

// --- LÓGICA PRINCIPAL ---
document.addEventListener("DOMContentLoaded", async () => {
    const formLogin = document.getElementById("formLogin");
    const resForm = document.getElementById("resPasswordForm");
    const formNueva = document.getElementById("formNuevaPass");

    // 1. LÓGICA DE RECUPERAR (Solicitar correo)
    if (resForm) {
        resForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emailInput = resForm.querySelector('input[type="email"]') || document.getElementById("resEmail");
            const email = emailInput.value.trim();
            const btn = resForm.querySelector('button[type="submit"]');

            try {
                btn.disabled = true;
                btn.innerText = "Enviando...";
                const res = await fetch('/api/usuarios/recuperar-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    await window.showAlert("¡Correo Enviado!", data.mensaje, "success");
                    location.href = "./login.html";
                } else {
                    throw new Error(data.error || "No se pudo enviar el correo");
                }
            } catch (err) {
                window.showAlert("Error", err.message, "error");
            } finally {
                btn.disabled = false;
                btn.innerText = "Enviar Solicitud";
            }
        });
        return; 
    }

    // 2. LÓGICA DE NUEVA CONTRASEÑA (Desde el enlace del mail)
    if (formNueva) {
        formNueva.addEventListener("submit", async (e) => {
            e.preventDefault();
            const p1 = document.getElementById("nPass").value;
            const p2 = document.getElementById("nPass2").value;
            const btn = document.getElementById("btnGuardar");

            if (p1 !== p2) return window.showAlert("Error", "Las contraseñas no coinciden", "error");

            try {
                btn.disabled = true;
                btn.innerText = "Guardando...";

                if (!window.supabase) throw new Error("Librería Supabase no cargada.");
                const _supabase = window.supabase.createClient(SB_URL, SB_KEY);

                // Supabase procesa el token de la URL automáticamente
                const { error } = await _supabase.auth.updateUser({ password: p1 });
                if (error) throw error;

                await window.showAlert("¡Éxito!", "Contraseña actualizada correctamente.", "success");
                location.href = "./login.html";
            } catch (err) {
                window.showAlert("Error", "El enlace expiró o es inválido. Solicita uno nuevo.", "error");
            } finally {
                btn.disabled = false;
                btn.innerText = "Cambiar Contraseña";
            }
        });
        return;
    }

    // 3. LÓGICA DE LOGIN
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = (document.getElementById("username")?.value || "").trim();
            const password = document.getElementById("password")?.value || "";

            try {
                const res = await fetch('/api/usuarios/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo: email, contrasena: password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

                localStorage.clear(); // Limpiamos caché antes de guardar lo nuevo
                const { token, usuario } = data;

                setCurrent({
                    token: token,
                    idUsuarios: usuario.idUsuarios || usuario.id,
                    usuario: usuario.usuario || usuario.nombre,
                    email: usuario.email || usuario.correo,
                    rol: usuario.rol || usuario.permisos || 'empleado',
                    idArea: usuario.idArea || usuario.id_area
                });

                setTimeout(() => { location.href = "./inicio.html"; }, 100); 
            } catch (err) {
                window.showAlert("Error", err.message, "error");
            }
        });
        return; 
    }

    // 4. PROTECCIÓN DE RUTAS INTERNAS
    const path = location.pathname.toLowerCase();
    if (/(^|\/)login(\.html)?$/i.test(path)) return;

    const user = requireAuth(); 
    if (!user) return;
    const userRol = normalizeRole(user.rol);

    // --- LIMPIEZA FÍSICA DEL MENÚ PARA EMPLEADOS ---
    if (userRol === 'empleado') {
        const paginasProhibidas = ['inicio.html', 'gestion.html', 'reportes.html', 'stock.html', 'usuarios.html'];
        const currentFile = window.location.pathname.split('/').pop() || 'inicio.html';

        if (paginasProhibidas.includes(currentFile)) {
            location.href = "./tareasAdm.html";
            return;
        }

        // ELIMINAR botones del menú lateral físicamente del HTML
        document.querySelectorAll('.side-nav .item').forEach(item => {
            // No borrar el botón de logout ni los permitidos para empleado
            if (item.classList.contains('logout-item')) return;
            
            const rolesPermitidos = (item.getAttribute('data-roles') || '').toLowerCase();
            if (!rolesPermitidos.includes('empleado')) {
                item.remove(); // Esto elimina el elemento del DOM por completo
            }
        });
    } else {
        applyRoleVisibility(userRol);
    }

    // --- RENDERIZADO DE DATOS DE USUARIO (whoami) ---
    const whoami = document.getElementById("whoami");
    if (whoami) {
        const name = user.usuario || user.email || "Usuario";
        whoami.innerHTML = `
            <a href="./mis-datos.html" style="color: white; text-decoration: none; font-size: 0.85em; border-bottom: 1px dotted rgba(255,255,255,0.5); cursor: pointer;">
                ${name} · ${roleLabel(user.rol)}
            </a>`;
    }

    document.addEventListener('click', async (e) => {
        if (e.target.closest('.logout-item') || e.target.closest('.logout')) {
            const confirmar = await window.confirmAction('¿Cerrar sesión?');
            if (confirmar) {
                localStorage.clear();
                location.href = "./login.html";
            }
        }
    });
});
})();