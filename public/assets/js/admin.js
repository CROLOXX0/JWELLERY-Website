/* ==========================================================================
   Jwellery Master Luxury Admin Controller
   ========================================================================== */

let CURRENT_ADMIN = null;
let PRODUCTS_CACHE = [];
let ORDERS_CACHE = [];
let CUSTOMERS_CACHE = [];

// Chart references to prevent re-creation collisions
let weeklyChartRef = null;
let categoryChartRef = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    await checkAdminSession();
    setupAdminNavigation();
    setupAuthListeners();
});

// Check secure admin login state
async function checkAdminSession() {
    try {
        const res = await fetch('/api/admin/verify-session');
        if (res.ok) {
            const data = await res.json();
            CURRENT_ADMIN = data.admin;
            
            // Show Main Admin Panel
            document.querySelector("#admin-auth-gate").style.display = "none";
            document.querySelector("#admin-main-interface").style.display = "grid";
            
            // Populate active staff ID cards
            document.querySelector("#active-admin-name").innerText = CURRENT_ADMIN.name;
            document.querySelector("#active-admin-role").innerText = CURRENT_ADMIN.role;

            // Load default tab
            await loadTabContent("analytics");
        } else {
            showLoginGate();
        }
    } catch {
        showLoginGate();
    }
}

function showLoginGate() {
    document.querySelector("#admin-auth-gate").style.display = "flex";
    document.querySelector("#admin-main-interface").style.display = "none";
}

// --- SECURE DUAL-STEP AUTHENTICATION ---

function toggleAdminAuthView(view) {
    const credView = document.querySelector("#admin-credentials-view");
    const otpView = document.querySelector("#admin-otp-view");
    const regView = document.querySelector("#admin-registration-view");
    const regOtpView = document.querySelector("#admin-reg-otp-view");
    const errEl = document.querySelector("#admin-auth-error");

    errEl.innerText = "";

    // Hide all
    credView.style.display = "none";
    otpView.style.display = "none";
    regView.style.display = "none";
    regOtpView.style.display = "none";

    // Show selected
    if (view === 'login') {
        credView.style.display = "block";
    } else if (view === 'otp') {
        otpView.style.display = "block";
    } else if (view === 'register') {
        regView.style.display = "block";
    } else if (view === 'reg-otp') {
        regOtpView.style.display = "block";
    }
}

