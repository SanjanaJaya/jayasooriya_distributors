// =====================================================
// JAYASOORIYA DISTRIBUTORS — app.js
// Tyre Distribution Management System
// =====================================================

// ── Supabase Configuration ──
// IMPORTANT: Replace SUPABASE_KEY below with your actual anon key from:
//   Supabase Dashboard → Settings → API → "anon public" key
const SUPABASE_URL = 'https://hyberxnmbluynnuibxuq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5YmVyeG5tYmx1eW5udWlieHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjY0ODYsImV4cCI6MjA5ODMwMjQ4Nn0.2lirewUgARdoreMDOUXkGiZnhaxQjPTA5996WFlM_VI';

let supabaseClient = null;
let currentUser = null;
let currentPage = 'dashboard';

// ── In-memory data caches ──
let outletsCache = [];
let productsCache = [];
let billsCache = [];
let givenChequesCache = [];
let receivedChequesCache = [];

let outletView = 'grid';   // 'grid' | 'list'
let productView = 'grid';  // 'grid' | 'list'

// ── Countdown interval ref ──
let countdownInterval = null;

// =====================================================
// SUPABASE INIT
// =====================================================
function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

// =====================================================
// DARK MODE
// =====================================================
function initDarkMode() {
    const btn = document.querySelector('#darkModeToggle button');
    if (!btn) return;

    const saved = localStorage.getItem('jd_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.body.classList.add('dark-mode');
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('jd_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
function showToast(message, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    let container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
    toast.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 320);
    }, duration);
}

// =====================================================
// CONFIRM DIALOG
// =====================================================
function showConfirm(message, onYes, onNo = null) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-box">
            <span class="confirm-icon">⚠️</span>
            <div class="confirm-title">Confirm Action</div>
            <div class="confirm-msg">${message}</div>
            <div class="confirm-btns">
                <button class="btn confirm-yes">Yes, proceed</button>
                <button class="btn confirm-no">Cancel</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-yes').addEventListener('click', () => { overlay.remove(); if (onYes) onYes(); });
    overlay.querySelector('.confirm-no').addEventListener('click',  () => { overlay.remove(); if (onNo) onNo(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); if (onNo) onNo(); } });
}

// =====================================================
// CURRENCY FORMAT
// =====================================================
function fmtLKR(value) {
    const num = parseFloat(value) || 0;
    return 'LKR ' + num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =====================================================
// COUNTDOWN HELPER
// =====================================================
function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function buildCountdownBadge(dateStr) {
    if (!dateStr) return '<span class="cheque-countdown safe">—</span>';
    const days = getDaysUntil(dateStr);
    if (days === null) return '';

    if (days < 0) {
        return `<span class="cheque-countdown overdue">🔴 Overdue by ${Math.abs(days)}d</span>`;
    } else if (days === 0) {
        return `<span class="cheque-countdown urgent">🔴 TODAY</span>`;
    } else if (days <= 3) {
        return `<span class="cheque-countdown urgent">🔴 ${days}d left</span>`;
    } else if (days <= 7) {
        return `<span class="cheque-countdown warning">🟠 ${days}d left</span>`;
    } else {
        return `<span class="cheque-countdown safe">🟢 ${days}d left</span>`;
    }
}

// =====================================================
// SKELETON LOADER
// =====================================================
function showTableSkeleton(tbodyId, cols, rows = 5) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: rows }, () =>
        `<tr class="skeleton-table-row">${Array.from({ length: cols }, () => '<td><span></span></td>').join('')}</tr>`
    ).join('');
}

