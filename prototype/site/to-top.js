// Floating scroll-to-top button for the long public pages (landing, status codes).
const btn = document.getElementById('to-top');
const main = document.getElementById('main');

window.addEventListener('scroll', () => (btn.hidden = window.scrollY < 400), { passive: true });

btn.addEventListener('click', () => {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  // Move keyboard focus back to the top too; the button hides once scrolled up.
  main.focus({ preventScroll: true });
});
