import { createPreviewAuth, memoryStorage, passwordQuality, safeDestination, validateCredentials, SESSION_KEY } from './service.js';
import { authPage, onboardingPage, authTitles } from './pages.js';

/** UI-only route/session coordinator. The preview adapter never authenticates a real account. */
export function createAuthController({ onSession, onLeave, onReady, allowedPages }) {
  const storage = globalThis.localStorage || memoryStorage();
  const tab = globalThis.sessionStorage || memoryStorage();
  const client = createPreviewAuth({ local: storage, tab });
  const state = { route: 'sign-in', values: {}, errors: {}, busy: false, message: '', messageType: 'info', challenge: null, onboardingStep: 0, onboarding: { name: '', timezone: 'Asia/Karachi', intention: 'Build consistency and discipline', source: 'Both', markets: ['Forex','Gold'], risk: .5, start: 'demo' } };
  let destination = 'overview', readyUser = null, authVisible = true;
  function setHash(route, replace = false) {
    const next = route === 'workspace' ? '#' + destination : '#auth/' + route;
    if (location.hash !== next) (replace ? history.replaceState : history.pushState).call(history, null, '', next);
  }
  function focus() {
    const root = document.getElementById('app');
    const node = root.querySelector?.('[data-auth-focus],.auth-form-content h2,.onboarding-heading h1');
    if (node && !node.matches?.('input')) node.setAttribute('tabindex','-1');
    node?.focus?.({ preventScroll: true });
  }
  function render() {
    authVisible = true;
    state.challenge = client.getChallenge();
    document.body.classList.add('auth-mode');
    document.body.classList.remove('collapsed','sidebar-open');
    document.body.style.overflow = '';
    document.getElementById('app').removeAttribute('inert');
    document.getElementById('overlay-root').innerHTML = '';
    document.getElementById('app').innerHTML = state.route === 'onboarding' ? onboardingPage(state) : authPage(state);
    document.title = (state.route === 'onboarding' ? 'Set up your workspace' : authTitles[state.route]?.[0] || 'Sign in') + ' · Edgebook';
    focus();
  }
  function show(route, { message = '', type = 'info', preserveValues = false, replace = false } = {}) {
    state.route = route; state.errors = {}; state.busy = false;
    state.message = message; state.messageType = type;
    if (!preserveValues) state.values = {};
    setHash(route, replace); render();
  }
  function enter(session, action) {
    if (!session) { show('sign-in'); return; }
    if (!session.user.onboardingComplete) {
      readyUser = null;
      state.onboarding = { ...state.onboarding, ...session.user, name: session.user.name };
      state.onboardingStep = 0; show('onboarding'); return;
    }
    authVisible = false; state.route = 'workspace'; state.message = '';
    document.body.classList.remove('auth-mode');
    setHash('workspace');
    const changed = readyUser !== session.user.id;
    readyUser = session.user.id;
    onSession(session, { changed, destination, action });
    onReady?.(action);
  }
  function handleRoute() {
    const raw = location.hash.slice(1), session = client.getSession();
    if (!raw.startsWith('auth/')) {
      destination = safeDestination(raw || destination, allowedPages);
      if (session) { enter(session); return; }
      readyUser = null; show('sign-in', { replace: true }); return;
    }
    const route = raw.slice(5).split('?')[0];
    const publicRoute = Object.hasOwn(authTitles,route) || route === 'onboarding' ? route : 'sign-in';
    if (['password-change','password-changed','sign-out','onboarding'].includes(publicRoute) && !session) { show('sign-in', { replace: true }); return; }
    if (session && ['sign-in','sign-up'].includes(publicRoute)) { enter(session); return; }
    if (['verify-email','mfa','reset-password','reset-sent'].includes(publicRoute)) {
      const challenge = client.getChallenge();
      const expected = publicRoute === 'verify-email' ? 'verify' : publicRoute === 'mfa' ? 'mfa' : 'reset';
      if (!challenge || challenge.type !== expected) { show('expired', { replace: true }); return; }
    }
    if (publicRoute === 'onboarding') state.onboarding = { ...state.onboarding, ...session.user, name: session.user.name };
    state.route = publicRoute; state.errors = {}; state.message = ''; render();
  }
  function isWorkspaceReady() { const session = client.getSession(); return !authVisible && !!session?.user.onboardingComplete && !location.hash.startsWith('#auth/'); }
  function allowWorkspace() { if (isWorkspaceReady()) return true; if (!authVisible) { readyUser = null; onLeave?.(); show('session-expired'); } return false; }
  function signOut({ immediate = false } = {}) {
    if (!immediate) { show('sign-out'); return; }
    client.signOut(); readyUser = null; onLeave?.();
    show('sign-in', { message: 'You’re signed out of the preview. Your journal is saved.' });
  }
  function enterDemo() { destination = 'overview'; enter(client.enterDemo()); }
  function validation(errors) {
    state.errors = errors; state.busy = false; render();
    const first = Object.keys(errors)[0];
    document.getElementById('auth-' + first)?.focus?.();
  }
  function captureOnboarding(form) {
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    if (state.onboardingStep === 0) Object.assign(state.onboarding, { name: String(data.name || '').trim(), timezone: data.timezone || state.onboarding.timezone, intention: data.intention || state.onboarding.intention });
    if (state.onboardingStep === 1 && data.risk !== undefined) state.onboarding.risk = Number(data.risk);
  }
  async function submit(event) {
    const form = event.target;
    if (!form.id?.startsWith('auth-')) return;
    event.preventDefault(); if (state.busy) return;
    const data = Object.fromEntries(new FormData(form));
    state.values = { email: data.email || state.values.email || '', name: data.name || state.values.name || '', remember: !!data.remember, terms: !!data.terms };
    state.errors = {}; state.message = '';
    try {
      if (form.id === 'auth-onboarding-form') {
        captureOnboarding(form);
        if (!state.onboarding.name || state.onboarding.name.length > 60) { state.onboardingStep = 0; validation({ name: 'Enter your name, up to 60 characters.' }); return; }
        if (state.onboardingStep === 1 && (!(state.onboarding.risk >= .01) || state.onboarding.risk > 2 || !state.onboarding.markets.length)) { state.message = 'Select a market and set planned risk between 0.01% and 2%.'; state.messageType = 'error'; render(); return; }
        if (state.onboardingStep < 2) { state.onboardingStep++; render(); return; }
        const session = client.completeOnboarding(state.onboarding);
        const action = state.onboarding.start;
        destination = action === 'connect' ? 'connections' : action === 'manual' ? 'trades' : 'overview';
        enter(session, action); return;
      }
      state.busy = true;
      const button = form.querySelector?.('[type="submit"]');
      if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); button.textContent = 'One moment…'; }
      await Promise.resolve();
      if (form.id === 'auth-sign-up-form') {
        const result = client.beginSignUp(data);
        if (result.errors) { validation(result.errors); return; }
        show('verify-email');
      } else if (form.id === 'auth-sign-in-form') {
        const result = client.signIn(data);
        if (result.errors) { validation(result.errors); return; }
        if (result.challenge) show('mfa'); else enter(result.session);
      } else if (form.id === 'auth-code-form') {
        if (!/^\d{6}$/.test(data.code || '')) { validation({ code: 'Enter the 6-digit preview code.' }); return; }
        enter(state.route === 'mfa' ? client.verifyMfa(data.code) : client.verifyEmail(data.code));
      } else if (form.id === 'auth-forgot-form') {
        client.requestReset(data.email); show('reset-sent');
      } else if (form.id === 'auth-reset-password-form' || form.id === 'auth-password-change-form') {
        const errors = validateCredentials(data, { reset: true });
        if (form.id === 'auth-password-change-form' && !data.currentPassword) errors.currentPassword = 'Enter a sample current password.';
        if (Object.keys(errors).length) { validation(errors); return; }
        if (form.id === 'auth-reset-password-form') { client.resetPassword(data); readyUser = null; onLeave?.(); show('reset-success'); }
        else show('password-changed');
      }
    } catch (error) {
      state.busy = false;
      if (/expired/.test(error.message)) show('expired');
      else { state.message = error.message; state.messageType = 'error'; render(); }
    } finally { state.busy = false; }
  }
  function click(event) {
    const node = event.target.closest?.('[data-auth-route],[data-auth-action],[data-auth-choice],[data-auth-market]');
    if (!node) return;
    event.preventDefault?.();
    const { authRoute: route, authAction: action, authChoice: choice, authMarket: market } = node.dataset;
    if (route) {
      if (['privacy','terms','forgot-password'].includes(route)) {
        const currentForm = document.querySelector('form[id^="auth-"]');
        if (currentForm) {
          const values = Object.fromEntries(new FormData(currentForm));
          Object.assign(state.values,{email:values.email||state.values.email||'',name:values.name||state.values.name||'',remember:!!values.remember,terms:!!values.terms});
        }
      }
      if (['privacy','terms'].includes(route) && !['privacy','terms'].includes(state.route)) state.returnRoute = state.route;
      if (route === 'workspace') { destination = 'settings'; enter(client.getSession()); return; }
      if (route === 'reset-password' && client.getChallenge()?.type !== 'reset') { show('expired'); return; }
      if (['password-change','password-changed','sign-out'].includes(route) && !client.getSession()) { show('sign-in'); return; }
      if (route === 'sign-up' && client.getChallenge()) state.values.email = client.getChallenge().email;
      show(route, { preserveValues: ['sign-up','forgot-password','privacy','terms'].includes(route) });
      return;
    }
    if (choice) { captureOnboarding(document.getElementById('auth-onboarding-form')); state.onboarding[choice] = node.dataset.value; render(); return; }
    if (market) { captureOnboarding(document.getElementById('auth-onboarding-form')); const markets = state.onboarding.markets; state.onboarding.markets = markets.includes(market) ? markets.filter(m=>m!==market) : [...markets,market]; render(); return; }
    if (action === 'demo' || action === 'continue-social') { enterDemo(); return; }
    if (action === 'confirm-sign-out') { signOut({ immediate: true }); return; }
    if (action === 'toggle-password') {
      const field = document.getElementById(node.dataset.target);
      if (!field) return;
      const showPassword = field.type === 'password'; field.type = showPassword ? 'text' : 'password';
      node.textContent = showPassword ? 'Hide' : 'Show'; node.setAttribute('aria-pressed', String(showPassword)); node.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password'); return;
    }
    if (action === 'fill-code') { const input = document.getElementById('auth-code'); if (input) { input.value = '246810'; input.focus(); } return; }
    if (action === 'resend') { try { client.resend(); state.message = 'Resend preview complete. The sample code or link is ready again.'; state.messageType = 'info'; } catch (e) { state.message = e.message; state.messageType = 'error'; } render(); return; }
    if (action === 'onboarding-back') { captureOnboarding(document.getElementById('auth-onboarding-form')); state.onboardingStep = Math.max(0,state.onboardingStep-1); render(); return; }
    if (action === 'toggle-mfa') { const session = client.getSession(); if (!session) return; const result = client.setMfa(!session.user.mfa); onSession(result,{ changed:false,destination:'settings' }); return; }
    if (action === 'expire-session') { client.signOut(); readyUser = null; onLeave?.(); show('session-expired'); return; }
  }
  function passwordInput(event) {
    if (event.target.id !== 'auth-password') return;
    const quality = passwordQuality(event.target.value);
    document.querySelectorAll('.password-segments i').forEach((node,i)=>node.classList.toggle('filled',i<quality.score));
    const label = document.getElementById('password-meter-label');
    if (label) label.textContent = !event.target.value ? 'At least 12 characters' : !quality.valid ? 'Use at least 12 characters' : ['','Getting started','Good foundation','Strong password','Very strong'][quality.score];
  }
  function capsLock(event) { if (event.target.type === 'password' || event.target.id === 'auth-password') { const warning = document.getElementById('caps-lock-warning'); if (warning) warning.hidden = !event.getModifierState?.('CapsLock'); } }
  function tick() { if (!authVisible && !client.getSession()) { readyUser = null; onLeave?.(); show('session-expired'); } }
  function activity() { if (!authVisible) client.getSession({ touch:true }); }
  function storageChanged(event) {
    if (event.key !== SESSION_KEY) return;
    if (!event.newValue && !authVisible) { client.signOut(); readyUser = null; onLeave?.(); show('sign-in',{ message:'The preview session ended in another tab.' }); }
    else if (event.newValue && !authVisible) enter(client.getSession());
  }
  document.addEventListener('click',click);
  document.addEventListener('submit',submit);
  document.addEventListener('input',passwordInput);
  document.addEventListener('keyup',capsLock);
  document.addEventListener('keydown',activity);
  document.addEventListener('pointerdown',activity);
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('hashchange',handleRoute);
  window.addEventListener('storage',storageChanged);
  const timer = setInterval(tick,30000); timer.unref?.();
  function destroy() { clearInterval(timer); }
  return { start:handleRoute, handleRoute, allowWorkspace, isWorkspaceReady, enterDemo, signOut, client, state, destroy };
}
