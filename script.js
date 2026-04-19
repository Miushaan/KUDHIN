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

let logs = [], yardLogs = [], assets = [], transLogs = [], taskLogs = [], currentPage = 'DASH';

// --- AUTH ---
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(() => alert("Access Denied"));
window.handleLogout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    document.getElementById('auth-overlay').style.display = user ? 'none' : 'flex';
    if(user) initData();
});

function initData() {
    onValue(ref(db, 'asset_register'), snap => {
        assets = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
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
    onValue(ref(db, 'transactions'), snap => {
        transLogs = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
        if(currentPage === 'TRANS') refreshTable();
    });
}

// --- CORE FUNCTIONS ---
window.switchPage = (page) => {
    currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + page.toLowerCase()).classList.add('active');
    document.getElementById('page-title').innerText = page.replace('DASH','PRF TRACKER').replace('TRANS','LOGS');
    refreshTable();
};

window.refreshTable = () => {
    const q = document.getElementById('main-search').value.toUpperCase();
    const head = document.getElementById('table-head');
    const body = document.getElementById('table-body');

    if (currentPage === 'ASSETS') {
        head.innerHTML = `<tr><th>Asset ID</th><th>Vessel Name</th><th>Type</th><th>Added Date</th><th style="width:40px"></th></tr>`;
        body.innerHTML = assets.filter(a => a.name?.includes(q) || a.assetNo?.includes(q)).map(a => `
            <tr>
                <td style="font-weight:800; color:var(--brand);">${a.assetNo}</td>
                <td><input class="remarks-editor" value="${a.name}" onblur="updateField('asset_register','${a.id}','name',this.value.toUpperCase())"></td>
                <td><input class="remarks-editor" value="${a.type}" onblur="updateField('asset_register','${a.id}','type',this.value.toUpperCase())"></td>
                <td>${a.dateAdded}</td>
                <td><button onclick="deleteEntry('asset_register','${a.id}')" style="color:var(--danger); border:none; background:none;">&times;</button></td>
            </tr>`).join('');
    } else if (currentPage === 'YARD') {
        head.innerHTML = `<tr><th>Slot</th><th>Asset</th><th>Docked</th><th>Age</th><th>Status</th><th>Actions</th></tr>`;
        body.innerHTML = yardLogs.filter(l => l.asset?.includes(q)).map(l => {
            const age = Math.floor((new Date() - new Date(l.docked)) / (1000*60*60*24));
            return `<tr>
                <td style="font-weight:700;">${l.slot}</td>
                <td>${l.asset}</td>
                <td>${l.docked}</td>
                <td><span class="age-badge">${age} Days</span></td>
                <td>
                    <select class="status-select" onchange="updateField('yard_logs','${l.id}','status',this.value)">
                        <option value="Docked" ${l.status==='Docked'?'selected':''}>Docked</option>
                        <option value="Undocked" ${l.status==='Undocked'?'selected':''}>Undocked</option>
                    </select>
                </td>
                <td><button onclick="deleteEntry('yard_logs','${l.id}')" style="color:var(--danger); border:none; background:none;">&times;</button></td>
            </tr>`;
        }).join('');
    } else if (currentPage === 'DASH') {
        head.innerHTML = `<tr><th>PRF #</th><th>Asset</th><th>Workshop</th><th>Status</th><th>Remarks</th></tr>`;
        body.innerHTML = logs.filter(l => l.prf?.includes(q) || l.asset?.includes(q)).map(l => `
            <tr>
                <td style="font-weight:800; color:var(--brand);">${l.prf}</td>
                <td>${l.asset}</td>
                <td>${l.workshop}</td>
                <td>
                    <select class="status-select" onchange="updateField('prf_logs','${l.id}','status',this.value)">
                        <option value="Pending" ${l.status==='Pending'?'selected':''}>Pending</option>
                        <option value="Approved" ${l.status==='Approved'?'selected':''}>Approved</option>
                        <option value="Rejected" ${l.status==='Rejected'?'selected':''}>Rejected</option>
                    </select>
                </td>
                <td><input class="remarks-editor" value="${l.remarks||''}" onblur="updateField('prf_logs','${l.id}','remarks',this.value.toUpperCase())"></td>
            </tr>`).join('');
    }
};

window.updateField = (path, id, field, val) => {
    update(ref(db, `${path}/${id}`), { [field]: val });
    logAction(id, `Updated ${field}`);
};

window.deleteEntry = (path, id) => confirm('Confirm deletion?') && remove(ref(db, `${path}/${id}`));

// --- SAVING ---
window.saveAsset = () => {
    const name = document.getElementById('a-name').value.toUpperCase();
    const type = document.getElementById('a-type').value.toUpperCase();
    if(!name) return alert("Missing name");
    const assetNo = `AST-${1000 + assets.length + 1}`;
    push(ref(db, 'asset_register'), { assetNo, name, type, dateAdded: new Date().toLocaleDateString('en-GB') });
    closeModal();
};

window.savePRF = () => {
    const prf = document.getElementById('m-prf').value.toUpperCase();
    const asset = document.getElementById('m-asset-select').value;
    const workshop = document.getElementById('m-workshop').value;
    push(ref(db, 'prf_logs'), { prf, asset, workshop, status: 'Pending', date: new Date().toLocaleDateString('en-GB') });
    closeModal();
};

// --- MODALS ---
window.openModal = () => {
    const assetDropdowns = ['m-asset-select', 'y-asset-select', 't-asset-select'];
    const opts = `<option value="">-- Choose Asset --</option>` + assets.map(a => `<option value="${a.name} [${a.assetNo}]">${a.name} (${a.assetNo})</option>`).join('');
    assetDropdowns.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = opts; });

    document.getElementById('asset-form').style.display = currentPage === 'ASSETS' ? 'block' : 'none';
    document.getElementById('prf-form').style.display = currentPage === 'DASH' ? 'block' : 'none';
    document.getElementById('yard-form').style.display = currentPage === 'YARD' ? 'block' : 'none';
    document.getElementById('task-form').style.display = currentPage === 'TASKS' ? 'block' : 'none';
    document.getElementById('entry-modal').style.display = 'flex';
};

window.closeModal = () => document.getElementById('entry-modal').style.display = 'none';

window.toggleTheme = () => {
    const current = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
};

function logAction(id, action) {
    push(ref(db, 'transactions'), {
        time: new Date().toLocaleString(),
        ref: id,
        action: action,
        user: auth.currentUser.email
    });
}
