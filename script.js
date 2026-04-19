import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, onDisconnect, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyD612DVL9xvsK1lWVyEB9TehpGJry6Rprw", 
    authDomain: "srd-portal-1234.firebaseapp.com", 
    projectId: "srd-portal-1234", 
    databaseURL: "https://srd-portal-1234-default-rtdb.firebaseio.com",
    storageBucket: "srd-portal-1234.firebasestorage.app", 
    messagingSenderId: "286585731956", 
    appId: "1:286585731956:web:47641bcf34033b014f4a21" 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let logs = [], yardLogs = [], transactionLogs = [], taskLogs = [], assets = [], currentPage = 'DASH';
let showCompleted = false, showUndocked = false, expandedSR = null;

const STATUS_OPTIONS = ["PENDING", "ITEM CREATION", "PR/MTR-RAISED", "PO-RAISED", "PAYMENT PENDING", "PART RECEIVED", "ALL RECEIVED", "OH-HOLD", "CANCELLED"];
const YARD_STATUS = ["Docked", "Undocked"];

// --- THEME LOGIC ---
window.toggleTheme = () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    document.getElementById('theme-icon').innerText = next === 'light' ? '🌙' : '☀️';
    localStorage.setItem('srd-theme', next);
};

const savedTheme = localStorage.getItem('srd-theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
document.getElementById('theme-icon').innerText = savedTheme === 'light' ? '🌙' : '☀️';

// --- AUTH & DATA ---
window.handleLogin = () => signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(() => alert("Access Denied"));
window.handleLogout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    document.getElementById('auth-overlay').style.display = user ? 'none' : 'flex';
    if(user) { initData(); setupPresence(user); }
});

function setupPresence(user) {
    const myStatusRef = ref(db, `/status/${user.uid}`);
    onValue(ref(db, '.info/connected'), (snap) => { if (snap.val()) { onDisconnect(myStatusRef).set({ state: 'offline', email: user.email }).then(() => set(myStatusRef, { state: 'online', email: user.email })); }});
    onValue(ref(db, '/status'), (snap) => {
        const data = snap.val(); let html = '';
        for (let id in data) if (data[id].state === 'online') html += `<div class="u-row"><span class="u-dot"></span>${data[id].email.split('@')[0].toUpperCase()}</div>`;
        document.getElementById('online-list').innerHTML = html;
    });
}

function initData() {
    onValue(ref(db, 'assets_registry'), snap => {
        const val = snap.val();
        assets = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if(currentPage === 'ASSETS') refreshTable();
    });
    onValue(ref(db, 'prf_logs'), snap => {
        const val = snap.val();
        logs = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if(currentPage === 'DASH') refreshTable();
    });
    onValue(ref(db, 'yard_logs'), snap => {
        const val = snap.val();
        yardLogs = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if(currentPage === 'YARD') refreshTable();
    });
    onValue(ref(db, 'transactions'), snap => {
        const val = snap.val();
        transactionLogs = val ? Object.values(val).reverse() : [];
        if(currentPage === 'TRANS') refreshTable();
    });
    onValue(ref(db, 'task_logs'), snap => {
        const val = snap.val();
        taskLogs = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if(currentPage === 'TASKS') refreshTable();
    });
}

window.switchPage = (page) => {
    currentPage = page;
    showCompleted = false; showUndocked = false; expandedSR = null;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + page.toLowerCase()).classList.add('active');
    
    document.getElementById('page-title').innerText = { 
        'YARD': 'BOAT YARD LOG', 
        'DASH': 'PRF TRACKER', 
        'TRANS': 'TRANSACTIONS',
        'TASKS': 'TASK MANAGER',
        'ASSETS': 'ASSET MANAGER'
    }[page];
    
    document.getElementById('btn-create').style.display = (page === 'TRANS') ? 'none' : 'block';
    document.getElementById('btn-toggle-comp').style.display = (page === 'DASH') ? 'flex' : 'none';
    document.getElementById('btn-toggle-undocked').style.display = (page === 'YARD') ? 'flex' : 'none';
    refreshTable();
};

