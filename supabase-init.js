// Supabase-initialisering
// Instruktioner: Ladda Supabase-biblioteket i HTML innan denna fil
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(() => {

// Standard-nycklar (production-konfiguration)
const DEFAULT_SUPABASE_URL = "https://dvtntpfisueeyapdoizv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dG50cGZpc3VlZXlhcGRvaXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTc4NzYsImV4cCI6MjEwMzc3Mzg3Nn0.66Hn2jP_jsCeg-NL0vAEw-LmW65_MOh_Jmav93YhVHI";

const SUPABASE_URL = localStorage.getItem("supabaseUrl") || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem("supabaseAnonKey") || DEFAULT_SUPABASE_ANON_KEY;

let supabase = null;

function initializeSupabase(url, anonKey) {
  if (!url || !anonKey) {
    console.warn("Supabase-nycklar är inte konfigurerade. Använd setupSupabaseKeys() först.");
    return false;
  }
  
  try {
    // Kontrollera att Supabase är laddat
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error("Supabase.js är inte laddat ännu");
      return false;
    }
    
    supabase = window.supabase.createClient(url, anonKey);
    localStorage.setItem("supabaseUrl", url);
    localStorage.setItem("supabaseAnonKey", anonKey);
    console.log("✓ Supabase initialiserat framgångsrikt");
    return true;
  } catch (error) {
    console.error("✗ Fel vid initialisering av Supabase:", error.message);
    return false;
  }
}

function setupSupabaseKeys() {
  const url = prompt("Ange din Supabase Project URL (från Settings → API):", DEFAULT_SUPABASE_URL);
  if (!url) return false;
  
  const anonKey = prompt("Ange din Supabase anon public key (från Settings → API):", DEFAULT_SUPABASE_ANON_KEY);
  if (!anonKey) return false;
  
  return initializeSupabase(url, anonKey);
}

// Skapa LCS_SUPABASE objekt omedelbar (även om Supabase inte är redo än)
window.LCS_SUPABASE = {
  getClient: () => supabase,
  isConnected: () => supabase !== null,
  setupKeys: setupSupabaseKeys,
  initializeSupabase
};

// Försök initiera omedelbar
initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);

// Om det misslyckas, försök igen när Supabase har laddats
if (!supabase && typeof window.supabase !== 'undefined') {
  // Supabase finns redan, försök igen
  initializeSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}

console.log("LCS_SUPABASE initialisering är klar");

})();

