const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

/* INIT VALIDATION */
document.addEventListener('DOMContentLoaded', () => {
  const name = document.getElementById('signupName');
  const email = document.getElementById('signupEmail');
  const pass = document.getElementById('signupPassword');
  const confirm = document.getElementById('confirmPassword');

  if (name) name.addEventListener('input', validateName);
  if (email) email.addEventListener('input', validateEmail);
  if (pass) pass.addEventListener('input', validatePassword);
  if (confirm) confirm.addEventListener('input', checkPasswordMatch);
});

/* UI CONTROLS */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', tab === 'login' ? i === 0 : i === 1);
  });
  document.getElementById('loginPanel').classList.toggle('active', tab === 'login');
  document.getElementById('signupPanel').classList.toggle('active', tab === 'signup');
  hideAlert();
}

/* ALERT */
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertMsg');
  el.className = `alert-msg ${type}`;
  document.getElementById('alertText').textContent = msg;
}

function hideAlert() {
  document.getElementById('alertMsg').className = 'alert-msg hidden';
}

/* LOADING */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Please wait...'
    : (btnId === 'loginBtn'
      ? '<i class="fas fa-sign-in-alt"></i> Sign In'
      : '<i class="fas fa-user-plus"></i> Create Account');
}

/* LOGIN */
async function handleLogin() {
  hideAlert();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('Please fill in all fields.');
    return;
  }

  setLoading('loginBtn', true);

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);

    const userDoc = await db.collection('users').doc(cred.user.uid).get();

    if (!userDoc.exists) {
      showAlert('User data not found. Please contact admin.');
      return;
    }

    const role = userDoc.data().role;
    
    // ROUTING FIX
    if (role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'home.html';
    }

  } catch (err) {
    showAlert(getFriendlyError(err.code));
  } finally {
    setLoading('loginBtn', false);
  }
}

/* PASSWORD STRENGTH */
function checkPasswordStrength(val) {
  const bar = document.getElementById('strengthBar');

  if (!val) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'block';

  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score++;

  const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  ['seg1', 'seg2', 'seg3', 'seg4'].forEach((id, i) => {
    document.getElementById(id).style.background =
      i < score ? colors[score - 1] : '#e5e7eb';
  });

  const txt = document.getElementById('strengthText');
  txt.textContent = labels[score - 1] || '';
  txt.style.color = colors[score - 1] || '#6b7280';

  if (document.getElementById('confirmPassword')?.value) {
    checkPasswordMatch();
  }
}

/*PASSWORD MATCH*/
function checkPasswordMatch() {
  const pass = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  const msg = document.getElementById('matchMsg');

  if (!confirm) {
    msg.style.display = 'none';
    return;
  }

  msg.style.display = 'block';

  if (pass === confirm) {
    msg.textContent = '✓ Passwords match';
    msg.style.color = '#38a169';
  } else {
    msg.textContent = '✗ Passwords do not match';
    msg.style.color = '#e53e3e';
  }
}

/*VALIDATION*/
function validateName() {
  const el = document.getElementById('signupName');
  const regex = /^[a-zA-Z\u0600-\u06FF\s]{2,50}$/;

  if (!regex.test(el.value)) {
    el.classList.add('error');
    return false;
  }

  el.classList.remove('error');
  el.classList.add('success');
  return true;
}

function validateEmail() {
  const el = document.getElementById('signupEmail');
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regex.test(el.value)) {
    el.classList.add('error');
    return false;
  }

  el.classList.remove('error');
  el.classList.add('success');
  return true;
}

function validatePassword() {
  const el = document.getElementById('signupPassword');

  if (el.value.length < 6) {
    el.classList.add('error');
    return false;
  }

  el.classList.remove('error');
  el.classList.add('success');
  return true;
}

/* SIGNUP */
async function handleSignup() {
  hideAlert();

  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  const role = document.getElementById('selectedRole').value;

  if (!validateName()) return showAlert('Name must contain letters only');
  if (!validateEmail()) return showAlert('Invalid email');
  if (!validatePassword()) return showAlert('Password must be 6+ characters');
  if (password !== confirm) return showAlert('Passwords do not match');

  setLoading('signupBtn', true);

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(cred.user.uid).set({
      name,
      email,
      role,
      createdAt: new Date().toISOString()
    });

    await cred.user.updateProfile({ displayName: name });

    showAlert('Account created!', 'success');

    setTimeout(() => {
      if (role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'home.html';
      }
    }, 1200);

  } catch (err) {
    showAlert(getFriendlyError(err.code));
  } finally {
    setLoading('signupBtn', false);
  }
}

/* RESET PASSWORD */
async function resetPassword() {
  const email = document.getElementById('loginEmail').value.trim();

  if (!email) return showAlert('Enter email first');

  try {
    await auth.sendPasswordResetEmail(email);
    showAlert('Reset email sent', 'success');
  } catch (err) {
    showAlert(getFriendlyError(err.code));
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.querySelector('.form-panel.active')?.id;

    if (active === 'loginPanel') handleLogin();
    if (active === 'signupPanel') handleSignup();
  }
});

function getFriendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found',
    'auth/wrong-password': 'Wrong password',
    'auth/email-already-in-use': 'Email already used',
    'auth/weak-password': 'Weak password',
    'auth/invalid-email': 'Invalid email'
  };

  return map[code] || 'Error occurred';
}