function setupAuthListeners() {
    const errEl = document.querySelector("#admin-auth-error");
    if (window.location.protocol === 'file:') {
        if (errEl) {
            errEl.innerHTML = `<span style="color:#e74c3c; font-weight:600;">⚠️ Opened via file:// protocol.<br>Please open through the running server at:<br><a href="http://localhost:3000/admin.html" target="_blank" style="color:var(--accent-rose); text-decoration:underline;">http://localhost:3000/admin.html</a></span>`;
        }
        alert("It looks like you opened admin.html directly from your computer files (file://). To use the database and secure OTP registrations, please open the website through the running server at: http://localhost:3000/admin.html");
        return;
    }

    // Credentials Login Submit
    const loginForm = document.querySelector("#admin-login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.querySelector("#admin-email").value.trim();
            const password = document.querySelector("#admin-password").value.trim();
            const errEl = document.querySelector("#admin-auth-error");

            errEl.innerText = "";

            try {
                const res = await fetch('/api/admin/request-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    toggleAdminAuthView('otp');
                    
                    console.log(`Securely generated mock Login OTP: ${data.mockOtp}`);
                    alert(`Vault security verification required. [Simulated OTP Code: ${data.mockOtp}]`);
                } else {
                    const err = await res.json();
                    errEl.innerText = err.error || "Vault verification failed.";
                }
            } catch {
                errEl.innerText = "Secure gateway communication error.";
            }
        });
    }

    // Login OTP Token Submit
    const otpForm = document.querySelector("#admin-otp-form");
    if (otpForm) {
        otpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.querySelector("#admin-email").value.trim();
            const otp = document.querySelector("#admin-otp").value.trim();
            const errEl = document.querySelector("#admin-auth-error");

            errEl.innerText = "";

            try {
                const res = await fetch('/api/admin/verify-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });

                if (res.ok) {
                    await checkAdminSession();
                } else {
                    const err = await res.json();
                    errEl.innerText = err.error || "Invalid security OTP code.";
                }
            } catch {
                errEl.innerText = "OTP authorization gateway communication error.";
            }
        });
    }

    // Registration Credentials Submit
    const regForm = document.querySelector("#admin-register-form");
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.querySelector("#admin-reg-name").value.trim();
            const email = document.querySelector("#admin-reg-email").value.trim();
            const password = document.querySelector("#admin-reg-password").value.trim();
            const phone = document.querySelector("#admin-reg-phone").value.trim();
            const role = document.querySelector("#admin-reg-role").value;
            const errEl = document.querySelector("#admin-auth-error");

            errEl.innerText = "";

            try {
                const res = await fetch('/api/admin/request-registration-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, phone, role })
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    toggleAdminAuthView('reg-otp');
                    
                    console.log(`Securely generated mock Registration OTP: ${data.mockOtp}`);
                    alert(`SMS phone verification required. [Simulated OTP Code: ${data.mockOtp}]`);
                } else {
                    const err = await res.json();
                    errEl.innerText = err.error || "Registration validation failed.";
                }
            } catch {
                errEl.innerText = "Registration gateway communication error.";
            }
        });
    }

    // Registration Phone OTP Verification Submit
    const regOtpForm = document.querySelector("#admin-reg-otp-form");
    if (regOtpForm) {
        regOtpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.querySelector("#admin-reg-email").value.trim();
            const otp = document.querySelector("#admin-reg-otp").value.trim();
            const errEl = document.querySelector("#admin-auth-error");

            errEl.innerText = "";

            try {
                const res = await fetch('/api/admin/verify-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });

                if (res.ok) {
                    alert("Atelier Administrator Registration Secured! Welcome to Jwellery.");
                    await checkAdminSession();
                } else {
                    const err = await res.json();
                    errEl.innerText = err.error || "Invalid security OTP code.";
                }
            } catch {
                errEl.innerText = "OTP registration verification communication error.";
            }
        });
    }

    // Bind Product CRUD submissions
    const prodForm = document.querySelector("#product-crud-form");
    if (prodForm) {
        prodForm.addEventListener("submit", submitProductCrud);
    }
}

function resetAdminAuthGate() {
    toggleAdminAuthView('login');
}

async function logoutAdmin() {
    try {
        const res = await fetch('/api/admin/logout', { method: 'POST' });
        if (res.ok) {
            CURRENT_ADMIN = null;
            showLoginGate();
            resetAdminAuthGate();
            alert("Vault session securely terminated.");
        }
    } catch {
        alert("Logout error.");
    }
}

// --- SIDEBAR TAB INTERACTION ---

function setupAdminNavigation() {
    const navButtons = document.querySelectorAll(".nav-link-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            navButtons.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            const tabId = e.currentTarget.getAttribute("data-tab");
            
            // Switch panels
            const panels = document.querySelectorAll(".admin-tab-panel");
            panels.forEach(p => p.classList.remove("active"));
            document.querySelector(`#panel-${tabId}`).classList.add("active");

            // Load data
            await loadTabContent(tabId);
        });
    });
}

async function loadTabContent(tabId) {
    if (tabId === "analytics") {
        await loadAnalyticsTab();
    } else if (tabId === "products") {
        await loadProductsTab();
    } else if (tabId === "orders") {
        await loadOrdersTab();
    } else if (tabId === "customers") {
        await loadCustomersTab();
    }
}

// --- TAB CONTROLLER: ANALYTICS ---

