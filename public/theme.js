/* Poner en <head> ANTES del CSS para evitar parpadeo. Guarda palette y theme en localStorage. */
(function () {
  const root = document.documentElement, K = {p: 'palette', t: 'theme'};
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
  const apply = () => {
    const p = get(K.p), t = get(K.t);
    root.dataset.palette = p === 'oceano' ? 'oceano' : 'indigo';
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  };
  window.Tema = {
    palette: p => { set(K.p, p === 'oceano' ? 'oceano' : 'indigo'); apply(); },
    mode: m => { set(K.t, m === 'light' || m === 'dark' ? m : null); apply(); }   // null/'auto' = sistema
  };
  apply();
})();
