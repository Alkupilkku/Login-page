import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthError } from '@netlify/identity';
import { authErrorMessage, createAuthController } from '../scripts/netlify-auth.mjs';

function harness(overrides = {}) {
  const state = { user: null, message: '', unsubscribed: null, signupReset: 0, loginReset: 0 };
  const view = {
    setUser(user) { state.user = user; },
    setMessage(message) { state.message = message; },
    setUnsubscribe(callback) { state.unsubscribed = callback; },
    resetSignup() { state.signupReset += 1; },
    resetLogin() { state.loginReset += 1; },
  };
  const identity = {
    async signup() { return { id: 'u1', email: 'sam@example.com' }; },
    async login() { return { id: 'u1', email: 'sam@example.com' }; },
    async logout() {},
    async getUser() { return null; },
    async handleAuthCallback() { return null; },
    onAuthChange() { return () => {}; },
    ...overrides,
  };
  return { controller: createAuthController(identity, view), identity, state };
}

test('unconfirmed signup shows confirmation guidance without claiming a session', async () => {
  const { controller, state } = harness();
  await controller.submitSignup({ name: 'Sam', email: ' sam@example.com ', password: 'secret1' });
  assert.equal(state.user, null);
  assert.match(state.message, /check your email/i);
  assert.equal(state.signupReset, 1);
});

test('autoconfirmed signup renders a user only when a session exists', async () => {
  const user = { id: 'u1', email: 'sam@example.com', confirmedAt: '2026-10-05T10:00:00Z' };
  const { controller, state } = harness({ async getUser() { return user; } });
  await controller.submitSignup({ name: 'Sam', email: 'sam@example.com', password: 'secret1' });
  assert.equal(state.user, user);
  assert.match(state.message, /signed in as sam@example.com/i);
});

test('signup does not confuse an existing different session with the new account', async () => {
  const existing = { id: 'old-user', email: 'existing@example.com' };
  const { controller, state } = harness({
    async signup() { return { id: 'new-user', email: 'new@example.com', confirmedAt: '2026-10-05T10:00:00Z' }; },
    async getUser() { return existing; },
  });
  await controller.submitSignup({ name: 'New', email: 'new@example.com', password: 'secret1' });
  assert.equal(state.user, existing);
  assert.match(state.message, /sign in with the new account/i);
  assert.doesNotMatch(state.message, /signed in as new@example.com/i);
});

test('confirmation callback restores a real session and reports confirmation', async () => {
  const user = { id: 'u1', email: 'sam@example.com' };
  const { controller, state } = harness({
    async handleAuthCallback() { return { type: 'confirmation', user }; },
    async getUser() { return user; },
  });
  await controller.initialize();
  assert.equal(state.user, user);
  assert.match(state.message, /email confirmed/i);
});

test('normal page load restores an existing session and listens for logout', async () => {
  const user = { id: 'u1', email: 'sam@example.com' };
  let authListener;
  const { controller, state } = harness({
    async getUser() { return user; },
    onAuthChange(callback) { authListener = callback; return () => {}; },
  });
  await controller.initialize();
  assert.equal(state.user, user);
  authListener('logout', null);
  assert.equal(state.user, null);
  assert.equal(state.message, 'You are signed out.');
});

test('logout clears the visible session after the identity client succeeds', async () => {
  let logoutCount = 0;
  const { controller, state } = harness({ async logout() { logoutCount += 1; } });
  assert.equal(await controller.signOut(), true);
  assert.equal(logoutCount, 1);
  assert.equal(state.user, null);
  assert.equal(state.message, 'You are signed out.');
});

test('unsupported recovery callback is stated clearly and clears the recovery session', async () => {
  let logoutCount = 0;
  const { controller, state } = harness({
    async handleAuthCallback() { return { type: 'recovery', user: { id: 'u1' } }; },
    async logout() { logoutCount += 1; },
  });
  await controller.initialize();
  assert.equal(logoutCount, 1);
  assert.equal(state.user, null);
  assert.match(state.message, /password recovery is not supported/i);
});

test('SDK-wrapped Identity errors and malformed responses produce helpful messages', async () => {
  assert.match(authErrorMessage({ name: 'MissingIdentityError' }), /enable Identity/i);
  assert.match(authErrorMessage(AuthError.from(Object.assign(new Error('Not Found'), { status: 404 }))), /enable Identity/i);
  assert.equal(authErrorMessage(AuthError.from(Object.assign(new Error('Unauthorized'), { status: 401 }))), 'Email or password is incorrect.');
  assert.match(authErrorMessage(new SyntaxError('Unexpected end of JSON input')), /unexpected response/i);
  const { controller, state } = harness({ async login() { throw AuthError.from(Object.assign(new Error('Unauthorized'), { status: 401 })); } });
  await controller.submitLogin({ email: 'sam@example.com', password: 'wrong' });
  assert.equal(state.user, null);
  assert.equal(state.message, 'Email or password is incorrect.');
});
