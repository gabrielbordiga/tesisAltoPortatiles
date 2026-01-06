// front/base/supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xpxvbtdhzylmokkguljk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweHZidGRoenlsbW9ra2d1bGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjc4ODYsImV4cCI6MjA3NTYwMzg4Nn0.fjPD6yMwENx_7JWFr5QqhTbsRmao2leuyjzwbFMZEDI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

