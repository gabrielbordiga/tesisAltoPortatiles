// ==========================
// app.js – Sistema de sesión, roles y guardas de ruta
// ==========================

import { supabase } from "../base/supabase.js";

const KEY_USERS = "ap_usuarios";
const KEY_CURRENT = "ap_current";

// ==========================
// TEST CONEXIÓN SUPABASE
// ==========================
async function testSupabaseConnection() {
  const { data, error } = await supabase.from("Cliente").select("idCliente").limit(1);

  if (error) {
    console.error("Error conexión Supabase:", error.message);
    return false;
  }

  console.log("Supabase conectado OK", data);
  return true;
}
testSupabaseConnection();

// ---------------- Helpers de storage ----------------
function seedIfEmpty() {
  if (!localStorage.getItem(KEY_USERS)) {
    const seed = [
      { id: 1, usuario: "admin", correo: "admin@alto.com", pass: "admin", rol: "Administrador", estado: "Activo", area: "Administración" },
      { id: 2, usuario: "bordiga", correo: "bordiga@gmail.com", pass: "admin", rol: "Administrador", estado: "Activo", area: "Administración" },
      { id: 3, usuario: "martina", correo: "martina@alto.com", pass: "martina", rol: "Empleado", estado: "Activo", area: "Logística" },
      { id: 4, usuario: "pedro", correo: "pedro@alto.com", pass: "clave", rol: "Empleado", estado: "Inactivo", area: "Ventas" }
    ];
    localStorage.setItem(KEY_USERS, JSON.stringify(seed));
  }
}
seedIfEmpty(); // fallback local

function getUsers() {
  return JSON.parse(localStorage.getItem(KEY_USERS) || "[]");
}

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

// ---------------- Auth Supabase ----------------
async function signInSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function fetchPerfilByAuthId(authId) {
  const { data, error } = await supabase
    .from("Usuarios")
    .select("idUsuarios, usuario, rol, idArea, activo, auth_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}

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

// ==========================
// Rehidratar sesión si existe en Supabase, pero falta en localStorage
// ==========================
async function ensureLocalSessionFromSupabase() {
  const existing = getCurrent();
  if (existing) return existing;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getSession:", error.message);
    return null;
  }

  const session = data?.session;
  if (!session?.user?.id) return null;

  try {
    const perfil = await fetchPerfilByAuthId(session.user.id);
    if (!perfil) return null;

    const userObj = {
      auth_id: session.user.id,
      email: session.user.email,
      idUsuarios: perfil.idUsuarios,
      usuario: perfil.usuario,
      rol: perfil.rol,
      idArea: perfil.idArea
    };

    setCurrent(userObj);
    return userObj;
  } catch (err) {
    console.error("No pude rehidratar perfil:", err?.message || err);
    return null;
  }
}

// ---------------- Lógica principal ----------------
document.addEventListener("DOMContentLoaded", async () => {
  // --- LOGIN (pública) ---
  const formLogin = document.getElementById("formLogin");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (document.getElementById("username")?.value || "").trim();
      const password = document.getElementById("password")?.value || "";

      if (!email.includes("@")) {
        alert("Ingresá con email (usuario lo hacemos después).");
        return;
      }

      try {
        // 1) Login en Supabase Auth
        const authData = await signInSupabase(email, password);
        const authId = authData?.user?.id;

        if (!authId) {
          alert("No pude obtener el usuario autenticado.");
          return;
        }

        // 2) Perfil en tabla Usuarios (RLS debe permitir leer su propia fila)
        let perfil = null;
        try {
          perfil = await fetchPerfilByAuthId(authId);
        } catch (errPerfil) {
          console.error("Error leyendo Usuarios:", errPerfil?.message || errPerfil);
          alert('No puedo leer tabla "Usuarios". Revisá RLS/policies.');
          return;
        }

        if (!perfil) {
          alert('No existe perfil en "Usuarios" para este auth_id. Falta vincular auth_id.');
          return;
        }

        if (perfil.activo === false) {
          alert("Usuario inactivo.");
          return;
        }

        // 3) Guardar sesión local para el front
        setCurrent({
          auth_id: authId,
          email: authData.user.email,
          idUsuarios: perfil.idUsuarios,
          usuario: perfil.usuario,
          rol: perfil.rol,
          idArea: perfil.idArea
        });

        location.href = "./inicio.html";
      } catch (err) {
        console.error("Login error:", err?.message || err);
        alert("Error al iniciar sesión. Revisá email/contraseña.");
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
  const hydrated = await ensureLocalSessionFromSupabase();
  const user = hydrated || requireAuth();
  if (!user) return;

  applyRoleVisibility(user.rol);

  const whoami = document.getElementById("whoami");
  if (whoami) {
    const name = user.usuario || user.email || "";
    whoami.textContent = `${name} · ${roleLabel(user.rol)}`;
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
    alert("No tenés permisos para acceder a esta sección.");
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
