// Ponte segura entre o CODNIX IDE (web) e o Electron — sem acesso ao Node no renderer.
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.electron = '1';
});
