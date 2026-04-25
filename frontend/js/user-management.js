let allUsers = [];

// Load all users from Firestore 
async function loadUsers() {
try {
const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
updateStats();
renderTable(allUsers);
} catch (e) {
console.error('Load users error:', e);
showToast('❌ Failed to load users', 'error');
}
}

// Stats 
function updateStats() {
const total    = allUsers.length;
const disabled = allUsers.filter(u => u.disabled).length;
const active   = total - disabled;

document.getElementById('totalUsers').textContent    = total;
document.getElementById('activeUsers').textContent   = active;
document.getElementById('disabledUsers').textContent = disabled;
}

// Render Table 
function renderTable(users) {
const loading  = document.getElementById('loadingState');
const empty    = document.getElementById('emptyState');
const tableWrap = document.getElementById('tableWrap');
const tbody    = document.getElementById('usersTableBody');

loading.style.display = 'none';

if (!users.length) {
empty.style.display   = 'flex';
tableWrap.style.display = 'none';
return;
}

empty.style.display    = 'none';
tableWrap.style.display = 'block';

tbody.innerHTML = users.map(u => {
const initials   = (u.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
const isAdmin    = u.role === 'admin';
const isDisabled = !!u.disabled;
const date       = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

return `
  <tr>
    <td>
      <div class="user-cell">
        <div class="user-avatar ${isAdmin ? 'avatar-admin' : 'avatar-nurse'}">${initials}</div>
        <span class="user-name">${escapeHtml(u.name || '—')}</span>
      </div>
    </td>
    <td>${escapeHtml(u.email || '—')}</td>
    <td>
      <span class="role-badge ${isAdmin ? 'admin' : 'nurse'}">
        <i class="fas ${isAdmin ? 'fa-user-shield' : 'fa-user-nurse'}"></i>
        ${isAdmin ? 'Admin' : 'Medical Staff'}
      </span>
    </td>
    <td><span class="date-cell">${date}</span></td>
    <td>
      <span class="status-badge ${isDisabled ? 'disabled' : 'active'}">
        <span class="status-dot"></span>
        ${isDisabled ? 'Disabled' : 'Active'}
      </span>
    </td>
    <td>
      <div class="action-btns">
        <button
          class="action-btn toggle-btn ${isDisabled ? 'is-disabled' : ''}"
          title="${isDisabled ? 'Enable account' : 'Disable account'}"
          onclick="confirmToggle('${u.id}', '${escapeHtml(u.name)}', ${isDisabled})">
          <i class="fas ${isDisabled ? 'fa-user-check' : 'fa-user-slash'}"></i>
        </button>
        <button
          class="action-btn delete-btn"
          title="Delete account"
          onclick="confirmDelete('${u.id}', '${escapeHtml(u.name)}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </td>
  </tr>
`;

}).join('');
}

// Filter 
function filterUsers() {
const search = document.getElementById('searchInput').value.toLowerCase();
const role   = document.getElementById('roleFilter').value;
const status = document.getElementById('statusFilter').value;

const filtered = allUsers.filter(u => {
const matchSearch = !search ||
(u.name  || '').toLowerCase().includes(search) ||
(u.email || '').toLowerCase().includes(search);

const matchRole = !role || u.role === role;

const matchStatus = !status ||
  (status === 'active'   && !u.disabled) ||
  (status === 'disabled' &&  u.disabled);

return matchSearch && matchRole && matchStatus;
});

renderTable(filtered);
}

// Toggle Disable / Enable 
function confirmToggle(uid, name, isCurrentlyDisabled) {
const action = isCurrentlyDisabled ? 'enable' : 'disable';
showModal({
icon:    isCurrentlyDisabled ? '✅' : '⚠️',
title:   isCurrentlyDisabled ? `Enable "${name}"?` : `Disable "${name}"?`,
msg:     isCurrentlyDisabled
? 'This account will be reactivated and the user can log in again.'
: 'This account will be disabled. The user will not be able to log in.',
btnText:  isCurrentlyDisabled ? 'Enable' : 'Disable',
btnClass: isCurrentlyDisabled ? 'success' : 'warning',
onConfirm: () => toggleUser(uid, isCurrentlyDisabled)
});
}

async function toggleUser(uid, isCurrentlyDisabled) {
closeModal();
try {
await db.collection('users').doc(uid).update({ disabled: !isCurrentlyDisabled });

// Update local array
const user = allUsers.find(u => u.id === uid);
if (user) user.disabled = !isCurrentlyDisabled;

updateStats();
filterUsers();
showToast(isCurrentlyDisabled ? '✅ Account enabled' : '⚠️ Account disabled');

} catch (e) {
console.error('Toggle error:', e);
showToast('❌ Failed to update account', 'error');
}
}

// Delete 
function confirmDelete(uid, name) {
showModal({
icon:    '🗑️',
title:   `Delete "${name}"?`,
msg:     'This will permanently remove the account from Firestore. This action cannot be undone.',
btnText:  'Delete',
btnClass: 'confirm',
onConfirm: () => deleteUser(uid)
});
}

async function deleteUser(uid) {
closeModal();
try {
await db.collection('users').doc(uid).delete();

allUsers = allUsers.filter(u => u.id !== uid);
updateStats();
filterUsers();
showToast('🗑️ Account deleted');

} catch (e) {
console.error('Delete error:', e);
showToast('❌ Failed to delete account', 'error');
}
}

// Modal
let _modalConfirm = null;

function showModal({ icon, title, msg, btnText, btnClass, onConfirm }) {
document.getElementById('modalIcon').textContent    = icon;
document.getElementById('modalTitle').textContent   = title;
document.getElementById('modalMsg').textContent     = msg;

const confirmBtn = document.getElementById('modalConfirmBtn');
confirmBtn.textContent = btnText;
confirmBtn.className   = `modal-btn confirm ${btnClass}`;

_modalConfirm = onConfirm;
confirmBtn.onclick = _modalConfirm;

document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
document.getElementById('modalOverlay').style.display = 'none';
_modalConfirm = null;
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', function(e) {
if (e.target === this) closeModal();
});

// Toast 
function showToast(msg) {
const toast = document.getElementById('toast');
toast.textContent = msg;
toast.classList.add('show');
setTimeout(() => toast.classList.remove('show'), 3000);
}

// Helpers 
function escapeHtml(str) {
return String(str)
.replace(/&/g,'&amp;')
.replace(/</g,'&lt;')
.replace(/>/g,'&gt;')
.replace(/"/g,'"')
.replace(/'/g,"'");
}

// Init 
// Wait for auth-guard to set window.currentUser then load
const _waitForAuth = setInterval(() => {
if (window.currentUser) {
clearInterval(_waitForAuth);
loadUsers();
}
}, 100);