// =====================================================
// PAGINATION HELPER
// =====================================================
function createPagination(containerId, data, renderRowFn, tableBodyId, colCount, pageSize = 25) {
    let page = 1;
    const totalPages = () => Math.max(1, Math.ceil(data.length / pageSize));

    function render() {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;
        const start = (page - 1) * pageSize;
        const slice = data.slice(start, start + pageSize);
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr class="no-data-row"><td colspan="${colCount}" style="text-align:center;padding:40px;color:var(--text-muted);">No records found</td></tr>`;
        } else {
            slice.forEach(item => { const row = renderRowFn(item); if (row) tbody.appendChild(row); });
        }
        renderBar();
    }

    function renderBar() {
        let bar = document.getElementById(containerId + '_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = containerId + '_bar';
            bar.className = 'pagination-bar';
            const cont = document.getElementById(containerId);
            if (cont) cont.after(bar);
        }
        const tp = totalPages();
        if (tp <= 1) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        const range = [];
        if (tp <= 7) { for (let i = 1; i <= tp; i++) range.push(i); }
        else {
            range.push(1);
            if (page > 3) range.push('...');
            for (let i = Math.max(2, page - 1); i <= Math.min(tp - 1, page + 1); i++) range.push(i);
            if (page < tp - 2) range.push('...');
            range.push(tp);
        }
        let btns = `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} data-action="prev">‹</button>`;
        range.forEach(p => {
            if (p === '...') btns += `<span class="pagination-btn" style="cursor:default;border:none;">…</span>`;
            else btns += `<button class="pagination-btn${p === page ? ' active' : ''}" data-pg="${p}">${p}</button>`;
        });
        btns += `<button class="pagination-btn" ${page === tp ? 'disabled' : ''} data-action="next">›</button>`;
        const s = (page - 1) * pageSize + 1, e = Math.min(page * pageSize, data.length);
        bar.innerHTML = `<span class="pagination-info">Showing ${s}–${e} of ${data.length}</span><div class="pagination-btns">${btns}</div>`;
        bar.querySelector('[data-action="prev"]')?.addEventListener('click', () => { if (page > 1) { page--; render(); } });
        bar.querySelector('[data-action="next"]')?.addEventListener('click', () => { if (page < tp) { page++; render(); } });
        bar.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => { page = parseInt(b.dataset.pg); render(); }));
    }

    render();
    return { refresh: render };
}

// =====================================================
// HAMBURGER MENU
// =====================================================
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburgerMenu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');

    if (!hamburger) return;

    hamburger.addEventListener('click', e => {
        e.stopPropagation();
        sidebar?.classList.toggle('mobile-open');
        hamburger.classList.toggle('active');
        overlay?.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar?.classList.remove('mobile-open');
        hamburger.classList.remove('active');
        overlay.classList.remove('active');
    });
}

// =====================================================
// PAGE NAVIGATION
// =====================================================
const PAGE_TITLES = {
    'dashboard':        'Dashboard',
    'outlets':          'Outlets',
    'products':         'Products (Tyres)',
    'bills':            'Bills',
    'given-cheques':    'Given Cheques',
    'received-cheques': 'Received Cheques',
};

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(page);
    if (el) el.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = PAGE_TITLES[page] || 'Dashboard';

    currentPage = page;

    // Close mobile menu
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.getElementById('hamburgerMenu')?.classList.remove('active');
    document.getElementById('mobileOverlay')?.classList.remove('active');

    // Lazy load per page
    if (page === 'dashboard')        loadDashboard();
    if (page === 'outlets')          loadOutlets();
    if (page === 'products')         loadProducts();
    if (page === 'bills')            loadBills();
    if (page === 'given-cheques')    loadGivenCheques();
    if (page === 'received-cheques') loadReceivedCheques();
}

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchPage(item.dataset.page));
    });
}

// =====================================================
// AUTH
// =====================================================
function showLogin() {
    document.getElementById('loginModal')?.classList.add('active');
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
}

function showApp() {
    document.getElementById('loginModal')?.classList.remove('active');
    document.querySelector('.sidebar').style.display = 'flex';
    document.querySelector('.main-content').style.display = 'flex';
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
}

async function initializeApp() {
    initSupabase();
    initDarkMode();
    initHamburgerMenu();
    initNavigation();

    // Set today's date on date inputs
    const today = new Date().toISOString().split('T')[0];
    ['billDate', 'gcDate', 'rcReceivedDate', 'rcRealizingDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    // Set current month on bill filter and dashboard month filter
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const billMonthEl = document.getElementById('billMonthFilter');
    if (billMonthEl) billMonthEl.value = monthStr;
    const dashMonthEl = document.getElementById('dashMonthFilter');
    if (dashMonthEl) dashMonthEl.value = monthStr;

    if (!supabaseClient) {
        showLogin();
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = session.user;
            showApp();
            loadDashboard();
            // Pre-load caches
            setTimeout(() => {
                loadOutletsCache();
                loadProductsCache();
            }, 1000);
        } else {
            showLogin();
        }
    } catch (e) {
        console.error('Auth error:', e);
        showLogin();
    }

    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('loginSubmitBtn');
        const err = document.getElementById('loginError');
        btn.textContent = 'Signing in...';
        btn.disabled = true;
        err.textContent = '';
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value,
            });
            if (error) throw error;
            currentUser = data.user;
            showApp();
            loadDashboard();
            setTimeout(() => { loadOutletsCache(); loadProductsCache(); }, 1000);
        } catch (error) {
            err.textContent = error.message || 'Login failed';
        } finally {
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        currentUser = null;
        showLogin();
    });

    // Offline banner
    window.addEventListener('online',  () => document.getElementById('offlineBanner')?.classList.remove('visible'));
    window.addEventListener('offline', () => document.getElementById('offlineBanner')?.classList.add('visible'));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// =====================================================
// OUTLETS CACHE LOADER
// =====================================================
async function loadOutletsCache() {
    if (!supabaseClient || !currentUser) return;
    const { data } = await supabaseClient.from('outlets').select('*').order('name');
    outletsCache = data || [];

    // Populate outlet dropdowns everywhere
    ['billOutlet', 'billOutletFilter', 'rcOutlet'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const firstOpt = sel.querySelector('option:first-child');
        sel.innerHTML = '';
        if (firstOpt) sel.appendChild(firstOpt.cloneNode(true));
        outletsCache.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            sel.appendChild(opt);
        });
    });
}

// =====================================================
// PRODUCTS CACHE LOADER
// =====================================================
async function loadProductsCache() {
    if (!supabaseClient || !currentUser) return;
    const { data } = await supabaseClient.from('products').select('*').order('brand');
    productsCache = data || [];
}

// =====================================================
// ██ DASHBOARD
// =====================================================
async function loadDashboard() {
    if (!supabaseClient || !currentUser) return;

    try {
        const [
            { data: outlets },
            { data: products },
            { data: givenCheques },
            { data: receivedCheques },
        ] = await Promise.all([
            supabaseClient.from('outlets').select('id', { count: 'exact' }),
            supabaseClient.from('products').select('id', { count: 'exact' }),
            supabaseClient.from('given_cheques').select('id, amount, status').eq('status', 'pending'),
            supabaseClient.from('received_cheques').select('id, amount, status, realizing_date, bank_name, cheque_number, drawer').eq('status', 'pending'),
        ]);

        // Get total bills + revenue + profit
        const { data: allBills } = await supabaseClient
            .from('bills')
            .select('id, total_amount, bill_number, bill_date, outlets(name), bill_items(qty, cost_price)')
            .order('bill_date', { ascending: false });

        const selectedMonth = document.getElementById('dashMonthFilter')?.value || '';
        let filteredBills = allBills || [];
        if (selectedMonth) {
            filteredBills = (allBills || []).filter(b => b.bill_date && b.bill_date.startsWith(selectedMonth));
        }

        const totalRevenue = filteredBills.reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0);
        let totalCostOfSales = 0;
        filteredBills.forEach(b => {
            (b.bill_items || []).forEach(item => {
                totalCostOfSales += (parseInt(item.qty) || 0) * (parseFloat(item.cost_price) || 0);
            });
        });
        const totalProfit = totalRevenue - totalCostOfSales;

        // Metrics
        document.getElementById('dashTotalBills').textContent    = filteredBills.length;
        document.getElementById('dashTotalRevenue').textContent  = fmtLKR(totalRevenue);
        document.getElementById('dashTotalProfit').textContent   = fmtLKR(totalProfit);
        document.getElementById('dashTotalOutlets').textContent  = (outlets || []).length;
        document.getElementById('dashTotalProducts').textContent = (products || []).length;
        document.getElementById('dashPendingReceived').textContent = (receivedCheques || []).length;
        document.getElementById('dashPendingGiven').textContent    = (givenCheques || []).length;

        // Upcoming received cheques (next 30 days)
        const today = new Date(); today.setHours(0,0,0,0);
        const in30 = new Date(); in30.setDate(today.getDate() + 30); in30.setHours(0,0,0,0);
        const upcoming = (receivedCheques || [])
            .filter(c => {
                if (!c.realizing_date) return false;
                const d = new Date(c.realizing_date + 'T00:00:00');
                return d >= today && d <= in30;
            })
            .sort((a, b) => new Date(a.realizing_date) - new Date(b.realizing_date));

        // Alert banner
        const alertBanner = document.getElementById('dashAlertBanner');
        const alertList = document.getElementById('dashAlertList');
        const urgentItems = upcoming.filter(c => getDaysUntil(c.realizing_date) <= 3);
        if (urgentItems.length > 0) {
            alertList.innerHTML = urgentItems.map(c =>
                `<div>• Cheque <b>${c.cheque_number}</b> from <b>${c.drawer}</b> — ${buildCountdownBadge(c.realizing_date)}</div>`
            ).join('');
            alertBanner.style.display = 'flex';
        } else {
            alertBanner.style.display = 'none';
        }

        // Upcoming list
        const upcomingListEl = document.getElementById('dashUpcomingList');
        if (upcoming.length === 0) {
            upcomingListEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;">No cheques realizing in the next 30 days. ✅</div>';
        } else {
            upcomingListEl.innerHTML = `
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Cheque No.</th>
                                <th>Bank</th>
                                <th>Drawer</th>
                                <th>Amount</th>
                                <th>Realizing Date</th>
                                <th>Countdown</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${upcoming.map(c => `
                                <tr>
                                    <td><strong>${c.cheque_number}</strong></td>
                                    <td>${c.bank_name}</td>
                                    <td>${c.drawer}</td>
                                    <td style="color:var(--green);font-weight:600;">${fmtLKR(c.amount)}</td>
                                    <td>${fmtDate(c.realizing_date)}</td>
                                    <td>${buildCountdownBadge(c.realizing_date)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        // Recent bills
        const tbody = document.getElementById('dashRecentBillsBody');
        const recentBills = filteredBills.slice(0, 5);
        if (recentBills.length === 0) {
            tbody.innerHTML = `<tr class="no-data-row"><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No bills found for this period</td></tr>`;
        } else {
            tbody.innerHTML = recentBills.map(b => `
                <tr>
                    <td><strong>${b.bill_number || '—'}</strong></td>
                    <td>${b.outlets?.name || '—'}</td>
                    <td>${fmtDate(b.bill_date)}</td>
                    <td style="color:var(--green);font-weight:600;">${fmtLKR(b.total_amount)}</td>
                    <td><button class="btn btn-secondary btn-xs" onclick="viewBill('${b.id}')">👁 View</button></td>
                </tr>
            `).join('');
        }

    } catch (e) {
        console.error('Dashboard error:', e);
        showToast('Failed to load dashboard', 'error');
    }
}

// =====================================================
// █ OUTLETS
// =====================================================
async function loadOutlets() {
    if (!supabaseClient || !currentUser) return;
    const area = document.getElementById('outletDisplayArea');
    if (area) area.innerHTML = '<div class="tyre-spinner"><span class="tyre-spinner-icon"><svg class="icon-tyre" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42"/></svg></span>Loading...</div>';

    try {
        const { data, error } = await supabaseClient.from('outlets').select('*').order('name');
        if (error) throw error;
        outletsCache = data || [];
        renderOutlets(outletsCache);
    } catch (e) {
        showToast('Failed to load outlets', 'error');
    }
}

function renderOutlets(data) {
    if (outletView === 'list') {
        renderOutletList(data);
    } else {
        renderOutletGrid(data);
    }
}

function renderOutletGrid(data) {
    const area = document.getElementById('outletDisplayArea');
    if (!area) return;
    if (!data || data.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;">No outlets added yet. Click <strong>+ Add Outlet</strong> to get started.</div>';
        return;
    }
    area.innerHTML = `<div class="outlet-grid">${data.map(o => `
        <div class="outlet-card">
            <div class="outlet-name">🏾 ${o.name}</div>
            <div class="outlet-address">${o.address || '<span style="color:var(--text-muted)">No address set</span>'}</div>
            <div class="outlet-actions">
                <button class="btn btn-secondary btn-xs" onclick="editOutlet('${o.id}')">✏️ Edit</button>
                <button class="btn btn-danger btn-xs" onclick="deleteOutlet('${o.id}', '${o.name.replace(/'/g, "\\'")}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('')}</div>`;
}

function renderOutletList(data) {
    const area = document.getElementById('outletDisplayArea');
    if (!area) return;
    if (!data || data.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;">No outlets added yet. Click <strong>+ Add Outlet</strong> to get started.</div>';
        return;
    }
    area.innerHTML = `
        <div class="outlet-list-wrap">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Outlet Name</th>
                        <th>Address</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((o, idx) => `
                        <tr>
                            <td style="color:var(--text-muted);font-size:12px;">${idx + 1}</td>
                            <td>
                                <div class="outlet-list-name">🏾 ${o.name}</div>
                            </td>
                            <td style="color:var(--text-secondary);font-size:13px;">${o.address || '<span style="color:var(--text-muted)">—</span>'}</td>
                            <td>
                                <div class="td-actions">
                                    <button class="btn btn-secondary btn-xs" onclick="editOutlet('${o.id}')">✏️ Edit</button>
                                    <button class="btn btn-danger btn-xs" onclick="deleteOutlet('${o.id}', '${o.name.replace(/'/g, "\\'")}')">🗑️ Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function initOutlets() {
    const addBtn = document.getElementById('addOutletBtn');
    const cancelBtn = document.getElementById('cancelOutletBtn');
    const form = document.getElementById('outletForm');
    const container = document.getElementById('outletFormContainer');

    addBtn?.addEventListener('click', () => {
        document.getElementById('outletEditId').value = '';
        document.getElementById('outletName').value = '';
        document.getElementById('outletAddress').value = '';
        container.style.display = 'block';
        document.getElementById('outletName').focus();
    });

    cancelBtn?.addEventListener('click', () => { container.style.display = 'none'; });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const editId = document.getElementById('outletEditId').value;
        const payload = {
            name:    document.getElementById('outletName').value.trim(),
            address: document.getElementById('outletAddress').value.trim(),
        };

        try {
            if (editId) {
                const { error } = await supabaseClient.from('outlets').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Outlet updated!', 'success');
            } else {
                const { error } = await supabaseClient.from('outlets').insert(payload);
                if (error) throw error;
                showToast('Outlet added!', 'success');
            }
            container.style.display = 'none';
            form.reset();
            loadOutlets();
            loadOutletsCache();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });

    // Search
    document.getElementById('outletSearch')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = outletsCache.filter(o =>
            o.name.toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q)
        );
        renderOutlets(filtered);
    });

    // View toggle
    document.querySelectorAll('#outletViewToggle .view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            outletView = btn.dataset.view;
            document.querySelectorAll('#outletViewToggle .view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const q = document.getElementById('outletSearch')?.value.toLowerCase() || '';
            const filtered = q
                ? outletsCache.filter(o => o.name.toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q))
                : outletsCache;
            renderOutlets(filtered);
        });
    });
}