async function loadAnalyticsTab() {
    try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
            const data = await res.json();
            
            // Populate counters
            document.querySelector("#stat-revenue").innerText = `₹${data.totals.revenue.toLocaleString('en-IN')}`;
            document.querySelector("#stat-orders").innerText = data.totals.orders;
            document.querySelector("#stat-customers").innerText = data.totals.customers;
            document.querySelector("#stat-pending").innerText = data.totals.pendingOrders;

            // Highlight low stock warning card if active
            const lowStockText = data.totals.lowStock > 0 ? `⚠️ ${data.totals.lowStock} alert levels` : "0 alerts";
            
            // Render Chart.js
            renderRevenueChart(data.charts.weeklyRevenue);
            renderCategoryChart(data.charts.categories, data.charts.categoryRevenue);
        }
    } catch (err) {
        console.error("Failed to render dashboard metrics:", err);
    }
}

function renderRevenueChart(weeklyData) {
    const ctx = document.querySelector("#weeklyRevenueChart").getContext("2d");
    if (weeklyChartRef) weeklyChartRef.destroy();

    weeklyChartRef = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{
                label: 'Gross Sales (₹)',
                data: weeklyData,
                borderColor: '#B88E8D', // Rose Gold
                backgroundColor: 'rgba(184, 142, 141, 0.15)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#BFAFA8' } },
                x: { grid: { display: false }, ticks: { color: '#BFAFA8' } }
            }
        }
    });
}

function renderCategoryChart(categories, revenues) {
    const ctx = document.querySelector("#categoryRevenueChart").getContext("2d");
    if (categoryChartRef) categoryChartRef.destroy();

    categoryChartRef = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => c.toUpperCase()),
            datasets: [{
                data: revenues,
                backgroundColor: [
                    '#B88E8D', // Rose Gold
                    '#D4A373', // Champagne Gold
                    '#E8C5C8', // Bright Blush
                    '#C69A9D', // Antique Rose
                    '#7E6C66'  // Charcoal Tint
                ],
                borderWidth: 1,
                borderColor: '#1A1716'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#BFAFA8', boxWidth: 12 } }
            }
        }
    });
}

// --- TAB CONTROLLER: PRODUCTS CRUD ---

