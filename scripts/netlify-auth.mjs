import {
  getUser,
  handleAuthCallback,
  AuthError,
  login,
  logout,
  MissingIdentityError,
  onAuthChange,
  signup,
} from '@netlify/identity';

export function authErrorMessage(error, action = 'authenticate') {
  const status = error?.status ?? error?.cause?.status;
  if (error instanceof MissingIdentityError || error?.name === 'MissingIdentityError' || status === 404) {
    return 'Netlify Identity is not available for this site. Enable Identity in your Netlify project settings and try again.';
  }
  if (status === 401) return 'Email or password is incorrect.';
  if (status === 403) {
    return action === 'signup'
      ? 'Signups are disabled for this site. Contact the site owner.'
      : 'Netlify Identity rejected this request. Check the project Identity settings.';
  }
  if (status === 422) return error.message || 'Please check the information and try again.';
  if (error?.name === 'TypeError' || /fetch|network/i.test(error?.message || '')) {
    return 'Could not reach Netlify Identity. Check your connection and try again.';
  }
  if (error instanceof SyntaxError || /unexpected (?:token|end)|json parse/i.test(error?.message || '')) {
    return 'Netlify Identity returned an unexpected response. Please try again.';
  }
  return error?.message || 'Something went wrong. Please try again.';
}

const displayName = (user) => user?.name || user?.email || 'your account';

export function createAuthController(identity, view) {
  async function submitSignup({ name, email, password }) {
    try {
      const created = await identity.signup(email.trim(), password, { full_name: name.trim() });
      const currentUser = await identity.getUser();
      if (currentUser && created?.id && currentUser.id === created.id) {
        view.setUser(currentUser);
        view.setMessage(`Account created. Signed in as ${displayName(currentUser)}.`);
      } else {
        view.setUser(currentUser || null);
        view.setMessage(created?.confirmedAt
          ? 'Your account is confirmed. Sign in with the new account to continue.'
          : 'Check your email and follow the confirmation link to activate your account.');
      }
      view.resetSignup();
      return currentUser;
    } catch (error) {
      view.setMessage(authErrorMessage(error, 'signup'));
      return null;
    }
  }

  async function submitLogin({ email, password }) {
    try {
      const user = await identity.login(email.trim(), password);
      if (!user) throw new Error('The Identity service did not return a signed-in user.');
      view.setUser(user);
      view.setMessage(`Signed in as ${displayName(user)}.`);
      view.resetLogin();
      return user;
    } catch (error) {
      view.setMessage(authErrorMessage(error, 'login'));
      return null;
    }
  }

  async function signOut() {
    try {
      await identity.logout();
      view.setUser(null);
      view.setMessage('You are signed out.');
      return true;
    } catch (error) {
      view.setMessage(authErrorMessage(error, 'logout'));
      return false;
    }
  }

  async function initialize() {
    let callback = null;
    try {
      callback = await identity.handleAuthCallback();
    } catch (error) {
      view.setUser(null);
      view.setMessage(authErrorMessage(error));
      return;
    }

    if (callback?.type === 'recovery' || callback?.type === 'invite') {
      try {
        if (callback.type === 'recovery') await identity.logout();
      } catch {
        // The page does not support these account flows; keep the UI explicit below.
      }
      view.setUser(null);
      view.setMessage(callback.type === 'recovery'
        ? 'Password recovery is not supported on this page. Please contact the site owner.'
        : 'Invitation acceptance is not supported on this page. Please contact the site owner.');
      return;
    }

    const unsubscribe = identity.onAuthChange((event, user) => {
      if (event === 'recovery') {
        view.setMessage('Password recovery is not supported on this page. Please contact the site owner.');
        return;
      }
      view.setUser(user || null);
      if (event === 'logout') view.setMessage('You are signed out.');
      else if (user) view.setMessage(`Signed in as ${displayName(user)}.`);
    });
    view.setUnsubscribe(unsubscribe);

    const user = await identity.getUser();
    view.setUser(user || null);
    if (callback?.type === 'confirmation') {
      view.setMessage(user
        ? `Email confirmed. Signed in as ${displayName(user)}.`
        : 'Email confirmed. Sign in to continue.');
    } else if (callback?.type === 'email_change') {
      view.setMessage('Email address updated.');
    } else if (callback?.type === 'oauth') {
      view.setMessage(user ? `Signed in as ${displayName(user)}.` : 'Sign-in could not be confirmed. Please try again.');
    } else if (user) {
      view.setMessage(`Signed in as ${displayName(user)}.`);
    }
  }

  return { initialize, signOut, submitLogin, submitSignup };
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('container');
  const signInButton = document.getElementById('signIn');
  const signUpButton = document.getElementById('signUp');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const message = document.getElementById('message');
  const logoutButton = document.getElementById('logout');
  let unsubscribe = () => {};

  const controller = createAuthController({
    getUser,
    handleAuthCallback,
    login,
    logout,
    onAuthChange,
    signup,
  }, {
    setUser(user) {
      logoutButton.hidden = !user;
    },
    setMessage(text) {
      message.textContent = text;
    },
    setUnsubscribe(callback) {
      unsubscribe();
      unsubscribe = callback || (() => {});
    },
    resetSignup() {
      signupForm.reset();
    },
    resetLogin() {
      loginForm.reset();
    },
  });

  signUpButton.addEventListener('click', () => container.classList.add('right-panel-active'));
  signInButton.addEventListener('click', () => container.classList.remove('right-panel-active'));
  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    controller.submitSignup(Object.fromEntries(new FormData(signupForm)));
  });
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    controller.submitLogin(Object.fromEntries(new FormData(loginForm)));
  });
  logoutButton.addEventListener('click', () => controller.signOut());
  window.addEventListener('pagehide', () => unsubscribe(), { once: true });
  controller.initialize();
}