window.refreshTable = () => {
    const q = document.getElementById('main-search').value.toUpperCase();
    const head = document.getElementById('table-head');
    const body = document.getElementById('table-body');

    if (currentPage === 'ASSETS') {
        head.innerHTML = `<tr><th style="width:120px;">Asset ID</th><th>Asset Name</th><th>Type</th><th style="width:100px;">Actions</th></tr>`;
        const filtered = assets.filter(a => a.name?.toUpperCase().includes(q) || a.assetCode?.toUpperCase().includes(q));
        body.innerHTML = filtered.map(a => `<tr>
            <td style="font-weight:800; color:var(--brand);">${a.assetCode}</td>
            <td style="font-weight:700;">${a.name}</td>
            <td>${a.type || 'N/A'}</td>
            <td><button onclick="deleteAsset('${a.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:18px;">&times;</button></td>
        </tr>`).join('');

    } else if (currentPage === 'YARD') {
        head.innerHTML = `<tr><th style="width:80px;">Slot</th><th>Asset Name</th><th>Owner</th><th style="width:110px;">Docked</th><th style="width:110px;">Est. Undock</th><th style="width:150px;">Status</th><th style="width:80px;">Age</th><th>Actual Undock</th><th style="width:40px;"></th></tr>`;
        const filtered = yardLogs.filter(l => {
            const assetName = assets.find(a => a.assetCode === l.assetId)?.name || '';
            const matches = assetName.toUpperCase().includes(q) || l.owner?.toUpperCase().includes(q) || l.slot?.toUpperCase().includes(q);
            return showUndocked ? (matches && l.status === 'Undocked') : (matches && l.status !== 'Undocked');
        });
        body.innerHTML = filtered.map(l => {
            const asset = assets.find(a => a.assetCode === l.assetId);
            const start = new Date(l.docked), end = l.undocked ? new Date(l.undocked) : new Date();
            const age = Math.floor((end - start) / (1000 * 60 * 60 * 24)) || 0;
            return `<tr>
                <td style="font-weight:800; color:var(--brand);">${l.slot}</td>
                <td><b style="color:var(--brand); font-size:10px;">[${l.assetId}]</b> ${asset ? asset.name : 'Unknown'}</td>
                <td>${l.owner}</td>
                <td>${l.docked}</td>
                <td>${l.estUndock || ''}</td>
                <td>
                    <select class="status-select ${l.status === 'Docked' ? 's-Docked' : 's-Undocked'}" onchange="updateYard('${l.id}', 'status', this.value)">
                        ${YARD_STATUS.map(o => `<option ${l.status==o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td><span class="age-badge">${age}D</span></td>
                <td><input type="date" value="${l.undocked || ''}" class="remarks-editor" onchange="updateYard('${l.id}', 'undocked', this.value)"></td>
                <td><button onclick="deleteYard('${l.id}')" style="background:none; border:none; cursor:pointer; color:var(--danger); font-size:18px;">&times;</button></td>
            </tr>`;
        }).join('');
        
    } else if (currentPage === 'DASH') {
        head.innerHTML = `<tr><th style="width:100px;">Date</th><th style="width:120px;">PRF #</th><th>Asset Name</th><th style="width:100px;">Workshop</th><th style="width:160px;">Status</th><th style="width:140px;">Due Date</th><th style="min-width:300px;">Remarks</th><th style="width:40px;"></th></tr>`;
        const filtered = logs.filter(l => {
            const assetName = assets.find(a => a.assetCode === l.assetId)?.name || '';
            const matches = (l.prf?.toUpperCase().includes(q) || assetName.toUpperCase().includes(q));
            return showCompleted ? (matches && l.status === 'ALL RECEIVED') : (matches && l.status !== 'ALL RECEIVED');
        });
        body.innerHTML = filtered.map(l => {
            const asset = assets.find(a => a.assetCode === l.assetId);
            const sClass = `s-${l.status.replace(/[/ ]/g, '-')}`;
            return `<tr>
                <td>${l.date}</td>
                <td style="font-weight:800; color:var(--brand);">${l.prf}</td>
                <td><b style="color:var(--brand); font-size:10px;">[${l.assetId}]</b> ${asset ? asset.name : 'Unknown'}</td>
                <td style="font-size:10px; font-weight:700; color:var(--text-muted);">${l.workshop}</td>
                <td>
                    <select class="status-select ${sClass}" onchange="updateField('${l.id}', 'status', this.value, '${l.prf}')">
                        ${STATUS_OPTIONS.map(o => `<option ${l.status==o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td><input type="date" value="${l.eta || ''}" class="remarks-editor" onchange="updateField('${l.id}', 'eta', this.value, '${l.prf}')"></td>
                <td><div class="remarks-editor" contenteditable="true" onblur="updateField('${l.id}', 'remarks', this.innerText.trim().toUpperCase(), '${l.prf}')">${l.remarks || ''}</div></td>
                <td><button onclick="deleteRow('${l.id}')" style="background:none; border:none; cursor:pointer; color:#cbd5e1; font-size:18px;">&times;</button></td>
            </tr>`;
        }).join('');
    }
    // (Other pages like TRANS/TASKS follow similar pattern...)
};

// --- ASSET MANAGEMENT ---
window.saveAsset = () => {
    const name = document.getElementById('a-name').value.toUpperCase();
    const type = document.getElementById('a-type').value;
    if(!name) return alert("Asset Name required");
    
    const assetCode = "AST-" + Math.floor(1000 + Math.random() * 9000);
    push(ref(db, 'assets_registry'), { assetCode, name, type });
    closeModal();
};

window.deleteAsset = (id) => confirm('Delete asset record?') && remove(ref(db, `assets_registry/${id}`));

// --- UPDATED SAVE PRF / YARD ---
window.savePRF = (redirect) => {
    const p = document.getElementById('m-prf').value.toUpperCase();
    const aId = document.getElementById('m-asset-select').value;
    const w = document.getElementById('m-workshop').value;
    if(!p || !aId || !w) return alert("All fields required");

    push(ref(db, 'prf_logs'), { 
        date: new Date().toLocaleDateString('en-GB'), 
        prf: p, 
        assetId: aId, // Reference the Asset ID
        workshop: w, 
        status: 'PENDING', 
        eta: '', 
        remarks: '' 
    });
    closeModal();
    if(redirect) window.open("https://forms.office.com/...", "_blank");
};

window.saveYardEntry = () => {
    const s = document.getElementById('y-slot').value;
    const aId = document.getElementById('y-asset-select').value;
    const d = document.getElementById('y-docked').value;
    if(!s || !aId || !d) return alert("Required");

    push(ref(db, 'yard_logs'), { 
        slot: s, 
        assetId: aId, 
        owner: document.getElementById('y-owner').value, 
        docked: d, 
        estUndock: document.getElementById('y-est-undock').value, 
        status: 'Docked', 
        undocked: '' 
    });
    closeModal();
};

window.openModal = () => {
    const titleMap = { 'YARD': 'REGISTER VESSEL', 'DASH': 'NEW PRF ENTRY', 'ASSETS': 'NEW ASSET REGISTRATION' };
    document.getElementById('modal-title').innerText = titleMap[currentPage] || 'NEW ENTRY';
    
    document.getElementById('prf-form').style.display = currentPage === 'DASH' ? 'block' : 'none';
    document.getElementById('yard-form').style.display = currentPage === 'YARD' ? 'block' : 'none';
    document.getElementById('asset-form').style.display = currentPage === 'ASSETS' ? 'block' : 'none';

    // Populate Asset Selectors
    if (currentPage === 'DASH' || currentPage === 'YARD') {
        const selectId = currentPage === 'DASH' ? 'm-asset-select' : 'y-asset-select';
        const el = document.getElementById(selectId);
        el.innerHTML = '<option value="">-- SELECT REGISTERED ASSET --</option>';
        assets.forEach(a => {
            el.innerHTML += `<option value="${a.assetCode}">${a.name} (${a.assetCode})</option>`;
        });
    }

    document.getElementById('entry-modal').style.display = 'flex';
};

// ... Rest of your existing functions (updateField, updateYard, deleteRow, etc.)
