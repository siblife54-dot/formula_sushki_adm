// Инициализация клиента Supabase

window.supabaseClient = null;

window.getSupabaseClient = function () {
  if (window.supabaseClient) {
    return window.supabaseClient;
  }

  if (!window.APP_CONFIG?.supabaseUrl || !window.APP_CONFIG?.supabaseAnonKey) {
    console.error("Supabase config missing");
    return null;
  }

  window.supabaseClient = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseAnonKey
  );

  return window.supabaseClient;
};
