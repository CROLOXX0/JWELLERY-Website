/* ==========================================================================
   Jwellery Client Controller & API Integration Flow
   ========================================================================== */

// --- GLOBAL STATE ---
const STATE = {
    theme: localStorage.getItem("jwellery-theme") || "dark",
    cart: JSON.parse(localStorage.getItem("jwellery-cart")) || [],
    wishlist: JSON.parse(localStorage.getItem("jwellery-wishlist")) || [],
    activeCategory: "all",
    searchQuery: "",
    user: null, // Logged in user info
    orders: [], // Logged in user order history
    couponApplied: null,
    coupons: {
        "DELHI20": { discount: 0.20, desc: "20% Delhi NCR Special Discount" },
        "ROSEGOLD": { discount: 0.10, desc: "10% Welcome Discount" }
    }
};

// Global Products collection loaded from database
let PRODUCTS_CACHE = [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    // Check if loaded via local file protocol
    if (window.location.protocol === 'file:') {
        alert("⚠️ It looks like you opened the index.html file directly from your computer (via file://).\nTo enjoy the full-stack database, shopper accounts, and cart synchronization features, please open the website through the running local server at:\nhttp://localhost:3000");
        const promo = document.querySelector(".promo-banner");
        if (promo) {
            promo.innerHTML = `<span style="color:#e74c3c; font-weight:600;">⚠️ Opened via file://. Please open the website through the running local server at: <a href="http://localhost:3000" style="color:var(--accent-rose); text-decoration:underline;">http://localhost:3000</a></span>`;
        }
        return;
    }

    // Set initial theme
    document.documentElement.setAttribute("data-theme", STATE.theme);
    updateThemeIcon();

    // Check existing User session
    await checkUserSession();

    // Load dynamic Products
    await fetchProducts();

    // Event Bindings
    setupEventHandlers();
});

// --- CORE API INTERACTION ---

async function fetchProducts() {
    try {
        const res = await fetch(`/api/products?category=${STATE.activeCategory}&search=${STATE.searchQuery}`);
        if (res.ok) {
            PRODUCTS_CACHE = await res.json();
            renderProducts();
        }
    } catch (err) {
        console.error("Failed to load products:", err);
    }
}

async function checkUserSession() {
    try {
        const res = await fetch('/api/auth/profile');
        if (res.ok) {
            const data = await res.json();
            STATE.user = { name: data.name, email: data.email };
            STATE.orders = data.orders || [];
            
            // Merge in-memory cart with database cart
            if (data.cart && data.cart.length > 0) {
                STATE.cart = mergeCarts(STATE.cart, data.cart);
            }
            if (data.wishlist && data.wishlist.length > 0) {
                STATE.wishlist = [...new Set([...STATE.wishlist, ...data.wishlist])];
            }

            localStorage.setItem("jwellery-cart", JSON.stringify(STATE.cart));
            localStorage.setItem("jwellery-wishlist", JSON.stringify(STATE.wishlist));
            
            updateUserNavUI(true);
        } else {
            STATE.user = null;
            updateUserNavUI(false);
        }
    } catch {
        STATE.user = null;
        updateUserNavUI(false);
    }
}

function mergeCarts(localCart, serverCart) {
    const merged = [...serverCart];
    localCart.forEach(localItem => {
        const existing = merged.find(sItem => sItem.id === localItem.id);
        if (existing) {
            existing.quantity = Math.max(existing.quantity, localItem.quantity);
        } else {
            merged.push(localItem);
        }
    });
    return merged;
}

async function syncStateWithServer() {
    if (!STATE.user) return;
    try {
        await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cart: STATE.cart,
                wishlist: STATE.wishlist
            })
        });
    } catch (err) {
        console.error("Cart sync failed:", err);
    }
}

// --- RENDERING FUNCTIONS ---