async function loadProductsTab() {
    try {
        const res = await fetch('/api/products');
        if (res.ok) {
            PRODUCTS_CACHE = await res.json();
            const tableBody = document.querySelector("#products-table-body");
            if (!tableBody) return;

            tableBody.innerHTML = PRODUCTS_CACHE.map(p => {
                const stockStyle = p.stock <= 0 ? "stock-out-badge" : p.stock < 10 ? "low-stock-badge" : "";
                const stockText = p.stock <= 0 ? "Out of Stock" : p.stock < 10 ? `Low Stock (${p.stock})` : `${p.stock} units`;

                return `
                    <tr id="table-row-prod-${p.id}">
                        <td style="display:flex; align-items:center; gap: 1rem;">
                            <img src="${p.image}" alt="${p.name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid var(--glass-border);" />
                            <div>
                                <strong style="color:#FFFFFF;">${p.name}</strong><br>
                                <span style="font-size:0.75rem; color:var(--accent-rose);">${p.id}</span>
                            </div>
                        </td>
                        <td><span class="badge-status processing">${p.category}</span></td>
                        <td><strong>₹${p.price.toLocaleString('en-IN')}</strong></td>
                        <td><span class="${stockStyle}">${stockText}</span></td>
                        <td style="font-size:0.75rem; color:var(--text-secondary);">
                            Metal: ${p.details.metal}<br>
                            Weight: ${p.details.weight}
                        </td>
                        <td>
                            <div class="table-actions">
                                <button class="btn-action" onclick="openEditProductForm('${p.id}')">Edit</button>
                                <button class="btn-action btn-delete" onclick="deleteProductClick('${p.id}')">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    } catch (err) {
        console.error("Failed to load products list:", err);
    }
}

function openProductFormModal() {
    // Reset Form
    document.querySelector("#product-crud-form").reset();
    document.querySelector("#form-product-id").value = "";
    document.querySelector("#form-image-custom").style.display = "none";
    document.querySelector("#form-image-custom").value = "";
    document.querySelector("#product-form-title").innerText = "Acquire New Ornament";
    
    document.querySelector("#product-form-modal").classList.add("open");
    document.querySelector("#admin-overlay").classList.add("visible");
}

function closeProductFormModal() {
    document.querySelector("#product-form-modal").classList.remove("open");
    document.querySelector("#admin-overlay").classList.remove("visible");
}

function openEditProductForm(id) {
    const prod = PRODUCTS_CACHE.find(p => p.id === id);
    if (!prod) return;

    // Fill Form fields
    document.querySelector("#form-product-id").value = prod.id;
    document.querySelector("#form-name").value = prod.name;
    document.querySelector("#form-category").value = prod.category;
    document.querySelector("#form-price").value = prod.price;
    document.querySelector("#form-stock").value = prod.stock;
    
    const standardImages = [
        "assets/images/ring_premium.png",
        "assets/images/necklace_elegant.png",
        "assets/images/bangles_minimal.png",
        "assets/images/earrings_studs.png",
        "assets/images/anklet_fashion.png"
    ];
    if (standardImages.includes(prod.image)) {
        document.querySelector("#form-image").value = prod.image;
        document.querySelector("#form-image-custom").style.display = "none";
        document.querySelector("#form-image-custom").value = "";
    } else {
        document.querySelector("#form-image").value = "custom";
        document.querySelector("#form-image-custom").style.display = "block";
        document.querySelector("#form-image-custom").value = prod.image;
    }

    document.querySelector("#form-description").value = prod.description || "";
    
    document.querySelector("#form-spec-metal").value = prod.details.metal || "18k Solid Rose Gold";
    document.querySelector("#form-spec-stone").value = prod.details.stone || "";
    document.querySelector("#form-spec-weight").value = prod.details.weight || "";
    document.querySelector("#form-spec-origin").value = prod.details.origin || "Handcrafted in Delhi, India";

    document.querySelector("#product-form-title").innerText = `Refine Jewel: #${prod.id}`;
    
    document.querySelector("#product-form-modal").classList.add("open");
    document.querySelector("#admin-overlay").classList.add("visible");
}

async function submitProductCrud(e) {
    e.preventDefault();

    const id = document.querySelector("#form-product-id").value;
    const name = document.querySelector("#form-name").value.trim();
    const category = document.querySelector("#form-category").value;
    const price = document.querySelector("#form-price").value;
    const stock = document.querySelector("#form-stock").value;
    
    let image = document.querySelector("#form-image").value;
    if (image === "custom") {
        image = document.querySelector("#form-image-custom").value.trim() || "assets/images/ring_premium.png";
    }

    const description = document.querySelector("#form-description").value.trim();

    const metal = document.querySelector("#form-spec-metal").value.trim();
    const stone = document.querySelector("#form-spec-stone").value.trim();
    const weight = document.querySelector("#form-spec-weight").value.trim();
    const origin = document.querySelector("#form-spec-origin").value.trim();

    const payload = {
        name,
        category,
        price,
        stock,
        image,
        description,
        details: { metal, stone, weight, origin }
    };

    const isEdit = id.length > 0;
    const url = isEdit ? `/api/products/${id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeProductFormModal();
            await loadProductsTab();
            alert("Jewel records synchronized successfully.");
        } else {
            const err = await res.json();
            alert(`Record error: ${err.error}`);
        }
    } catch {
        alert("CRUD communication server error.");
    }
}

async function deleteProductClick(id) {
    if (!confirm(`Are you absolutely sure you want to delete Jewel #${id} from catalog registers?`)) return;

    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadProductsTab();
            alert("Jewel deleted successfully.");
        } else {
            alert("Deletion failed.");
        }
    } catch {
        alert("Server communication error.");
    }
}

// --- TAB CONTROLLER: ORDERS FULFILLMENT ---

async function loadOrdersTab() {
    try {
        const res = await fetch('/api/orders');
        if (res.ok) {
            ORDERS_CACHE = await res.json();
            const tableBody = document.querySelector("#orders-table-body");
            if (!tableBody) return;

            tableBody.innerHTML = ORDERS_CACHE.map(o => {
                const dateStr = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                
                return `
                    <tr id="table-row-order-${o.id}">
                        <td>
                            <strong style="color:#FFFFFF;">#${o.id}</strong><br>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
                        </td>
                        <td>
                            <strong>${o.customerName}</strong><br>
                            <span style="font-size:0.75rem; color:var(--text-secondary);">${o.email}</span><br>
                            <span style="font-size:0.75rem; color:var(--accent-rose);">${o.phone}</span>
                        </td>
                        <td>
                            <span style="font-size:0.8rem; font-weight:500;">${o.items.length} items</span><br>
                            <span style="font-size:0.7rem; color:var(--text-secondary);">
                                ${o.items.map(i => `${i.name} (x${i.quantity})`).join(", ")}
                            </span>
                        </td>
                        <td><strong style="color:var(--accent-gold);">₹${o.totalAmount.toLocaleString('en-IN')}</strong></td>
                        <td style="font-size:0.8rem;">
                            ${o.address}, ${o.city} — ${o.zip}
                        </td>
                        <td>
                            <select class="badge-status ${o.status}" onchange="updateOrderStatus('${o.id}', this.value)" style="border:none; outline:none; font-family:inherit; cursor:pointer;">
                                <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                                <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    } catch (err) {
        console.error("Failed to load orders:", err);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            await loadOrdersTab();
            alert("Order shipment state updated successfully.");
        } else {
            alert("Failed to modify order status.");
        }
    } catch {
        alert("Server order sync communication error.");
    }
}

// --- TAB CONTROLLER: CUSTOMER DIRECTORY ---

async function loadCustomersTab() {
    try {
        // Query users through server files auth profiles
        const res = await fetch('/api/analytics');
        if (res.ok) {
            // Simulated retrieval of basic registration profiles via internal analytic calculations
            const userRes = await fetch('/api/orders'); // list customer order frequencies
            const orders = await userRes.json();
            
            // Collect unique customers
            const clients = {};
            orders.forEach(o => {
                clients[o.email.toLowerCase()] = {
                    name: o.customerName,
                    email: o.email,
                    ordersCount: (clients[o.email.toLowerCase()]?.ordersCount || 0) + 1,
                    city: o.city,
                    date: o.createdAt
                };
            });

            const tableBody = document.querySelector("#customers-table-body");
            if (!tableBody) return;

            const clientList = Object.values(clients);
            if (clientList.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No customer orders logged in registry yet.</td></tr>`;
                return;
            }

            tableBody.innerHTML = clientList.map(c => {
                const dateStr = new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                return `
                    <tr>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.email}</td>
                        <td><strong>${c.ordersCount} acquisitions</strong></td>
                        <td><span style="color:#2ecc71;">Active Shopper</span></td>
                        <td style="font-size:0.8rem; color:var(--text-secondary);">${dateStr} (${c.city})</td>
                    </tr>
                `;
            }).join("");
        }
    } catch {
        console.error("Failed to load customer list.");
    }
}

function toggleCustomImageInput(val) {
    const customInput = document.querySelector("#form-image-custom");
    if (val === "custom") {
        customInput.style.display = "block";
        customInput.required = true;
    } else {
        customInput.style.display = "none";
        customInput.required = false;
        customInput.value = "";
    }
}

// Window bindings
window.logoutAdmin = logoutAdmin;
window.resetAdminAuthGate = resetAdminAuthGate;
window.openProductFormModal = openProductFormModal;
window.closeProductFormModal = closeProductFormModal;
window.openEditProductForm = openEditProductForm;
window.deleteProductClick = deleteProductClick;
window.updateOrderStatus = updateOrderStatus;
window.toggleCustomImageInput = toggleCustomImageInput;
window.toggleAdminAuthView = toggleAdminAuthView;
