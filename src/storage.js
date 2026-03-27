// Persistencia en localStorage (reemplaza window.storage de Claude)
export const STORAGE_KEY = "gastos_v3";
export const BUDGETS_KEY = "presupuestos_v3";
export const CATS_KEY = "categorias_v3";

export async function load(key, def) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
}

export async function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
