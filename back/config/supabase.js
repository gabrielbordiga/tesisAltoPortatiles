require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Usamos las credenciales de tu proyecto (si no existen en .env, usa estas por defecto)
const supabaseUrl = process.env.SUPABASE_URL || "https://xpxvbtdhzylmokkguljk.supabase.co";
// ¡IMPORTANTE! Aquí debes pegar tu SECRET KEY (service_role) para saltar el bloqueo RLS
const supabaseKey = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweHZidGRoenlsbW9ra2d1bGprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAyNzg4NiwiZXhwIjoyMDc1NjAzODg2fQ.q0OCGr1qXR52QdX1Q07z5FpDEoCp4nRIt3N8zqdnvUA";

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️  ERROR CRÍTICO: No se encontraron credenciales de Supabase.");
}

// Crea el cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;