function renderProducts() {
    const grid = document.querySelector("#product-grid");
    if (!grid) return;

    if (PRODUCTS_CACHE.length === 0) {
        grid.innerHTML = `
            <div class="empty-search-container reveal-fade" style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
                <h3 class="serif-title" style="font-size: 2.2rem; margin-bottom: 1rem; color: var(--accent-rose);">No Jewels Found</h3>
                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 2rem auto;">
                    We couldn't find matches. Explore other categories or reduce details.
                </p>
                <button class="btn btn-primary" onclick="resetFilters()">Reset Explorer</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = PRODUCTS_CACHE.map(p => {
        const inWishlist = STATE.wishlist.includes(p.id);
        const wishIcon = inWishlist ? "♥" : "♡";
        const wishClass = inWishlist ? "active" : "";
        const stockStatus = p.stock <= 0 ? `<span class="stock-out-badge">Out of Stock</span>` : 
                            p.stock < 5 ? `<span class="low-stock-badge">Only ${p.stock} left!</span>` : "";

        return `
            <div class="luxury-card product-card" data-id="${p.id}" onclick="openProductDetails('${p.id}')">
                <div class="shimmer-overlay"></div>
                <div class="card-img-container">
                    <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy" />
                    <button class="wishlist-overlay-btn ${wishClass}" onclick="toggleWishlist(event, '${p.id}')" aria-label="Add to Wishlist">
                        ${wishIcon}
                    </button>
                    ${p.featured ? '<span class="luxury-tag">Delhi Boutique Excl.</span>' : ''}
                    ${stockStatus}
                </div>
                <div class="card-meta">
                    <span class="product-category-lbl">${p.category.toUpperCase()}</span>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="product-stars">
                        <span>★ ${p.rating.toFixed(1)}</span>
                        <span class="reviews-num">(${p.reviewsCount})</span>
                    </div>
                    <div class="product-price-row">
                        <span class="product-price">₹${p.price.toLocaleString('en-IN')}</span>
                        ${p.stock > 0 ? `
                            <button class="btn btn-outline btn-magnetic" onclick="addToCartClick(event, '${p.id}')">
                                Add to Cart
                            </button>
                        ` : `
                            <button class="btn btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;">Sold Out</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Attach hover shimmer effect
    const cards = grid.querySelectorAll(".product-card");
    cards.forEach(card => {
        card.addEventListener("mousemove", (e) => {
            if (window.applyBrillianceShine) window.applyBrillianceShine(card, e);
        });
    });
}

function updateUserNavUI(isLoggedIn) {
    const authBtn = document.querySelector("#nav-auth-btn");
    if (!authBtn) return;
    
    if (isLoggedIn) {
        authBtn.innerHTML = `👤 ${STATE.user.name.split(" ")[0]}`;
        authBtn.style.color = "var(--accent-rose)";
        authBtn.onclick = openProfileModal;
    } else {
        authBtn.innerHTML = `👤`;
        authBtn.style.color = "var(--text-primary)";
        authBtn.onclick = openAuthModal;
    }
}

// --- STATE MANAGEMENT ---

function addToCartClick(event, productId) {
    event.stopPropagation();
    
    const prod = PRODUCTS_CACHE.find(p => p.id === productId);
    if (!prod) return;

    const item = STATE.cart.find(x => x.id === productId);
    if (item && item.quantity >= prod.stock) {
        alert(`Cannot add more! Only ${prod.stock} items are in stock.`);
        return;
    }

    addToCart(productId);
    if (window.animateFlyToCart) window.animateFlyToCart(event);
}

function addToCart(id, qty = 1) {
    const item = STATE.cart.find(x => x.id === id);
    if (item) {
        item.quantity += qty;
    } else {
        STATE.cart.push({ id, quantity: qty });
    }
    
    localStorage.setItem("jwellery-cart", JSON.stringify(STATE.cart));
    updateCartUI();
    syncStateWithServer();
}

function updateQuantity(id, change) {
    const item = STATE.cart.find(x => x.id === id);
    if (item) {
        const prod = PRODUCTS_CACHE.find(p => p.id === id);
        if (change > 0 && prod && item.quantity >= prod.stock) {
            alert(`Sorry, only ${prod.stock} pieces are in stock at our Delhi atelier.`);
            return;
        }

        item.quantity += change;
        if (item.quantity <= 0) {
            STATE.cart = STATE.cart.filter(x => x.id !== id);
        }
    }
    localStorage.setItem("jwellery-cart", JSON.stringify(STATE.cart));
    updateCartUI();
    syncStateWithServer();

    if (document.querySelector("#checkout-modal").classList.contains("open")) {
        populateCheckoutSummary();
    }
}

function removeFromCart(id) {
    STATE.cart = STATE.cart.filter(x => x.id !== id);
    localStorage.setItem("jwellery-cart", JSON.stringify(STATE.cart));
    updateCartUI();
    syncStateWithServer();

    if (document.querySelector("#checkout-modal").classList.contains("open")) {
        populateCheckoutSummary();
    }
}

function getCartTotal() {
    return STATE.cart.reduce((sum, item) => {
        const prod = PRODUCTS_CACHE.find(p => p.id === item.id);
        return sum + (prod ? prod.price * item.quantity : 0);
    }, 0);
}

function updateCartUI() {
    const badge = document.querySelector("#cart-count");
    const count = STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? "flex" : "none";
    }

    const drawerList = document.querySelector("#cart-items-list");
    const subtotalText = document.querySelector("#cart-subtotal-price");
    
    if (!drawerList || !subtotalText) return;

    if (STATE.cart.length === 0) {
        drawerList.innerHTML = `
            <div class="empty-cart-view" style="text-align:center; padding: 5rem 1.5rem; color: var(--text-secondary);">
                <p style="font-size: 1.2rem; margin-bottom: 2rem; font-family: var(--font-serif); font-style: italic;">"Your jewel trunk feels weightless..."</p>
                <button class="btn btn-outline" onclick="document.querySelector('#close-cart-btn').click()">Discover Fine Pieces</button>
            </div>
        `;
        subtotalText.innerText = "₹0";
        return;
    }

    drawerList.innerHTML = STATE.cart.map(item => {
        const prod = PRODUCTS_CACHE.find(p => p.id === item.id);
        if (!prod) return "";
        return `
            <div class="cart-item">
                <img src="${prod.image}" alt="${prod.name}" class="cart-item-img" />
                <div class="cart-item-details">
                    <h4 class="cart-item-name">${prod.name}</h4>
                    <span class="cart-item-price">₹${prod.price.toLocaleString('en-IN')}</span>
                    <div class="cart-qty-ctrl">
                        <button onclick="updateQuantity('${item.id}', -1)" aria-label="Decrease Qty">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity('${item.id}', 1)" aria-label="Increase Qty">+</button>
                    </div>
                </div>
                <button class="cart-remove-btn" onclick="removeFromCart('${item.id}')" aria-label="Remove item">✕</button>
            </div>
        `;
    }).join("");

    subtotalText.innerText = `₹${getCartTotal().toLocaleString('en-IN')}`;
}

function toggleWishlist(event, id) {
    event.stopPropagation();
    
    const index = STATE.wishlist.indexOf(id);
    if (index === -1) {
        STATE.wishlist.push(id);
    } else {
        STATE.wishlist.splice(index, 1);
    }

    localStorage.setItem("jwellery-wishlist", JSON.stringify(STATE.wishlist));
    updateWishlistUI();
    renderProducts();
    syncStateWithServer();
}

function updateWishlistUI() {
    const countBadge = document.querySelector("#wishlist-count");
    if (countBadge) {
        countBadge.innerText = STATE.wishlist.length;
        countBadge.style.display = STATE.wishlist.length > 0 ? "flex" : "none";
    }
}

// --- DIALOG MODALS INTERACTION ---

function openProductDetails(id) {
    const prod = PRODUCTS_CACHE.find(p => p.id === id);
    if (!prod) return;

    const modal = document.querySelector("#product-detail-modal");
    const detailsContainer = document.querySelector("#detail-modal-content");
    const overlay = document.querySelector("#overlay");

    if (!modal || !detailsContainer || !overlay) return;

    const inWishlist = STATE.wishlist.includes(prod.id);
    const wishText = inWishlist ? "Remove from Trunk" : "Add to Wishlist Trunk";
    const chainRow = prod.details.chainLength ? `<p><strong>Chain:</strong> ${prod.details.chainLength}</p>` : "";
    const sizeRow = prod.details.sizes ? `
        <div class="size-selector-row">
            <span class="spec-label">Ring Size:</span>
            <div class="sizes-wrap">
                ${prod.details.sizes.map((s, idx) => `<button class="size-badge ${idx === 1 ? 'active' : ''}">${s}</button>`).join("")}
            </div>
        </div>
    ` : "";

    detailsContainer.innerHTML = `
        <div class="modal-detail-grid">
            <div class="modal-detail-gallery">
                <img src="${prod.image}" alt="${prod.name}" class="detail-main-img" />
            </div>
            <div class="modal-detail-info">
                <span class="collection-tag">${prod.category.toUpperCase()} COLLECTION</span>
                <h2 class="serif-title detail-title">${prod.name}</h2>
                <div class="detail-reviews">
                    <span class="stars">★★★★★</span>
                    <span>${prod.rating} / 5.0 (${prod.reviewsCount} verified reviews)</span>
                </div>
                <p class="detail-description">${prod.description}</p>
                
                <div class="luxury-divider"></div>
                
                <div class="technical-specs">
                    <h4 class="specs-title">Fine Details & Craftsmanship</h4>
                    <p><strong>Metal:</strong> ${prod.details.metal}</p>
                    <p><strong>Stone:</strong> ${prod.details.stone || "N/A"}</p>
                    <p><strong>Weight:</strong> ${prod.details.weight}</p>
                    <p><strong>Origin:</strong> ${prod.details.origin}</p>
                    ${chainRow}
                </div>

                ${sizeRow}

                <div class="price-action-row">
                    <div class="price-val">₹${prod.price.toLocaleString('en-IN')}</div>
                    <div class="actions-group">
                        ${prod.stock > 0 ? `
                            <button class="btn btn-primary btn-magnetic" onclick="addToCartFromDetail(event, '${prod.id}')">
                                Acquire Jewel
                            </button>
                        ` : `
                            <button class="btn btn-primary" disabled style="opacity: 0.6; cursor: not-allowed;">Sold Out</button>
                        `}
                        <button class="btn btn-outline" onclick="toggleWishlistFromDetail(event, '${prod.id}')">
                            ${wishText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add("open");
    overlay.classList.add("visible");
}

function addToCartFromDetail(event, id) {
    addToCart(id);
    closeProductDetailModal();
    document.querySelector("#cart-btn").click();
}

function toggleWishlistFromDetail(event, id) {
    toggleWishlist(event, id);
    openProductDetails(id);
}

function closeProductDetailModal() {
    const modal = document.querySelector("#product-detail-modal");
    const overlay = document.querySelector("#overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
}

// --- AUTH MODALS (LOGIN / SIGNUP) ---

function openAuthModal() {
    const modal = document.querySelector("#auth-modal");
    const overlay = document.querySelector("#overlay");
    if (modal && overlay) {
        modal.classList.add("open");
        overlay.classList.add("visible");
    }
}

function closeAuthModal() {
    const modal = document.querySelector("#auth-modal");
    const overlay = document.querySelector("#overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
}

function toggleAuthView(showSignup) {
    const loginWrap = document.querySelector("#auth-login-wrap");
    const signupWrap = document.querySelector("#auth-signup-wrap");
    
    if (showSignup) {
        loginWrap.style.display = "none";
        signupWrap.style.display = "block";
    } else {
        loginWrap.style.display = "block";
        signupWrap.style.display = "none";
    }
}

// --- PROFILE & ORDER HISTORY ---

function openProfileModal() {
    const modal = document.querySelector("#profile-modal");
    const overlay = document.querySelector("#overlay");
    const detailsContainer = document.querySelector("#profile-modal-content");

    if (!modal || !detailsContainer || !overlay) return;

    const ordersHtml = STATE.orders.length === 0 ? `
        <p style="color:var(--text-secondary); font-style: italic;">No orders placed yet. Explore Jwellery signature pieces above!</p>
    ` : STATE.orders.map(order => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusColors = {
            "pending": "#f1c40f",
            "processing": "#3498db",
            "shipped": "#2ecc71",
            "cancelled": "#e74c3c"
        };
        const color = statusColors[order.status] || "var(--text-secondary)";

        return `
            <div class="profile-order-card" style="border: 1px solid var(--glass-border); padding: 1.2rem; border-radius: var(--border-radius-sm); margin-bottom: 1rem; background-color: var(--bg-secondary);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                    <strong>Order #${order.id}</strong>
                    <span style="color: ${color}; font-weight:600; text-transform:uppercase; font-size:0.75rem;">● ${order.status}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom: 0.8rem;">
                    Placed on: ${dateStr} | Total: ₹${order.totalAmount.toLocaleString('en-IN')}
                </div>
                <div style="font-size:0.8rem;">
                    ${order.items.map(item => `• ${item.name} (x${item.quantity})`).join("<br>")}
                </div>
            </div>
        `;
    }).join("");

    detailsContainer.innerHTML = `
        <h2 class="serif-title" style="font-size: 2.2rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.8rem;">Your Atelier Account</h2>
        <div style="margin-bottom: 2rem;">
            <p><strong>Name:</strong> ${STATE.user.name}</p>
            <p><strong>Email:</strong> ${STATE.user.email}</p>
            <button class="btn btn-outline" onclick="logoutUser()" style="margin-top: 1rem; padding: 0.4rem 1.2rem; font-size:0.7rem;">Sign Out</button>
        </div>
        
        <h3 class="serif-title" style="font-size:1.6rem; margin-bottom: 1.2rem;">Ornaments History</h3>
        <div class="orders-scroll-list" style="max-height: 280px; overflow-y:auto; padding-right:5px;">
            ${ordersHtml}
        </div>
    `;

    modal.classList.add("open");
    overlay.classList.add("visible");
}

function closeProfileModal() {
    const modal = document.querySelector("#profile-modal");
    const overlay = document.querySelector("#overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
}

async function logoutUser() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
            STATE.user = null;
            STATE.orders = [];
            STATE.cart = [];
            STATE.wishlist = [];
            localStorage.removeItem("jwellery-cart");
            localStorage.removeItem("jwellery-wishlist");
            
            updateCartUI();
            updateWishlistUI();
            updateUserNavUI(false);
            closeProfileModal();
            renderProducts();
            
            alert("Signed out successfully. Your trunk is safe.");
        }
    } catch (err) {
        console.error("Logout failed:", err);
    }
}

// --- CHECKOUT SUBMISSION FLOW ---

function populateCheckoutSummary() {
    const cartSummaryWrap = document.querySelector("#checkout-items-summary");
    const subtotalText = document.querySelector("#checkout-subtotal");
    const discountText = document.querySelector("#checkout-discount");
    const totalText = document.querySelector("#checkout-grand-total");

    if (!cartSummaryWrap) return;

    cartSummaryWrap.innerHTML = STATE.cart.map(item => {
        const prod = PRODUCTS_CACHE.find(p => p.id === item.id);
        if (!prod) return "";
        return `
            <div class="summary-line-item">
                <span>${prod.name} (x${item.quantity})</span>
                <span>₹${(prod.price * item.quantity).toLocaleString('en-IN')}</span>
            </div>
        `;
    }).join("");

    const sub = getCartTotal();
    subtotalText.innerText = `₹${sub.toLocaleString('en-IN')}`;

    let disc = 0;
    if (STATE.couponApplied && STATE.coupons[STATE.couponApplied]) {
        disc = sub * STATE.coupons[STATE.couponApplied].discount;
    }
    discountText.innerText = `- ₹${disc.toLocaleString('en-IN')}`;

    const grand = sub - disc;
    totalText.innerText = `₹${grand.toLocaleString('en-IN')}`;
}

async function submitCheckoutOrder(e) {
    e.preventDefault();

    const name = document.querySelector("#checkout-name").value.trim();
    const email = document.querySelector("#checkout-email").value.trim();
    const phone = document.querySelector("#checkout-phone").value.trim();
    const address = document.querySelector("#checkout-address").value.trim();
    const city = document.querySelector("#checkout-city").value;
    const zip = document.querySelector("#checkout-zip").value.trim();
    const paymentMode = document.querySelector("#checkout-payment-mode").value;

    const items = STATE.cart.map(item => {
        const prod = PRODUCTS_CACHE.find(p => p.id === item.id);
        return {
            id: item.id,
            name: prod.name,
            price: prod.price,
            quantity: item.quantity
        };
    });

    const sub = getCartTotal();
    const disc = STATE.couponApplied ? sub * STATE.coupons[STATE.couponApplied].discount : 0;
    const grandTotal = sub - disc;

    const orderPayload = {
        customerName: name,
        email,
        phone,
        address,
        city,
        zip,
        items,
        totalAmount: grandTotal,
        discountCode: STATE.couponApplied,
        paymentMethod: paymentMode
    };

    // Show processing portal
    const portal = document.querySelector("#payment-portal-overlay");
    if (portal) portal.classList.add("active");

    const statusEl = document.querySelector("#payment-status-text");
    const loaderCircle = document.querySelector(".payment-loader-spinner");
    if (statusEl) statusEl.innerText = "Authorizing transaction secure protocol...";

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (res.ok) {
            const data = await res.json();
            
            // Wait slightly for animation flow
            setTimeout(async () => {
                if (loaderCircle) {
                    loaderCircle.innerHTML = "✓";
                    loaderCircle.classList.add("payment-success-check");
                }
                if (statusEl) statusEl.innerHTML = `<span style="color:#2ecc71; font-weight:600;">₹${grandTotal.toLocaleString('en-IN')} Secured Successfully!</span>`;
                
                // Complete order clear
                setTimeout(async () => {
                    // Empty Local Trunk
                    STATE.cart = [];
                    localStorage.setItem("jwellery-cart", JSON.stringify(STATE.cart));
                    updateCartUI();
                    
                    // Sync clean state
                    await syncStateWithServer();

                    // Refresh caches
                    await checkUserSession();
                    await fetchProducts();

                    // Close views
                    if (portal) portal.classList.remove("active");
                    document.querySelector("#checkout-modal").classList.remove("open");
                    document.querySelector("#overlay").classList.remove("visible");

                    document.querySelector("#order-submission-form").reset();
                    document.querySelector("#coupon-message").innerHTML = "";
                    document.querySelector("#pincode-message").innerHTML = "";
                    STATE.couponApplied = null;

                    alert(`Acquisition Confirmed! Your Order ID is #${data.orderId}. Your premium box is being prepared at Connaught Place.`);

                    if (loaderCircle) {
                        loaderCircle.innerHTML = "";
                        loaderCircle.classList.remove("payment-success-check");
                    }
                }, 2000);
            }, 1500);

        } else {
            const err = await res.json();
            alert(`Transaction Failed: ${err.error}`);
            if (portal) portal.classList.remove("active");
        }
    } catch {
        alert("Atelier server transaction error. Please try again.");
        if (portal) portal.classList.remove("active");
    }
}

// --- AUXILIARY HELPERS ---

function setupEventHandlers() {
    // Theme toggle
    const themeBtn = document.querySelector("#theme-toggle-btn");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            STATE.theme = STATE.theme === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", STATE.theme);
            localStorage.setItem("jwellery-theme", STATE.theme);
            updateThemeIcon();
        });
    }

    // Category Filtering
    const filterBtns = document.querySelectorAll(".category-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            filterBtns.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            STATE.activeCategory = e.currentTarget.getAttribute("data-category");
            await fetchProducts();
        });
    });

    // Real-Time Search Bar
    const searchInput = document.querySelector("#search-bar");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(async (e) => {
            STATE.searchQuery = e.target.value.trim().toLowerCase();
            await fetchProducts();
        }, 300));
    }

    // Side panels
    const cartToggle = document.querySelector("#cart-btn");
    const cartClose = document.querySelector("#close-cart-btn");
    const cartDrawer = document.querySelector("#cart-drawer");
    const overlay = document.querySelector("#overlay");

    if (cartToggle && cartDrawer) {
        cartToggle.addEventListener("click", () => {
            cartDrawer.classList.add("open");
            overlay.classList.add("visible");
        });
    }
    if (cartClose && cartDrawer) {
        cartClose.addEventListener("click", () => {
            cartDrawer.classList.remove("open");
            overlay.classList.remove("visible");
        });
    }

    // Checkout Panel
    const checkoutBtn = document.querySelector("#checkout-btn-trigger");
    const checkoutModal = document.querySelector("#checkout-modal");
    const closeCheckoutBtn = document.querySelector("#close-checkout-btn");

    if (checkoutBtn && checkoutModal) {
        checkoutBtn.addEventListener("click", () => {
            if (STATE.cart.length === 0) {
                alert("Your cart is empty. Explore our exquisite collection to add products!");
                return;
            }
            // Prefill with logged-in user profile details
            if (STATE.user) {
                document.querySelector("#checkout-name").value = STATE.user.name;
                document.querySelector("#checkout-email").value = STATE.user.email;
            }

            populateCheckoutSummary();
            checkoutModal.classList.add("open");
            cartDrawer.classList.remove("open");
            overlay.classList.add("visible");
        });
    }
    if (closeCheckoutBtn && checkoutModal) {
        closeCheckoutBtn.addEventListener("click", () => {
            checkoutModal.classList.remove("open");
            overlay.classList.remove("visible");
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => {
            const openPanels = document.querySelectorAll(".slide-panel.open, .luxury-modal.open");
            openPanels.forEach(panel => panel.classList.remove("open"));
            overlay.classList.remove("visible");
        });
    }

    // Pincode checker
    const pincodeBtn = document.querySelector("#pincode-check-btn");
    if (pincodeBtn) {
        pincodeBtn.addEventListener("click", () => {
            const pincodeVal = document.querySelector("#pincode-input").value.trim();
            const messageEl = document.querySelector("#pincode-message");
            if (/^(1100)[0-9]{2}$/.test(pincodeVal)) {
                messageEl.innerHTML = `<span style="color:#2ecc71;">✓ Express Delivery available in Delhi NCR! Free delivery & same day dispatch.</span>`;
            } else if (pincodeVal.length === 6) {
                messageEl.innerHTML = `<span style="color:var(--accent-gold);">✓ Standard delivery available. Ships in 2-4 working days.</span>`;
            } else {
                messageEl.innerHTML = `<span style="color:#e74c3c;">✗ Please enter a valid 6-digit pin code.</span>`;
            }
        });
    }

    // Coupon Code
    const couponBtn = document.querySelector("#apply-coupon-btn");
    if (couponBtn) {
        couponBtn.addEventListener("click", () => {
            const code = document.querySelector("#coupon-input").value.trim().toUpperCase();
            const messageEl = document.querySelector("#coupon-message");
            if (STATE.coupons[code]) {
                STATE.couponApplied = code;
                messageEl.innerHTML = `<span style="color:#2ecc71;">✓ Code '${code}' applied! Saved ₹${(getCartTotal() * STATE.coupons[code].discount).toLocaleString('en-IN')}</span>`;
                populateCheckoutSummary();
            } else {
                messageEl.innerHTML = `<span style="color:#e74c3c;">✗ Invalid code. Try DELHI20 or ROSEGOLD</span>`;
            }
        });
    }

    // Order Submission Form
    const checkoutForm = document.querySelector("#order-submission-form");
    if (checkoutForm) {
        checkoutForm.addEventListener("submit", submitCheckoutOrder);
    }

    // Authentication Forms
    const loginForm = document.querySelector("#login-submission-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginSubmit);
    }

    const signupForm = document.querySelector("#signup-submission-form");
    if (signupForm) {
        signupForm.addEventListener("submit", handleSignupSubmit);
    }
}