window.editOutlet = async function(id) {
    const o = outletsCache.find(x => x.id === id);
    if (!o) return;
    document.getElementById('outletEditId').value = o.id;
    document.getElementById('outletName').value = o.name;
    document.getElementById('outletAddress').value = o.address || '';
    document.getElementById('outletFormContainer').style.display = 'block';
    document.getElementById('outletName').focus();
};

window.deleteOutlet = function(id, name) {
    showConfirm(`Delete outlet "<strong>${name}</strong>"? This cannot be undone.`, async () => {
        try {
            const { error } = await supabaseClient.from('outlets').delete().eq('id', id);
            if (error) throw error;
            showToast('Outlet deleted', 'success');
            loadOutlets();
            loadOutletsCache();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
};

// =====================================================
// █ PRODUCTS
// =====================================================
async function loadProducts() {
    if (!supabaseClient || !currentUser) return;
    const area = document.getElementById('productDisplayArea');
    if (area) area.innerHTML = '<div class="tyre-spinner"><span class="tyre-spinner-icon"><svg class="icon-tyre" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42"/></svg></span>Loading...</div>';

    try {
        const { data, error } = await supabaseClient.from('products').select('*').order('brand').order('size');
        if (error) throw error;
        productsCache = data || [];
        renderProducts(productsCache);
    } catch (e) {
        showToast('Failed to load products', 'error');
    }
}

function renderProducts(data) {
    if (productView === 'list') {
        renderProductList(data);
    } else {
        renderProductGrid(data);
    }
}

function renderProductGrid(data) {
    const area = document.getElementById('productDisplayArea');
    if (!area) return;
    if (!data || data.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;">No products yet. Click <strong>+ Add Product</strong> to add tyres.</div>';
        return;
    }
    area.innerHTML = `<div class="product-grid">${data.map(p => `
        <div class="product-card">
            <div class="product-card-tyre-icon"><svg class="icon-tyre" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42"/></svg></div>
            <div class="product-brand">${p.brand}</div>
            <div class="product-size">${p.size}</div>
            <div class="product-meta">
                ${p.type ? `<span class="product-meta-tag">${p.type}</span>` : ''}
                ${p.pattern ? `<span class="product-meta-tag">${p.pattern}</span>` : ''}
            </div>
            <div class="product-price">
                <span style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px;">SELLING PRICE</span>
                ${fmtLKR(p.selling_price)}
            </div>
            <div class="product-cost" style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:600;color:var(--text-secondary);margin-top:6px;">
                <span style="font-size:11px;color:var(--text-muted);font-family:'DM Sans',sans-serif;font-weight:400;display:block;">COST PRICE</span>
                ${fmtLKR(p.cost_price)}
            </div>
            <div class="product-actions" style="margin-top:12px;">
                <button class="btn btn-secondary btn-xs" onclick="editProduct('${p.id}')">✏️ Edit</button>
                <button class="btn btn-danger btn-xs" onclick="deleteProduct('${p.id}', '${(p.brand+' '+p.size).replace(/'/g,"\\'")}')">🗑️</button>
            </div>
        </div>
    `).join('')}</div>`;
}

function renderProductList(data) {
    const area = document.getElementById('productDisplayArea');
    if (!area) return;
    if (!data || data.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:48px;">No products yet. Click <strong>+ Add Product</strong> to add tyres.</div>';
        return;
    }
    area.innerHTML = `
        <div class="product-list-wrap">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Brand & Size</th>
                        <th>Type</th>
                        <th>Pattern</th>
                        <th>Cost Price</th>
                        <th>Selling Price</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((p, idx) => `
                        <tr>
                            <td style="color:var(--text-muted);font-size:12px;">${idx + 1}</td>
                            <td>
                                <div class="product-list-brand">${p.brand}</div>
                                <div class="product-list-size">${p.size}</div>
                            </td>
                            <td><span class="badge badge-pending" style="background:var(--blue-bg);color:var(--blue);">${p.type || '—'}</span></td>
                            <td style="color:var(--text-secondary);font-size:13px;">${p.pattern || '—'}</td>
                            <td style="color:var(--text-secondary);font-family:'Barlow Condensed',sans-serif;font-size:16px;">${fmtLKR(p.cost_price)}</td>
                            <td style="color:var(--green);font-weight:700;font-family:'Barlow Condensed',sans-serif;font-size:16px;">${fmtLKR(p.selling_price)}</td>
                            <td>
                                <div class="td-actions">
                                    <button class="btn btn-secondary btn-xs" onclick="editProduct('${p.id}')">✏️ Edit</button>
                                    <button class="btn btn-danger btn-xs" onclick="deleteProduct('${p.id}', '${(p.brand+' '+p.size).replace(/'/g,"\\'")}')">🗑️</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function initProducts() {
    const addBtn = document.getElementById('addProductBtn');
    const cancelBtn = document.getElementById('cancelProductBtn');
    const form = document.getElementById('productForm');
    const container = document.getElementById('productFormContainer');

    addBtn?.addEventListener('click', () => {
        document.getElementById('productEditId').value = '';
        form.reset();
        container.style.display = 'block';
        document.getElementById('productBrand').focus();
    });

    cancelBtn?.addEventListener('click', () => { container.style.display = 'none'; });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const editId = document.getElementById('productEditId').value;
        const payload = {
            brand:         document.getElementById('productBrand').value.trim(),
            size:          document.getElementById('productSize').value.trim(),
            type:          document.getElementById('productType').value,
            pattern:       document.getElementById('productPattern').value.trim(),
            cost_price:    parseFloat(document.getElementById('productCostPrice').value) || 0,
            selling_price: parseFloat(document.getElementById('productSellingPrice').value) || 0,
        };

        try {
            if (editId) {
                const { error } = await supabaseClient.from('products').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Product updated!', 'success');
            } else {
                const { error } = await supabaseClient.from('products').insert(payload);
                if (error) throw error;
                showToast('Product added!', 'success');
            }
            container.style.display = 'none';
            form.reset();
            loadProducts();
            loadProductsCache();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });

    // Search & filter
    function filterProducts() {
        const q = document.getElementById('productSearch')?.value.toLowerCase() || '';
        const type = document.getElementById('productTypeFilter')?.value || '';
        const filtered = productsCache.filter(p => {
            const matchQ = !q || (p.brand + ' ' + p.size + ' ' + (p.pattern || '')).toLowerCase().includes(q);
            const matchT = !type || p.type === type;
            return matchQ && matchT;
        });
        renderProducts(filtered);
    }

    document.getElementById('productSearch')?.addEventListener('input', filterProducts);
    document.getElementById('productTypeFilter')?.addEventListener('change', filterProducts);

    // View toggle
    document.querySelectorAll('#productViewToggle .view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            productView = btn.dataset.view;
            document.querySelectorAll('#productViewToggle .view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterProducts();
        });
    });
}

