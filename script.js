import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyD612DVL9xvsK1lWVyEB9TehpGJry6Rprw", 
    authDomain: "srd-portal-1234.firebaseapp.com", 
    projectId: "srd-portal-1234", 
    databaseURL: "https://srd-portal-1234-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let logs = [], yardLogs = [], assets = [], transactionLogs = [], taskLogs = [], currentPage = 'DASH';

// --- AUTH & DATA SYNC ---
onAuthStateChanged(auth, user => {
    document.getElementById('auth-overlay').style.display = user ? 'none' : 'flex';
    if(user) {
        onValue(ref(db, 'asset_register'), s => {
            assets = s.val() ? Object.keys(s.val()).map(k => ({id:k, ...s.val()[k]})) : [];
            if(currentPage === 'ASSETS') refreshTable();
        });
        onValue(ref(db, 'prf_logs'), s => {
            logs = s.val() ? Object.keys(s.val()).map(k => ({id:k, ...s.val()[k]})) : [];
            if(currentPage === 'DASH') refreshTable();
        });
        onValue(ref(db, 'yard_logs'), s => {
            yardLogs = s.val() ? Object.keys(s.val()).map(k => ({id:k, ...s.val()[k]})) : [];
            if(currentPage === 'YARD') refreshTable();
        });
    }
});

window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value);
window.handleLogout = () => signOut(auth);

// --- NAVIGATION ---
window.switchPage = (page) => {
    currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + page.toLowerCase()).classList.add('active');
    document.getElementById('page-title').innerText = page.replace('DASH','PRF TRACKER');
    refreshTable();
};

window.refreshTable = () => {
    const q = document.getElementById('main-search').value.toUpperCase();
    const head = document.getElementById('table-head');
    const body = document.getElementById('table-body');

    if(currentPage === 'ASSETS') {
        head.innerHTML = `<tr><th>Asset ID</th><th>Name</th><th>Type</th><th>Actions</th></tr>`;
        body.innerHTML = assets.filter(a => a.name.includes(q)).map(a => `
            <tr>
                <td style="font-weight:800; color:var(--brand);">${a.assetNo}</td>
                <td><input class="remarks-editor" value="${a.name}" onblur="updateField('asset_register','${a.id}','name',this.value.toUpperCase())"></td>
                <td><input class="remarks-editor" value="${a.type}" onblur="updateField('asset_register','${a.id}','type',this.value.toUpperCase())"></td>
                <td><button onclick="removeEntry('asset_register','${a.id}')" style="color:var(--danger); border:none; background:none;">&times;</button></td>
            </tr>`).join('');
    } else if(currentPage === 'YARD') {
        head.innerHTML = `<tr><th>Slot</th><th>Asset</th><th>Age</th><th>Status</th></tr>`;
        body.innerHTML = yardLogs.filter(l => l.asset.includes(q)).map(l => {
            const age = Math.floor((new Date() - new Date(l.docked)) / (1000*60*60*24));
            return `<tr>
                <td style="font-weight:800;">${l.slot}</td>
                <td>${l.asset}</td>
                <td><span class="age-badge">${age} Days</span></td>
                <td>${l.status}</td>
            </tr>`;
        }).join('');
    }
    // ... logic for other pages continues ...
};

// --- DATA ENTRY ---
window.saveAsset = () => {
    const name = document.getElementById('a-name').value.toUpperCase();
    const type = document.getElementById('a-type').value.toUpperCase();
    const assetNo = `AST-${1000 + assets.length + 1}`;
    push(ref(db, 'asset_register'), { assetNo, name, type });
    closeModal();
};

window.openModal = () => {
    // Populate Asset Selects
    const opts = `<option value="">-- Select Asset --</option>` + assets.map(a => `<option value="${a.name} [${a.assetNo}]">${a.name} (${a.assetNo})</option>`).join('');
    ['m-asset-select', 'y-asset-select', 't-asset-select'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = opts; });

    document.getElementById('asset-form').style.display = currentPage === 'ASSETS' ? 'block' : 'none';
    document.getElementById('prf-form').style.display = currentPage === 'DASH' ? 'block' : 'none';
    document.getElementById('yard-form').style.display = currentPage === 'YARD' ? 'block' : 'none';
    document.getElementById('task-form').style.display = currentPage === 'TASKS' ? 'block' : 'none';
    document.getElementById('entry-modal').style.display = 'flex';
};

window.closeModal = () => document.getElementById('entry-modal').style.display = 'none';
window.updateField = (path, id, field, val) => update(ref(db, `${path}/${id}`), {[field]: val});
window.removeEntry = (path, id) => confirm('Delete?') && remove(ref(db, `${path}/${id}`));
