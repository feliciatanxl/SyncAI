// SyncAI public website: mock sign-in, password reset and demo-request forms.
// Nothing leaves the browser (CSP sets connect-src 'none'). Production sign-in would use Microsoft Entra ID.

// shortcut: demo password lives in client code, fine for a mock with fictional data; replace with Entra ID before any real deployment.
const DEMO_PASSWORD = 'SyncAI-demo1';
const DEMO_ACCOUNTS = {
  'officer@syncai.demo': 'officer',
  'supervisor@syncai.demo': 'supervisor',
  'hq@syncai.demo': 'hq',
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_RULES = {
  length: (v) => v.length >= 12,
  case: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  number: (v) => /\d/.test(v),
  symbol: (v) => /[^A-Za-z0-9]/.test(v),
};

const $ = (sel, root = document) => root.querySelector(sel);

function setError(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  $('.error-text', field).textContent = message;
  return !message;
}

function showNotice(form, kind, text) {
  const box = $('.notice[data-status]', form);
  box.className = `notice ${kind}`;
  box.textContent = text;
  box.hidden = false;
  box.focus();
}

function checkEmail(input) {
  const v = input.value.trim();
  return setError(input, !v ? 'Enter your work email.' : EMAIL_RE.test(v) ? '' : 'Enter a valid email address, like name@example.com.');
}

const handlers = {
  login(form) {
    const email = form.email;
    const pw = form.password;
    const ok = checkEmail(email) & setError(pw, pw.value ? '' : 'Enter your password.');
    if (!ok) return;
    const role = DEMO_ACCOUNTS[email.value.trim().toLowerCase()];
    // Same message for wrong email or password, so the form never reveals which accounts exist.
    if (!role || pw.value !== DEMO_PASSWORD) {
      showNotice(form, 'err', 'That email and password combination is not recognised. Use one of the demo accounts below.');
      return;
    }
    // The portal reads this key and locks to the role. "Keep me signed in" survives closing the tab.
    try {
      sessionStorage.removeItem('syncai.session');
      localStorage.removeItem('syncai.session');
      (form.remember.checked ? localStorage : sessionStorage).setItem('syncai.session', role);
    } catch {
      showNotice(form, 'err', 'Your browser is blocking storage, so SyncAI cannot keep you signed in. Allow site data and try again.');
      return;
    }
    showNotice(form, 'ok', 'Signed in. Opening your workspace…');
    location.href = '../index.html';
  },

  forgot(form) {
    if (!checkEmail(form.email)) return;
    // Always the same reply, whether or not the account exists.
    showNotice(form, 'ok', 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.');
    $('[data-demo-link]', form).hidden = false;
  },

  reset(form) {
    const pw = form.password;
    const confirm = form.confirm;
    const strong = Object.values(PW_RULES).every((rule) => rule(pw.value));
    const ok =
      setError(pw, strong ? '' : 'Your password does not meet all the rules below.') &
      setError(confirm, confirm.value && confirm.value === pw.value ? '' : 'Passwords do not match.');
    if (!ok) return;
    form.reset();
    updateRules(form);
    showNotice(form, 'ok', 'Password updated. You can now sign in with your new password.');
    $('[data-demo-link]', form).hidden = false;
  },

  demo(form) {
    const name = form.name;
    const ok = setError(name, name.value.trim() ? '' : 'Enter your name.') & checkEmail(form.email) & setError(form.org, form.org.value.trim() ? '' : 'Enter your organisation.');
    if (!ok) return;
    form.reset();
    showNotice(form, 'ok', 'Thanks! This is a prototype, so nothing was sent. In the live site our team would reply within 2 working days.');
  },
};

function updateRules(form) {
  const value = form.password.value;
  for (const li of form.querySelectorAll('.rules li')) {
    const met = PW_RULES[li.dataset.rule](value);
    li.classList.toggle('met', met);
    li.setAttribute('aria-label', `${li.textContent}: ${met ? 'met' : 'not met'}`);
  }
}

for (const form of document.querySelectorAll('form[data-form]')) {
  form.noValidate = true;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handlers[form.dataset.form](form);
  });
  if (form.dataset.form === 'reset') form.password.addEventListener('input', () => updateRules(form));
}

document.addEventListener('click', (e) => {
  const toggle = e.target.closest('[data-toggle-pw]');
  if (toggle) {
    const input = toggle.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
  }
  const sso = e.target.closest('[data-sso]');
  if (sso) {
    showNotice(sso.closest('.auth-card').querySelector('form'), '', 'In production this signs you in with your Town Council Microsoft account (Entra ID single sign-on). For this prototype, use a demo account below.');
  }
  const fill = e.target.closest('[data-fill]');
  if (fill) {
    const form = $('form[data-form="login"]');
    form.email.value = fill.dataset.fill;
    form.password.value = DEMO_PASSWORD;
    form.requestSubmit();
  }
});

// Self-check: run with ?selftest in the URL; results go to the console.
if (new URLSearchParams(location.search).has('selftest')) {
  console.assert(EMAIL_RE.test('a@b.co') && !EMAIL_RE.test('a@b') && !EMAIL_RE.test('a b@c.d'), 'email regex');
  const strong = (v) => Object.values(PW_RULES).every((r) => r(v));
  console.assert(strong('Tc-Officer2026') && !strong('short1A!') && !strong('alllowercase12!'), 'password rules');
  console.assert(strong(DEMO_PASSWORD), 'demo password meets own rules');
  console.info('site.js self-test done');
}