// User Registration Submit
async function handleSignupSubmit(e) {
    e.preventDefault();
    const name = document.querySelector("#signup-name").value.trim();
    const email = document.querySelector("#signup-email").value.trim();
    const password = document.querySelector("#signup-password").value.trim();

    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        if (res.ok) {
            const data = await res.json();
            alert(`Welcome to Jwellery, ${data.user.name}! Your account has been registered.`);
            closeAuthModal();
            
            // Sync cart
            STATE.user = { name: data.user.name, email: data.user.email };
            updateUserNavUI(true);
            await syncStateWithServer();
            await checkUserSession();
        } else {
            const err = await res.json();
            alert(`Signup failed: ${err.error}`);
        }
    } catch {
        alert("Registration server communication error.");
    }
}

// User Login Submit
async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value.trim();

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (res.ok) {
            const data = await res.json();
            alert(`Welcome back, ${data.user.name}!`);
            closeAuthModal();
            
            STATE.user = { name: data.user.name, email: data.user.email };
            updateUserNavUI(true);
            await syncStateWithServer();
            await checkUserSession();
            renderProducts();
        } else {
            const err = await res.json();
            alert(`Login failed: ${err.error}`);
        }
    } catch {
        alert("Login server communication error.");
    }
}

function resetFilters() {
    STATE.activeCategory = "all";
    STATE.searchQuery = "";
    
    const searchBar = document.querySelector("#search-bar");
    if (searchBar) searchBar.value = "";
    
    const filterBtns = document.querySelectorAll(".category-btn");
    filterBtns.forEach(btn => {
        if (btn.getAttribute("data-category") === "all") btn.classList.add("active");
        else btn.classList.remove("active");
    });
    
    fetchProducts();
}

function updateThemeIcon() {
    const themeIcon = document.querySelector("#theme-icon");
    if (themeIcon) {
        themeIcon.innerText = STATE.theme === "light" ? "☾" : "☼";
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Window attachments for detail modal elements
window.resetFilters = resetFilters;
window.closeProductDetailModal = closeProductDetailModal;
window.addToCartFromDetail = addToCartFromDetail;
window.toggleWishlistFromDetail = toggleWishlistFromDetail;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.toggleAuthView = toggleAuthView;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.logoutUser = logoutUser;
window.addToCartClick = addToCartClick;
window.toggleWishlist = toggleWishlist;
window.openProductDetails = openProductDetails;
