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

// --- AUTH ---
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(() => alert("Denied"));
window.handleLogout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    document.getElementById('auth-overlay').style.display = user ? 'none' : 'flex';
    if(user) initData();
});

function initData() {
    onValue(ref(db, 'asset_register'), snap => {
        const val = snap.val();
        assets = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if(currentPage === 'ASSETS') refreshTable();
    });
    onValue(ref(db, 'prf_logs'), snap => {
        logs = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
        if(currentPage === 'DASH') refreshTable();
    });
    onValue(ref(db, 'yard_logs'), snap => {
        yardLogs = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
        if(currentPage === 'YARD') refreshTable();
    });
    onValue(ref(db, 'task_logs'), snap => {
        taskLogs = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
        if(currentPage === 'TASKS') refreshTable();
    });
}

// --- NAVIGATION ---
window.switchPage = (page) => {
    currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + page.toLowerCase()).classList.add('active');
    document.getElementById('page-title').innerText = page.replace('DASH', 'PRF TRACKER').replace('TRANS', 'LOGS');
    refreshTable();
};

// --- CORE TABLES ---
window.refreshTable = () => {
    const q = document.getElementById('main-search').value.toUpperCase();
    const head = document.getElementById('table-head');
    const body = document.getElementById('table-body');

    if (currentPage === 'ASSETS') {
        head.innerHTML = `<tr><th>Asset #</th><th>Name</th><th>Type</th><th>Actions</th></tr>`;
        body.innerHTML = assets.filter(a => a.name.includes(q) || a.assetNo.includes(q)).map(a => `
            <tr>
                <td style="font-weight:800; color:var(--brand);">${a.assetNo}</td>
                <td>${a.name}</td>
                <td>${a.type}</td>
                <td><button onclick="deleteAsset('${a.id}')" style="color:var(--danger); background:none; border:none;">&times;</button></td>
            </tr>`).join('');
    } else if (currentPage === 'DASH') {
        head.innerHTML = `<tr><th>PRF #</th><th>Asset</th><th>Workshop</th><th>Status</th></tr>`;
        body.innerHTML = logs.filter(l => l.prf.includes(q) || l.asset.includes(q)).map(l => `
            <tr>
                <td style="font-weight:800; color:var(--brand);">${l.prf}</td>
                <td>${l.asset}</td>
                <td>${l.workshop}</td>
                <td>${l.status}</td>
            </tr>`).join('');
    }
    // Add other page logic as needed...
};

// --- ASSET MANAGEMENT ---
window.saveAsset = () => {
    const name = document.getElementById('a-name').value.toUpperCase();
    const type = document.getElementById('a-type').value.toUpperCase();
    if(!name) return alert("Required");

    const assetNo = `AST-${1000 + assets.length + 1}`;
    push(ref(db, 'asset_register'), { assetNo, name, type, dateAdded: new Date().toLocaleDateString('en-GB') });
    closeModal();
};

window.deleteAsset = (id) => confirm('Remove asset?') && remove(ref(db, `asset_register/${id}`));

// --- MODALS ---
window.openModal = () => {
    const modalTitle = document.getElementById('modal-title');
    modalTitle.innerText = currentPage === 'ASSETS' ? 'REGISTER ASSET' : 'NEW ENTRY';
    
    document.getElementById('asset-form').style.display = currentPage === 'ASSETS' ? 'block' : 'none';
    document.getElementById('prf-form').style.display = currentPage === 'DASH' ? 'block' : 'none';
    document.getElementById('yard-form').style.display = currentPage === 'YARD' ? 'block' : 'none';
    document.getElementById('task-form').style.display = currentPage === 'TASKS' ? 'block' : 'none';

    // Populate Asset Dropdowns
    const options = `<option value="">-- Select Registered Asset --</option>` + 
                    assets.map(a => `<option value="${a.name} [${a.assetNo}]">${a.name} (${a.assetNo})</option>`).join('');
    
    ['m-asset-select', 'y-asset-select', 't-asset-select'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options;
    });

    document.getElementById('entry-modal').style.display = 'flex';
};

window.closeModal = () => document.getElementById('entry-modal').style.display = 'none';

// --- THEME ---
window.toggleTheme = () => {
    const next = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
};