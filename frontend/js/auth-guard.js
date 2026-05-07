(function() {
  const pageRole = document.querySelector('meta[name="required-role"]')?.content || 'nurse';

  firebase.auth().onAuthStateChanged(async function(user) {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();

      if (!userDoc.exists) {
        firebase.auth().signOut();
        window.location.href = 'login.html';
        return;
      }

      const userData = userDoc.data();
      const userRole = String(userData && userData.role ? userData.role : '')
        .trim()
        .toLowerCase();

      if (pageRole === 'admin' && userRole !== 'admin') {
        window.location.href = 'home.html';
        return;
      }

      if (pageRole === 'nurse' && userRole === 'admin') {
        window.location.href = 'admin-dashboard.html';
        return;
      }

      window.currentUser = {
        uid:   user.uid,
        name:  userData.name,
        email: userData.email,
        role:  userRole
      };
      document.body.style.visibility = 'visible';

      const userNameEl = document.getElementById('currentUserName');
      if (userNameEl) userNameEl.textContent = userData.name;

      const userRoleEl = document.getElementById('currentUserRole');
      if (userRoleEl) {
        if (userRole === 'admin') {
          userRoleEl.textContent = 'Administrator';
        } else if (userRole === 'nurse') {
          userRoleEl.textContent = 'Nurse';
        } else {
          userRoleEl.textContent = 'Medical Staff';
        }
      }

    } catch(e) {
      console.error('Auth guard error:', e);
      window.location.href = 'login.html';
    }
  });

  window.signOut = function() {
    if (confirm('Are you sure you want to sign out?')) {
      firebase.auth().signOut().then(() => {
        window.location.href = 'login.html';
      });
    }
  };
})();