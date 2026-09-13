// Offentlig frontend-konfiguration. Hemliga Stripe-nycklar ska endast ligga i
// Supabase Edge Functions och får aldrig läggas i den här filen.
const lcsSupabaseUrl = localStorage.getItem("supabaseUrl") || "https://dvtntpfisueeyapdoizv.supabase.co";

window.LCS_CONFIG = Object.freeze({
  stripeFunctionName: "stripe-payments",
  stripeCheckoutEndpoint: localStorage.getItem("stripeEndpoint")
    || `${lcsSupabaseUrl}/functions/v1/stripe-payments`,
  stripePublishableKey: localStorage.getItem("stripePublishableKey") || "pk_live_51UBgFnRvQp2USvJnHgVC52t6LaZlh5oMeoU8JOCbeWZMvXSKvK1L1SOr2BakpoNQzax1QoTOvc0LxBdND3PvtmRJ00MuQtUc2i",
  supabaseUrl: lcsSupabaseUrl,
  supabaseAnonKey: localStorage.getItem("supabaseAnonKey") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dG50cGZpc3VlZXlhcGRvaXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTc4NzYsImV4cCI6MjEwMzc3Mzg3Nn0.66Hn2jP_jsCeg-NL0vAEw-LmW65_MOh_Jmav93YhVHI"
});

