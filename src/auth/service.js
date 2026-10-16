/**
 * Preview-only auth state machine. No password, hash, token, or credential is
 * stored or sent. Replace this adapter with server-verified authentication
 * before enabling real accounts. These sessions only control preview screens.
 */
export const AUTH_MODE = 'preview';
export const DEMO_CODE = '246810';
export const SESSION_KEY = 'edgebook.auth.preview.session.v1';
const PROFILES_KEY = 'edgebook.auth.preview.profiles.v1';
const CHALLENGE_KEY = 'edgebook.auth.preview.challenge.v1';
export const IDLE_LIMIT = 30 * 60 * 1000;
export function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
export function passwordQuality(value = '') {
  const checks = [value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^a-zA-Z0-9\s]/.test(value)];
  return { valid: value.length >= 12 && value.length <= 128, score: checks.filter(Boolean).length, checks };
}
export function validateCredentials(data, { signup = false, reset = false } = {}) {
  const errors = {};
  if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || '').trim())) errors.email = 'Enter a valid email address.';
  if (signup && !String(data.name || '').trim()) errors.name = 'Enter your name.';
  if (signup && String(data.name).trim().length > 60) errors.name = 'Use 60 characters or fewer.';
  if (!data.password) errors.password = 'Enter a password.';
  else if ((signup || reset) && !passwordQuality(data.password).valid) errors.password = 'Use between 12 and 128 characters.';
  if (reset && data.password !== data.confirmPassword) errors.confirmPassword = 'Your passwords do not match.';
  if (signup && !data.terms) errors.terms = 'Please acknowledge the preview terms to continue.';
  return errors;
}
export function createPreviewAuth({ local = memoryStorage(), tab = memoryStorage(), now = Date.now } = {}) {
  let volatileSession = null;
  const read = (storage, key, fallback = null) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const remove = (storage, key) => { try { storage.removeItem(key); } catch {} };
  const profiles = () => read(local, PROFILES_KEY, {});
  const cleanEmail = email => String(email).trim().toLowerCase().slice(0, 254);
  const saveProfile = profile => { const all = profiles(); all[profile.email] = profile; write(local, PROFILES_KEY, all); return profile; };
  const profileFor = (email, name) => profiles()[email] || { id: email === 'trader@edgebook.demo' ? 'demo' : 'preview:' + encodeURIComponent(email), email, name: name || email.split('@')[0], verified: true, onboardingComplete: email === 'trader@edgebook.demo', mfa: false };
  function saveSession(user, remember = false) {
    const session = { id: 'preview-' + now(), mode: 'preview', user, remember, createdAt: now(), lastActiveAt: now(), expiresAt: now() + (remember ? 7 : 1) * 86400000 };
    remove(local, SESSION_KEY); remove(tab, SESSION_KEY);
    volatileSession = session;
    write(remember ? local : tab, SESSION_KEY, session);
    return session;
  }
  function getSession({ touch = false } = {}) {
    const session = read(local, SESSION_KEY) || read(tab, SESSION_KEY) || volatileSession;
    if (!session || session.mode !== 'preview' || !session.user?.id || !session.user?.email || !Number.isFinite(session.expiresAt) || !Number.isFinite(session.lastActiveAt)) return null;
    if (session.expiresAt <= now() || session.lastActiveAt + IDLE_LIMIT <= now()) { signOut(); return null; }
    if (touch && now() - session.lastActiveAt > 15000) {
      session.lastActiveAt = now(); volatileSession = session;
      write(session.remember ? local : tab, SESSION_KEY, session);
    }
    return session;
  }
  function signOut() { volatileSession = null; remove(local, SESSION_KEY); remove(tab, SESSION_KEY); remove(tab, CHALLENGE_KEY); }
  function challenge(type, data) {
    const value = { type, ...data, createdAt: now(), expiresAt: now() + (type === 'reset' ? 30 : 10) * 60000, resentAt: now() };
    write(tab, CHALLENGE_KEY, value); return value;
  }
  function getChallenge() { const c = read(tab, CHALLENGE_KEY); return c && c.expiresAt > now() ? c : null; }
  function requireChallenge(type) { const c = getChallenge(); if (!c || c.type !== type) throw Error('This preview link has expired. Start the flow again.'); return c; }
  function beginSignUp(data) {
    const errors = validateCredentials(data, { signup: true });
    if (Object.keys(errors).length) return { errors };
    // Deliberately discard the submitted password. Only preview profile details remain.
    return { challenge: challenge('verify', { email: cleanEmail(data.email), name: data.name.trim() }) };
  }
  function verifyEmail(code) {
    const c = requireChallenge('verify');
    if (String(code).replace(/\s/g, '') !== DEMO_CODE) throw Error('That code does not match. Use the preview code 246810.');
    const user = saveProfile({ ...profileFor(c.email, c.name), name: c.name, verified: true, onboardingComplete: false });
    remove(tab, CHALLENGE_KEY); return saveSession(user);
  }
  function signIn(data) {
    const errors = validateCredentials(data);
    if (Object.keys(errors).length) return { errors };
    const user = profileFor(cleanEmail(data.email));
    if (user.mfa) return { challenge: challenge('mfa', { email: user.email, remember: !!data.remember }) };
    return { session: saveSession(user, !!data.remember) };
  }
  function verifyMfa(code) {
    const c = requireChallenge('mfa');
    if (String(code).replace(/\s/g, '') !== DEMO_CODE) throw Error('Use the preview verification code 246810.');
    const user = profileFor(c.email); remove(tab, CHALLENGE_KEY); return saveSession(user, c.remember);
  }
  function resend() {
    const c = getChallenge(); if (!c) throw Error('This preview has expired. Start again.');
    const remaining = Math.max(0, 30 - Math.floor((now() - c.resentAt) / 1000));
    if (remaining) throw Error(`Try again in ${remaining} seconds.`);
    c.resentAt = now(); c.expiresAt = now() + (c.type === 'reset' ? 30 : 10) * 60000;
    write(tab, CHALLENGE_KEY, c); return c;
  }
  function requestReset(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) throw Error('Enter a valid email address.');
    return challenge('reset', { email: cleanEmail(email) });
  }
  function resetPassword(data) {
    requireChallenge('reset');
    const errors = validateCredentials(data, { reset: true });
    if (Object.keys(errors).length) return { errors };
    remove(tab, CHALLENGE_KEY); signOut(); return { success: true };
  }
  function completeOnboarding(data) {
    const session = getSession(); if (!session) throw Error('Your preview session has expired. Sign in again.');
    const user = saveProfile({ ...session.user, ...data, id: session.user.id, email: session.user.email, name: String(data.name || session.user.name).trim().slice(0, 60), onboardingComplete: true });
    return saveSession(user, session.remember);
  }
  function setMfa(enabled) {
    const session = getSession(); if (!session) throw Error('Sign in to continue.');
    const user = saveProfile({ ...session.user, mfa: !!enabled }); return saveSession(user, session.remember);
  }
  function enterDemo() {
    const user = profileFor('trader@edgebook.demo', 'Anas Ayub');
    user.onboardingComplete = true; return saveSession(saveProfile(user));
  }
  return { getSession, signOut, beginSignUp, verifyEmail, signIn, verifyMfa, requestReset, resetPassword, getChallenge, resend, completeOnboarding, setMfa, enterDemo, mode: AUTH_MODE };
}
export function safeDestination(value, allowed) { return allowed.includes(value) ? value : 'overview'; }
