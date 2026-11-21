/* Poner en <head> ANTES del CSS para evitar parpadeo. Guarda palette y theme en localStorage. */
(function () {
  const root = document.documentElement, K = {p: 'palette', t: 'theme'};
  const PALETTES = ['apex', 'indigo', 'oceano'];   // apex = por defecto
  const pick = p => PALETTES.indexOf(p) >= 0 ? p : 'apex';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
  const apply = () => {
    const p = get(K.p), t = get(K.t);
    root.dataset.palette = pick(p);
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  };
  window.Tema = {
    palette: p => { set(K.p, pick(p)); apply(); },
    mode: m => { set(K.t, m === 'light' || m === 'dark' ? m : null); apply(); }   // null/'auto' = sistema
  };
  apply();
})();
