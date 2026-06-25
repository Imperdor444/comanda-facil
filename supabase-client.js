function getSupabaseConfig() {
  return window.SABOR_DE_MAE_SUPABASE || { url: "", anonKey: "" };
}

function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && window.supabase);
}

function hasSupabaseCredentials() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

function createSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  const config = getSupabaseConfig();
  return window.supabase.createClient(config.url, config.anonKey);
}