window.editProduct = async function(id) {
    const p = productsCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productEditId').value = p.id;
    document.getElementById('productBrand').value = p.brand;
    document.getElementById('productSize').value = p.size;
    document.getElementById('productType').value = p.type || '';
    document.getElementById('productPattern').value = p.pattern || '';
    document.getElementById('productCostPrice').value = p.cost_price;
    document.getElementById('productSellingPrice').value = p.selling_price;
    document.getElementById('productFormContainer').style.display = 'block';
    document.getElementById('productBrand').focus();
};

window.deleteProduct = function(id, name) {
    showConfirm(`Delete product "<strong>${name}</strong>"?`, async () => {
        try {
            const { error } = await supabaseClient.from('products').delete().eq('id', id);
            if (error) throw error;
            showToast('Product deleted', 'success');
            loadProducts();
            loadProductsCache();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
};

// =====================================================
// ██ BILLS
// =====================================================
let billLineItems = [];
let allBillsData = [];

async function loadBills() {
    if (!supabaseClient || !currentUser) return;
    showTableSkeleton('billsTableBody', 6);
    await loadOutletsCache();

    try {
        const { data, error } = await supabaseClient
            .from('bills')
            .select('*, outlets(name), bill_items(id)')
            .order('bill_date', { ascending: false });
        if (error) throw error;

        allBillsData = data || [];
        updateBillsSummary(allBillsData);
        filterAndRenderBills();
    } catch (e) {
        showToast('Failed to load bills', 'error');
    }
}

function updateBillsSummary(bills) {
    const total = bills.reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0);
    document.getElementById('billsCount').textContent = bills.length;
    document.getElementById('billsTotalValue').textContent = fmtLKR(total);
}

function filterAndRenderBills() {
    const q = document.getElementById('billSearch')?.value.toLowerCase() || '';
    const outletId = document.getElementById('billOutletFilter')?.value || '';
    const status = document.getElementById('billStatusFilter')?.value || '';
    const month = document.getElementById('billMonthFilter')?.value || '';

    const filtered = allBillsData.filter(b => {
        const matchQ = !q || (b.bill_number || '').toLowerCase().includes(q) || (b.outlets?.name || '').toLowerCase().includes(q);
        const matchO = !outletId || b.outlet_id === outletId;
        const matchS = !status || b.status === status;
        const matchM = !month || (b.bill_date || '').startsWith(month);
        return matchQ && matchO && matchS && matchM;
    });

    createPagination('billsPagination', filtered, renderBillRow, 'billsTableBody', 8);
}

function renderBillRow(b) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><strong>${b.bill_number || '—'}</strong></td>
        <td>${b.outlets?.name || '—'}</td>
        <td>${fmtDate(b.bill_date)}</td>
        <td>
            <span class="badge" style="text-transform:capitalize; background:${b.payment_type === 'cheque' ? 'var(--blue-bg)' : 'var(--green-bg)'}; color:${b.payment_type === 'cheque' ? 'var(--blue)' : 'var(--green)'}; font-size:11px; padding:3px 8px; font-weight:600;">
                ${b.payment_type === 'cheque' ? '💳 Cheque' : '💵 Cash'}
            </span>
        </td>
        <td><span class="badge badge-pending">${(b.bill_items || []).length} items</span></td>
        <td>
            <select class="btn btn-xs" style="border:1.5px solid var(--surface-border);border-radius:var(--radius-sm);padding:4px 8px;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;background:var(--surface-card);color:${b.status === 'paid' ? 'var(--green)' : 'var(--brand-red)'};font-weight:600;" onchange="updateBillStatus('${b.id}', this.value)" title="Change Paid Status">
                <option value="unpaid" ${b.status === 'unpaid' ? 'selected' : ''}>🔴 Unpaid</option>
                <option value="paid"   ${b.status === 'paid'   ? 'selected' : ''}>🟢 Paid</option>
            </select>
        </td>
        <td style="color:var(--green);font-weight:600;">${fmtLKR(b.total_amount)}</td>
        <td>
            <div class="td-actions">
                <button class="btn btn-secondary btn-xs" onclick="viewBill('${b.id}')">👁</button>
                <button class="btn btn-danger btn-xs" onclick="deleteBill('${b.id}', '${(b.bill_number || b.id).replace(/'/g, "\\'")}')">🗑️</button>
            </div>
        </td>
    `;
    return tr;
}

function initBills() {
    const createBtn = document.getElementById('createBillBtn');
    const cancelBtn = document.getElementById('cancelBillBtn');
    const container = document.getElementById('billBuilderContainer');
    const addLineBtn = document.getElementById('addLineItemBtn');
    const saveBtn = document.getElementById('saveBillBtn');

    createBtn?.addEventListener('click', () => {
        document.getElementById('billEditId').value = '';
        document.getElementById('billNumber').value = '';
        document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('billNotes').value = '';
        document.getElementById('billOutlet').value = '';
        document.getElementById('billPaymentType').value = 'cash';
        document.getElementById('billDiscount').value = '0';
        document.getElementById('saveBillBtn').disabled = false;
        billLineItems = [];
        renderLineItems();
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    });

    cancelBtn?.addEventListener('click', () => { container.style.display = 'none'; });

    addLineBtn?.addEventListener('click', () => {
        billLineItems.push({ product_id: '', qty: 1, cost_price: 0, unit_price: 0, line_total: 0 });
        renderLineItems();
    });

    saveBtn?.addEventListener('click', saveBill);

    // Live update on discount change
    document.getElementById('billDiscount')?.addEventListener('input', updateBillTotals);

    // Block bills if outlet has unpaid bills
    document.getElementById('billOutlet')?.addEventListener('change', async e => {
        const outletId = e.target.value;
        if (!outletId) return;
        const hasUnpaid = await checkOutletUnpaidBills(outletId);
        if (hasUnpaid) {
            showToast('⚠️ This outlet has unpaid bills! You cannot create new bills for it.', 'warning', 5000);
            document.getElementById('saveBillBtn').disabled = true;
        } else {
            document.getElementById('saveBillBtn').disabled = false;
        }
    });

    // Filters
    ['billSearch', 'billOutletFilter', 'billStatusFilter', 'billMonthFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', filterAndRenderBills);
        document.getElementById(id)?.addEventListener('change', filterAndRenderBills);
    });
}

function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    if (!container) return;

    if (billLineItems.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:24px;border:2px dashed var(--surface-border);border-radius:var(--radius-md);">Click <strong>+ Add Item</strong> to add tyre line items</div>`;
        updateBillTotals();
        return;
    }

    container.innerHTML = billLineItems.map((item, idx) => `
        <div class="bill-line-item" id="lineItem_${idx}">
            <div class="form-group">
                <label><svg class="icon-tyre" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: -2px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42"/></svg>Product</label>
                <select onchange="onLineItemProductChange(${idx}, this.value)">
                    <option value="">-- Select Tyre --</option>
                    ${productsCache.map(p => `<option value="${p.id}" ${p.id === item.product_id ? 'selected' : ''}>${p.brand} ${p.size}${p.type ? ' — ' + p.type : ''} (${fmtLKR(p.selling_price)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>📦 Qty</label>
                <input type="number" min="1" value="${item.qty}" onchange="onLineItemQtyChange(${idx}, this.value)">
            </div>
            <div class="form-group">
                <label>💰 Unit Price</label>
                <input type="number" min="0" step="0.01" value="${item.unit_price}" onchange="onLineItemPriceChange(${idx}, this.value)">
            </div>
            <div class="form-group">
                <label>🧮 Line Total</label>
                <input type="text" value="${fmtLKR(item.line_total)}" readonly style="background:var(--surface-bg);color:var(--green);font-weight:600;">
            </div>
            <button class="remove-line-btn" onclick="removeLineItem(${idx})" title="Remove item">✕</button>
        </div>
    `).join('');

    updateBillTotals();
}

window.onLineItemProductChange = function(idx, productId) {
    const product = productsCache.find(p => p.id === productId);
    if (product) {
        billLineItems[idx].product_id = productId;
        billLineItems[idx].cost_price = parseFloat(product.cost_price) || 0;
        billLineItems[idx].unit_price = parseFloat(product.selling_price) || 0;
        billLineItems[idx].line_total = billLineItems[idx].unit_price * billLineItems[idx].qty;
    } else {
        billLineItems[idx].product_id = '';
        billLineItems[idx].cost_price = 0;
        billLineItems[idx].unit_price = 0;
        billLineItems[idx].line_total = 0;
    }
    renderLineItems();
};

window.onLineItemQtyChange = function(idx, val) {
    billLineItems[idx].qty = parseInt(val) || 1;
    billLineItems[idx].line_total = billLineItems[idx].unit_price * billLineItems[idx].qty;
    renderLineItems();
};

window.onLineItemPriceChange = function(idx, val) {
    billLineItems[idx].unit_price = parseFloat(val) || 0;
    billLineItems[idx].line_total = billLineItems[idx].unit_price * billLineItems[idx].qty;
    renderLineItems();
};

window.removeLineItem = function(idx) {
    billLineItems.splice(idx, 1);
    renderLineItems();
};

function updateBillTotals() {
    const subtotal = billLineItems.reduce((s, i) => s + (i.line_total || 0), 0);
    const discountPercent = parseFloat(document.getElementById('billDiscount').value) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const grandTotal = subtotal - discountAmount;

    document.getElementById('billSubtotal').textContent = fmtLKR(subtotal);
    document.getElementById('billDiscountAmount').textContent = fmtLKR(discountAmount);
    document.getElementById('billGrandTotal').textContent = fmtLKR(grandTotal);
}

async function saveBill() {
    const outletId = document.getElementById('billOutlet').value;
    const billDate = document.getElementById('billDate').value;
    if (!outletId) { showToast('Please select an outlet', 'warning'); return; }
    if (!billDate) { showToast('Please select a bill date', 'warning'); return; }
    if (billLineItems.length === 0) { showToast('Please add at least one line item', 'warning'); return; }
    if (billLineItems.some(i => !i.product_id)) { showToast('Please select a product for all line items', 'warning'); return; }

    // Double check unpaid bills on save
    const hasUnpaid = await checkOutletUnpaidBills(outletId);
    if (hasUnpaid) {
        showToast('❌ Cannot save bill: This outlet has unpaid bills!', 'error', 5000);
        return;
    }

    const subtotalAmount = billLineItems.reduce((s, i) => s + i.line_total, 0);
    const discountPercent = parseFloat(document.getElementById('billDiscount').value) || 0;
    const discountAmount = subtotalAmount * (discountPercent / 100);
    const totalAmount = subtotalAmount - discountAmount;
    const paymentType = document.getElementById('billPaymentType').value || 'cash';
    let billNumber = document.getElementById('billNumber').value.trim();
    if (!billNumber) {
        billNumber = 'BILL-' + Date.now();
    }

    const btn = document.getElementById('saveBillBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        // Insert bill
        const { data: bill, error: billError } = await supabaseClient.from('bills').insert({
            outlet_id:           outletId,
            bill_number:         billNumber,
            bill_date:           billDate,
            subtotal_amount:     subtotalAmount,
            discount_percentage: discountPercent,
            total_amount:        totalAmount,
            payment_type:        paymentType,
            notes:               document.getElementById('billNotes').value.trim(),
        }).select().single();

        if (billError) throw billError;

        // Insert line items with cost_price to calculate dashboard profits
        const lineItemsPayload = billLineItems.map(i => ({
            bill_id:    bill.id,
            product_id: i.product_id,
            qty:        i.qty,
            cost_price: i.cost_price || 0,
            unit_price: i.unit_price,
            line_total: i.line_total,
        }));

        const { error: lineError } = await supabaseClient.from('bill_items').insert(lineItemsPayload);
        if (lineError) throw lineError;

        showToast('Bill saved successfully! 🎉', 'success');
        document.getElementById('billBuilderContainer').style.display = 'none';
        billLineItems = [];
        loadBills();
    } catch (e) {
        showToast('Error saving bill: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Bill';
    }
}

window.viewBill = async function(id) {
    try {
        const { data: bill, error } = await supabaseClient
            .from('bills')
            .select('*, outlets(name), bill_items(*, products(brand, size, type))')
            .eq('id', id)
            .single();
        if (error) throw error;

        const modal = document.getElementById('billViewModal');
        document.getElementById('billViewTitle').textContent = `Bill ${bill.bill_number || id}`;
        document.getElementById('billViewBody').innerHTML = `
            <div style="margin-bottom:16px;">
                <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;">
                    <div><span style="color:var(--text-muted);font-size:12px;text-transform:uppercase;font-weight:600;">Outlet</span><br><strong>${bill.outlets?.name || '—'}</strong></div>
                    <div><span style="color:var(--text-muted);font-size:12px;text-transform:uppercase;font-weight:600;">Date</span><br><strong>${fmtDate(bill.bill_date)}</strong></div>
                    <div><span style="color:var(--text-muted);font-size:12px;text-transform:uppercase;font-weight:600;">Payment Type</span><br><span class="badge" style="text-transform:capitalize;background:${bill.payment_type === 'cheque' ? 'var(--blue-bg)' : 'var(--green-bg)'};color:${bill.payment_type === 'cheque' ? 'var(--blue)' : 'var(--green)'};">${bill.payment_type || 'cash'}</span></div>
                    ${bill.notes ? `<div><span style="color:var(--text-muted);font-size:12px;text-transform:uppercase;font-weight:600;">Notes</span><br>${bill.notes}</div>` : ''}
                </div>
                <div class="bill-view-items">
                    <div class="bill-view-item header">
                        <div>Product</div><div>Qty</div><div>Unit Price</div><div>Total</div>
                    </div>
                    ${(bill.bill_items || []).map(i => `
                        <div class="bill-view-item">
                            <div>${i.products?.brand || ''} ${i.products?.size || ''}${i.products?.type ? ' — ' + i.products.type : ''}</div>
                            <div>${i.qty}</div>
                            <div>${fmtLKR(i.unit_price)}</div>
                            <div style="color:var(--green);font-weight:600;">${fmtLKR(i.line_total)}</div>
                        </div>
                    `).join('')}
                    <div style="margin-top:12px; border-top:1px solid var(--surface-border); padding-top:12px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                        <div style="font-size:13px; color:var(--text-secondary);">Subtotal: <strong>${fmtLKR(bill.subtotal_amount || bill.total_amount)}</strong></div>
                        ${bill.discount_percentage > 0 ? `<div style="font-size:13px; color:var(--text-secondary);">Discount (${bill.discount_percentage}%): <strong>-${fmtLKR((bill.subtotal_amount || bill.total_amount) * (bill.discount_percentage / 100))}</strong></div>` : ''}
                        <div class="bill-view-total" style="border:none; padding:0; margin:0; font-size:22px;">TOTAL: ${fmtLKR(bill.total_amount)}</div>
                    </div>
                </div>
            </div>
        `;
        modal.classList.add('active');
    } catch (e) {
        showToast('Failed to load bill details', 'error');
    }
};

async function checkOutletUnpaidBills(outletId) {
    if (!supabaseClient) return false;
    try {
        const { data, error } = await supabaseClient
            .from('bills')
            .select('id')
            .eq('outlet_id', outletId)
            .eq('status', 'unpaid');
        if (error) throw error;
        return (data || []).length > 0;
    } catch (e) {
        console.error('Error checking unpaid bills:', e);
        return false;
    }
}

window.updateBillStatus = async function(id, newStatus) {
    try {
        const { error } = await supabaseClient.from('bills').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        showToast(`Bill status updated to ${newStatus.toUpperCase()}`, 'success');
        loadBills();
    } catch (e) {
        showToast('Error updating bill status: ' + e.message, 'error');
    }
};

window.deleteBill = function(id, name) {
    showConfirm(`Delete bill "<strong>${name}</strong>" and all its items?`, async () => {
        try {
            await supabaseClient.from('bill_items').delete().eq('bill_id', id);
            const { error } = await supabaseClient.from('bills').delete().eq('id', id);
            if (error) throw error;
            showToast('Bill deleted', 'success');
            loadBills();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
};

// Bill View Modal close
document.getElementById('billViewClose')?.addEventListener('click', () => {
    document.getElementById('billViewModal')?.classList.remove('active');
});
document.getElementById('billViewModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('billViewModal'))
        document.getElementById('billViewModal').classList.remove('active');
});

// =====================================================
// ██ GIVEN CHEQUES
// =====================================================
let allGivenChequesData = [];

async function loadGivenCheques() {
    if (!supabaseClient || !currentUser) return;
    showTableSkeleton('givenChequesTableBody', 7);

    try {
        const { data, error } = await supabaseClient.from('given_cheques').select('*').order('cheque_date', { ascending: false });
        if (error) throw error;
        allGivenChequesData = data || [];
        updateGivenSummary(allGivenChequesData);
        filterAndRenderGiven();
    } catch (e) {
        showToast('Failed to load given cheques', 'error');
    }
}

function updateGivenSummary(data) {
    const pending  = data.filter(c => c.status === 'pending');
    const cleared  = data.filter(c => c.status === 'cleared');
    const bounced  = data.filter(c => c.status === 'bounced');
    const pendingVal = pending.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    document.getElementById('gcTotalCount').textContent   = data.length;
    document.getElementById('gcPendingCount').textContent = pending.length;
    document.getElementById('gcClearedCount').textContent = cleared.length;
    document.getElementById('gcBouncedCount').textContent = bounced.length;
    document.getElementById('gcPendingValue').textContent = fmtLKR(pendingVal);
}

function filterAndRenderGiven() {
    const q = document.getElementById('gcSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('gcStatusFilter')?.value || '';
    const filtered = allGivenChequesData.filter(c => {
        const matchQ = !q || (c.cheque_number || '').toLowerCase().includes(q) ||
            (c.bank_name || '').toLowerCase().includes(q) || (c.payee || '').toLowerCase().includes(q);
        const matchS = !status || c.status === status;
        return matchQ && matchS;
    });
    createPagination('gcPagination', filtered, renderGivenRow, 'givenChequesTableBody', 7);
}

function renderGivenRow(c) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><strong>${c.cheque_number}</strong></td>
        <td>${c.bank_name}</td>
        <td>${c.payee || '—'}</td>
        <td>${fmtDate(c.cheque_date)}</td>
        <td style="font-weight:600;">${fmtLKR(c.amount)}</td>
        <td><span class="badge badge-${c.status}">${c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span></td>
        <td>
            <div class="td-actions">
                <button class="btn btn-secondary btn-xs" onclick="editGivenCheque('${c.id}')">✏️</button>
                <select class="btn btn-xs" style="border:1.5px solid var(--surface-border);border-radius:var(--radius-sm);padding:4px 8px;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;background:var(--surface-card);color:var(--text-primary);" onchange="updateGivenStatus('${c.id}', this.value)" title="Change Status">
                    <option value="pending"   ${c.status === 'pending'   ? 'selected' : ''}>Pending</option>
                    <option value="cleared"   ${c.status === 'cleared'   ? 'selected' : ''}>Cleared</option>
                    <option value="bounced"   ${c.status === 'bounced'   ? 'selected' : ''}>Bounced</option>
                    <option value="cancelled" ${c.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <button class="btn btn-danger btn-xs" onclick="deleteGivenCheque('${c.id}', '${c.cheque_number}')">🗑️</button>
            </div>
        </td>
    `;
    return tr;
}

function initGivenCheques() {
    const addBtn = document.getElementById('addGivenChequeBtn');
    const cancelBtn = document.getElementById('cancelGivenChequeBtn');
    const form = document.getElementById('givenChequeForm');
    const container = document.getElementById('givenChequeFormContainer');

    // Handle bank select change
    document.getElementById('gcBankSelect')?.addEventListener('change', e => {
        const customInput = document.getElementById('gcBankName');
        if (e.target.value === 'Other') {
            customInput.style.display = 'block';
            customInput.required = true;
            customInput.value = '';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = e.target.value;
        }
    });

    addBtn?.addEventListener('click', () => {
        document.getElementById('givenChequeEditId').value = '';
        form.reset();
        const customInput = document.getElementById('gcBankName');
        if (customInput) {
            customInput.style.display = 'none';
            customInput.required = false;
        }
        document.getElementById('gcDate').value = new Date().toISOString().split('T')[0];
        container.style.display = 'block';
        document.getElementById('gcBankSelect')?.focus();
    });

    cancelBtn?.addEventListener('click', () => { container.style.display = 'none'; });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const editId = document.getElementById('givenChequeEditId').value;
        const payload = {
            bank_name:     document.getElementById('gcBankName').value.trim(),
            cheque_number: document.getElementById('gcChequeNumber').value.trim(),
            amount:        parseFloat(document.getElementById('gcAmount').value) || 0,
            cheque_date:   document.getElementById('gcDate').value,
            payee:         document.getElementById('gcPayee').value.trim(),
            status:        document.getElementById('gcStatus').value,
            notes:         document.getElementById('gcNotes').value.trim(),
        };

        try {
            if (editId) {
                const { error } = await supabaseClient.from('given_cheques').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Cheque updated!', 'success');
            } else {
                const { error } = await supabaseClient.from('given_cheques').insert(payload);
                if (error) throw error;
                showToast('Cheque added!', 'success');
            }
            container.style.display = 'none';
            form.reset();
            loadGivenCheques();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });

    ['gcSearch', 'gcStatusFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', filterAndRenderGiven);
        document.getElementById(id)?.addEventListener('change', filterAndRenderGiven);
    });
}

window.editGivenCheque = function(id) {
    const c = allGivenChequesData.find(x => x.id === id);
    if (!c) return;
    document.getElementById('givenChequeEditId').value = c.id;

    // Set bank select / custom input
    const select = document.getElementById('gcBankSelect');
    const customInput = document.getElementById('gcBankName');
    if (select && customInput) {
        let matched = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === c.bank_name) {
                select.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (matched) {
            select.value = c.bank_name;
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = c.bank_name;
        } else {
            select.value = 'Other';
            customInput.style.display = 'block';
            customInput.required = true;
            customInput.value = c.bank_name;
        }
    }

    document.getElementById('gcChequeNumber').value = c.cheque_number;
    document.getElementById('gcAmount').value = c.amount;
    document.getElementById('gcDate').value = c.cheque_date;
    document.getElementById('gcPayee').value = c.payee || '';
    document.getElementById('gcStatus').value = c.status;
    document.getElementById('gcNotes').value = c.notes || '';
    document.getElementById('givenChequeFormContainer').style.display = 'block';
    document.getElementById('gcBankSelect')?.focus();
};

window.updateGivenStatus = async function(id, newStatus) {
    try {
        const { error } = await supabaseClient.from('given_cheques').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        showToast(`Status updated to ${newStatus}`, 'success');
        loadGivenCheques();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

window.deleteGivenCheque = function(id, num) {
    showConfirm(`Delete cheque <strong>#${num}</strong>?`, async () => {
        try {
            const { error } = await supabaseClient.from('given_cheques').delete().eq('id', id);
            if (error) throw error;
            showToast('Cheque deleted', 'success');
            loadGivenCheques();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
};

// =====================================================
// ██ RECEIVED CHEQUES
// =====================================================
let allReceivedChequesData = [];

async function loadReceivedCheques() {
    if (!supabaseClient || !currentUser) return;
    showTableSkeleton('receivedChequesTableBody', 8);
    await loadOutletsCache();

    try {
        const { data, error } = await supabaseClient
            .from('received_cheques')
            .select('*, outlets(name)')
            .order('realizing_date', { ascending: true });
        if (error) throw error;
        allReceivedChequesData = data || [];
        updateReceivedSummary(allReceivedChequesData);
        filterAndRenderReceived();
    } catch (e) {
        showToast('Failed to load received cheques', 'error');
    }
}

function updateReceivedSummary(data) {
    const pending  = data.filter(c => c.status === 'pending');
    const cleared  = data.filter(c => c.status === 'cleared');
    const bounced  = data.filter(c => c.status === 'bounced');
    const pendingVal = pending.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    document.getElementById('rcTotalCount').textContent   = data.length;
    document.getElementById('rcPendingCount').textContent = pending.length;
    document.getElementById('rcClearedCount').textContent = cleared.length;
    document.getElementById('rcBouncedCount').textContent = bounced.length;
    document.getElementById('rcPendingValue').textContent = fmtLKR(pendingVal);
}

function filterAndRenderReceived() {
    const q = document.getElementById('rcSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('rcStatusFilter')?.value || '';
    const filtered = allReceivedChequesData.filter(c => {
        const matchQ = !q || (c.cheque_number || '').toLowerCase().includes(q) ||
            (c.bank_name || '').toLowerCase().includes(q) || (c.drawer || '').toLowerCase().includes(q);
        const matchS = !status || c.status === status;
        return matchQ && matchS;
    });
    createPagination('rcPagination', filtered, renderReceivedRow, 'receivedChequesTableBody', 8);
}

function renderReceivedRow(c) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><strong>${c.cheque_number}</strong></td>
        <td>${c.bank_name}</td>
        <td>${c.drawer}${c.outlets?.name ? `<br><small style="color:var(--text-muted);">${c.outlets.name}</small>` : ''}</td>
        <td style="color:var(--green);font-weight:600;">${fmtLKR(c.amount)}</td>
        <td>${fmtDate(c.realizing_date)}</td>
        <td>${buildCountdownBadge(c.realizing_date)}</td>
        <td><span class="badge badge-${c.status}">${c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span></td>
        <td>
            <div class="td-actions">
                <button class="btn btn-secondary btn-xs" onclick="editReceivedCheque('${c.id}')">✏️</button>
                <select class="btn btn-xs" style="border:1.5px solid var(--surface-border);border-radius:var(--radius-sm);padding:4px 8px;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;background:var(--surface-card);color:var(--text-primary);" onchange="updateReceivedStatus('${c.id}', this.value)" title="Change Status">
                    <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="cleared" ${c.status === 'cleared' ? 'selected' : ''}>Cleared</option>
                    <option value="bounced" ${c.status === 'bounced' ? 'selected' : ''}>Bounced</option>
                </select>
                <button class="btn btn-danger btn-xs" onclick="deleteReceivedCheque('${c.id}', '${c.cheque_number}')">🗑️</button>
            </div>
        </td>
    `;
    return tr;
}

function initReceivedCheques() {
    const addBtn = document.getElementById('addReceivedChequeBtn');
    const cancelBtn = document.getElementById('cancelReceivedChequeBtn');
    const form = document.getElementById('receivedChequeForm');
    const container = document.getElementById('receivedChequeFormContainer');

    // Handle bank select change
    document.getElementById('rcBankSelect')?.addEventListener('change', e => {
        const customInput = document.getElementById('rcBankName');
        if (e.target.value === 'Other') {
            customInput.style.display = 'block';
            customInput.required = true;
            customInput.value = '';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = e.target.value;
        }
    });

    addBtn?.addEventListener('click', () => {
        document.getElementById('receivedChequeEditId').value = '';
        form.reset();
        const customInput = document.getElementById('rcBankName');
        if (customInput) {
            customInput.style.display = 'none';
            customInput.required = false;
        }
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('rcReceivedDate').value = today;
        document.getElementById('rcRealizingDate').value = today;
        container.style.display = 'block';
        document.getElementById('rcBankSelect')?.focus();
    });

    cancelBtn?.addEventListener('click', () => { container.style.display = 'none'; });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const editId = document.getElementById('receivedChequeEditId').value;
        const payload = {
            bank_name:       document.getElementById('rcBankName').value.trim(),
            cheque_number:   document.getElementById('rcChequeNumber').value.trim(),
            amount:          parseFloat(document.getElementById('rcAmount').value) || 0,
            drawer:          document.getElementById('rcDrawer').value.trim(),
            outlet_id:       document.getElementById('rcOutlet').value || null,
            received_date:   document.getElementById('rcReceivedDate').value,
            realizing_date:  document.getElementById('rcRealizingDate').value,
            status:          document.getElementById('rcStatus').value,
            notes:           document.getElementById('rcNotes').value.trim(),
        };

        try {
            if (editId) {
                const { error } = await supabaseClient.from('received_cheques').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Cheque updated!', 'success');
            } else {
                const { error } = await supabaseClient.from('received_cheques').insert(payload);
                if (error) throw error;
                showToast('Cheque added!', 'success');
            }
            container.style.display = 'none';
            form.reset();
            loadReceivedCheques();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });

    ['rcSearch', 'rcStatusFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', filterAndRenderReceived);
        document.getElementById(id)?.addEventListener('change', filterAndRenderReceived);
    });
}

window.editReceivedCheque = function(id) {
    const c = allReceivedChequesData.find(x => x.id === id);
    if (!c) return;
    document.getElementById('receivedChequeEditId').value = c.id;

    // Set bank select / custom input
    const select = document.getElementById('rcBankSelect');
    const customInput = document.getElementById('rcBankName');
    if (select && customInput) {
        let matched = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === c.bank_name) {
                select.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (matched) {
            select.value = c.bank_name;
            customInput.style.display = 'none';
            customInput.required = false;
            customInput.value = c.bank_name;
        } else {
            select.value = 'Other';
            customInput.style.display = 'block';
            customInput.required = true;
            customInput.value = c.bank_name;
        }
    }

    document.getElementById('rcChequeNumber').value = c.cheque_number;
    document.getElementById('rcAmount').value = c.amount;
    document.getElementById('rcDrawer').value = c.drawer;
    document.getElementById('rcOutlet').value = c.outlet_id || '';
    document.getElementById('rcReceivedDate').value = c.received_date;
    document.getElementById('rcRealizingDate').value = c.realizing_date;
    document.getElementById('rcStatus').value = c.status;
    document.getElementById('rcNotes').value = c.notes || '';
    document.getElementById('receivedChequeFormContainer').style.display = 'block';
    document.getElementById('rcBankSelect')?.focus();
};

window.updateReceivedStatus = async function(id, newStatus) {
    try {
        const { error } = await supabaseClient.from('received_cheques').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        showToast(`Status updated to ${newStatus}`, 'success');
        loadReceivedCheques();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

window.deleteReceivedCheque = function(id, num) {
    showConfirm(`Delete received cheque <strong>#${num}</strong>?`, async () => {
        try {
            const { error } = await supabaseClient.from('received_cheques').delete().eq('id', id);
            if (error) throw error;
            showToast('Cheque deleted', 'success');
            loadReceivedCheques();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    });
};

// =====================================================
// INIT ALL MODULE UI
// =====================================================
function initDashboard() {
    const monthFilter = document.getElementById('dashMonthFilter');
    const clearBtn = document.getElementById('clearDashMonthBtn');

    monthFilter?.addEventListener('change', () => {
        loadDashboard();
    });

    clearBtn?.addEventListener('click', () => {
        if (monthFilter) {
            monthFilter.value = '';
            loadDashboard();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initOutlets();
    initProducts();
    initBills();
    initGivenCheques();
    initReceivedCheques();

    // Live countdown refresh every minute
    setInterval(() => {
        if (currentPage === 'received-cheques') {
            filterAndRenderReceived();
        }
        if (currentPage === 'dashboard') {
            loadDashboard();
        }
    }, 60000);
});
