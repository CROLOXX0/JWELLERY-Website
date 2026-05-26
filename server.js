/* ==========================================================================
   Jwellery Full-Stack Server
   ========================================================================== */

import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { initDb, UsersDb, ProductsDb, OrdersDb, AdminsDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'luxury_rose_gold_secret_token_123';

// Admin Core Accounts (Multi-Admin configuration)
const MOCK_ADMINS = {
    "admin@jwellery.in": { name: "Ananya Sen", role: "Atelier Owner", password: "admin123" },
    "shayan@jwellery.in": { name: "Shayan Sen", role: "Operations Lead", password: "admin123" }
};
// Store OTPs in-memory
const activeOTPs = {};
const pendingAdminRegistrations = {};

// --- MIDDLEWARES ---
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Secure User Auth Middleware
function authenticateUser(req, res, next) {
    const token = req.cookies.user_token;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.clearCookie('user_token');
        req.user = null;
        next();
    }
}

// Admin Only Middleware
function requireAdmin(req, res, next) {
    const adminToken = req.cookies.admin_token;
    if (!adminToken) {
        return res.status(401).json({ error: "Access Denied. Premium credentials required." });
    }
    try {
        const decoded = jwt.verify(adminToken, JWT_SECRET);
        if (decoded.isAdmin) {
            req.admin = decoded;
            next();
        } else {
            res.status(403).json({ error: "Unauthorized access." });
        }
    } catch {
        res.clearCookie('admin_token');
        res.status(401).json({ error: "Session expired. Log in again." });
    }
}

// --- AUTHENTICATION API ---

// Standard Shopper Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const existing = await UsersDb.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: "Email is already registered with us." });
        }

        // Create new user (simple plain password store for local database demo)
        const newUser = await UsersDb.insert({
            name,
            email: email.toLowerCase(),
            password,
            cart: [],
            wishlist: []
        });

        // Set JWT
        const token = jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('user_token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.status(201).json({ success: true, user: { name: newUser.name, email: newUser.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Standard Shopper Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await UsersDb.findOne({ email: email.toLowerCase() });
        if (!user || user.password !== password) {
            return res.status(400).json({ error: "Invalid email credentials or password." });
        }

        // Set JWT
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('user_token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });

        // Merge cart if client sent one
        res.json({ success: true, user: { name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });
    
    const user = await UsersDb.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: "Account not found." });
    
    // Simulate token recovery
    const resetToken = Math.random().toString(36).substr(2, 6).toUpperCase();
    res.json({ success: true, message: `A recovery code has been sent! [Local Mock Token: ${resetToken}]` });
});

// Sync user cart & wishlist
app.post('/api/auth/sync', authenticateUser, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { cart, wishlist } = req.body;
    
    await UsersDb.update({ id: req.user.id }, { cart: cart || [], wishlist: wishlist || [] });
    res.json({ success: true });
});

// Fetch Shopper Profile & Order History
app.get('/api/auth/profile', authenticateUser, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized session." });
    
    const user = await UsersDb.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: "User profile not found." });

    const orders = await OrdersDb.find({ email: user.email });

    res.json({
        name: user.name,
        email: user.email,
        cart: user.cart || [],
        wishlist: user.wishlist || [],
        orders: orders || []
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('user_token');
    res.json({ success: true });
});

// --- ADMIN SECURITY OTP LOGINS ---

// Admin Requests OTP Verification
app.post('/api/admin/request-otp', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const admin = await AdminsDb.findOne({ email: email.toLowerCase() });
    if (!admin || admin.password !== password) {
        return res.status(400).json({ error: "Invalid administrator credentials." });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    activeOTPs[email.toLowerCase()] = otp;

    // Output simulated OTP in console and response to bypass lack of SMTP gateway
    console.log(`[ADMIN AUTH] Secure OTP for ${email.toLowerCase()} sent to phone ${admin.phone || 'N/A'}: ${otp}`);
    res.json({ 
        success: true, 
        message: `Secure OTP dispatched to registered administrator email!`,
        mockOtp: otp // Send back to make it easier for user to bypass
    });
});

// Admin Submits OTP verification
app.post('/api/admin/verify-login', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Missing authentication arguments." });

    const correctOtp = activeOTPs[email.toLowerCase()];
    if (!correctOtp || correctOtp !== otp.trim()) {
        return res.status(400).json({ error: "Invalid or expired authorization OTP." });
    }

    // Clear active OTP
    delete activeOTPs[email.toLowerCase()];

    const adminInfo = await AdminsDb.findOne({ email: email.toLowerCase() });

    // Generate Admin JWT Token
    const adminToken = jwt.sign({ 
        email: email.toLowerCase(),
        name: adminInfo.name,
        role: adminInfo.role,
        isAdmin: true
    }, JWT_SECRET, { expiresIn: '1d' });

    res.cookie('admin_token', adminToken, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, admin: { name: adminInfo.name, role: adminInfo.role } });
});

// Admin Requests Registration OTP (Phone SMS simulation)
app.post('/api/admin/request-registration-otp', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ error: "Name, email, password, and phone number are required." });
        }

        const existing = await AdminsDb.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: "Email is already registered as administrator." });
        }

        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store in pending queue
        pendingAdminRegistrations[email.toLowerCase()] = {
            name,
            email: email.toLowerCase(),
            password,
            phone,
            role: role || "Staff Member",
            otp
        };

        console.log(`=======================================================`);
        console.log(`[SMS GATEWAY SIMULATION] Secure phone registration code`);
        console.log(`sent to +91 ${phone}: ${otp}`);
        console.log(`=======================================================`);

        res.json({
            success: true,
            message: `Verification OTP dispatched to +91 ${phone}!`,
            mockOtp: otp
        });
    } catch (err) {
        console.error("Error in request-registration-otp:", err);
        res.status(500).json({ error: "Server registration configuration error: " + err.message });
    }
});

// Admin Verifies Registration (Phone SMS simulation)
app.post('/api/admin/verify-registration', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: "Missing verification arguments." });

        const pending = pendingAdminRegistrations[email.toLowerCase()];
        if (!pending || pending.otp !== otp.trim()) {
            return res.status(400).json({ error: "Invalid or expired registration OTP." });
        }

        // Save persistently in database
        const newAdmin = await AdminsDb.insert({
            name: pending.name,
            email: pending.email,
            password: pending.password,
            phone: pending.phone,
            role: pending.role
        });

        // Clear pending
        delete pendingAdminRegistrations[email.toLowerCase()];

        // Generate Admin JWT Token
        const adminToken = jwt.sign({ 
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role,
            isAdmin: true
        }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('admin_token', adminToken, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true, admin: { name: newAdmin.name, role: newAdmin.role } });
    } catch (err) {
        console.error("Error in verify-registration:", err);
        res.status(500).json({ error: "Server phone verification error: " + err.message });
    }
});

app.get('/api/admin/verify-session', requireAdmin, (req, res) => {
    res.json({ authenticated: true, admin: req.admin });
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});


// --- PRODUCTS PUBLIC/ADMIN ENDPOINTS ---

// Get list (supports filters & search queries)
app.get('/api/products', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = {};
        if (category && category !== 'all') {
            query.category = category;
        }

        let products = await ProductsDb.find(query);

        if (search) {
            const queryStr = search.toLowerCase();
            products = products.filter(p => 
                p.name.toLowerCase().includes(queryStr) || 
                p.description.toLowerCase().includes(queryStr)
            );
        }

        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single details
app.get('/api/products/:id', async (req, res) => {
    const product = await ProductsDb.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json(product);
});

// ADMIN ONLY - Create product
app.post('/api/products', requireAdmin, async (req, res) => {
    try {
        const { name, category, price, description, details, stock, image } = req.body;
        if (!name || !category || !price) {
            return res.status(400).json({ error: "Name, category, and price are required." });
        }

        const newProd = await ProductsDb.insert({
            name,
            category,
            price: Number(price),
            rating: 4.8,
            reviewsCount: 1,
            image: image || "assets/images/ring_premium.png",
            hoverImage: image || "assets/images/ring_premium.png",
            description: description || "Exquisite hand-polished lightweight ornament.",
            details: details || {
                metal: "18k Solid Rose Gold",
                stone: "N/A",
                weight: "approx 2.5 grams",
                origin: "Handcrafted in Delhi, India"
            },
            stock: Number(stock) || 10,
            featured: false
        });

        res.status(201).json({ success: true, product: newProd });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN ONLY - Edit product
app.put('/api/products/:id', requireAdmin, async (req, res) => {
    try {
        const { name, category, price, description, details, stock, image } = req.body;
        
        const updates = {};
        if (name) updates.name = name;
        if (category) updates.category = category;
        if (price) updates.price = Number(price);
        if (description) updates.description = description;
        if (details) updates.details = details;
        if (stock !== undefined) updates.stock = Number(stock);
        if (image) updates.image = image;

        const count = await ProductsDb.update({ id: req.params.id }, updates);
        if (count === 0) return res.status(404).json({ error: "Product not found to update." });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN ONLY - Delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    try {
        const count = await ProductsDb.delete({ id: req.params.id });
        if (count === 0) return res.status(404).json({ error: "Product not found to delete." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- ORDERS ENDPOINTS ---

// Place order
app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, email, phone, address, city, zip, items, totalAmount, discountCode, paymentMethod } = req.body;
        
        if (!customerName || !email || !items || items.length === 0) {
            return res.status(400).json({ error: "Incomplete shipping details or empty items trunk." });
        }

        // Validate stock levels first and deduct
        for (const item of items) {
            const prod = await ProductsDb.findOne({ id: item.id });
            if (!prod) return res.status(404).json({ error: `Product '${item.id}' not found.` });
            if (prod.stock < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for product '${prod.name}'. Only ${prod.stock} items remaining.` });
            }
        }

        // Deduct stocks
        for (const item of items) {
            const prod = await ProductsDb.findOne({ id: item.id });
            const newStock = prod.stock - item.quantity;
            await ProductsDb.update({ id: item.id }, { stock: newStock });
        }

        // Generate Order
        const newOrder = await OrdersDb.insert({
            customerName,
            email: email.toLowerCase(),
            phone,
            address,
            city,
            zip,
            items,
            totalAmount: Number(totalAmount),
            discountCode: discountCode || null,
            status: "pending",
            paymentMethod: paymentMethod || "card"
        });

        res.status(201).json({ success: true, orderId: newOrder.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN ONLY - List orders
app.get('/api/orders', requireAdmin, async (req, res) => {
    const orders = await OrdersDb.read();
    res.json(orders);
});

// ADMIN ONLY - Update Order status
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status argument." });
    
    const count = await OrdersDb.update({ id: req.params.id }, { status });
    if (count === 0) return res.status(404).json({ error: "Order details not found." });
    
    res.json({ success: true });
});


// --- ADMIN ANALYTICS ---
app.get('/api/analytics', requireAdmin, async (req, res) => {
    try {
        const orders = await OrdersDb.read();
        const users = await UsersDb.read();
        const products = await ProductsDb.read();

        // Financial metrics
        const totalRevenue = orders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, o) => sum + o.totalAmount, 0);
        
        const totalOrders = orders.length;
        
        const pendingFulfill = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
        
        // Stock warning levels
        const lowStockCount = products.filter(p => p.stock < 10).length;

        // Structured array data for Chart.js
        // Category Sales Calculations
        const catSales = {};
        orders.filter(o => o.status !== 'cancelled').forEach(o => {
            o.items.forEach(item => {
                const prod = products.find(p => p.id === item.id);
                const category = prod ? prod.category : 'other';
                catSales[category] = (catSales[category] || 0) + (item.price * item.quantity);
            });
        });

        // Weekly Sales structure
        const weeklySales = [0, 0, 0, 0, 0, 0, 0]; // Sun - Sat
        orders.filter(o => o.status !== 'cancelled').forEach(o => {
            if (o.createdAt) {
                const day = new Date(o.createdAt).getDay();
                weeklySales[day] += o.totalAmount;
            }
        });

        res.json({
            totals: {
                revenue: totalRevenue,
                orders: totalOrders,
                customers: users.length,
                pendingOrders: pendingFulfill,
                lowStock: lowStockCount
            },
            charts: {
                categories: Object.keys(catSales),
                categoryRevenue: Object.values(catSales),
                weeklyRevenue: weeklySales
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Redirect to frontend fallback routes
app.get('*', (req, res) => {
    res.sendFile(path.resolve('public/index.html'));
});

// Boot Server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(` Jwellery Full-Stack Server active on: http://localhost:${PORT}`);
        console.log(` Admin Portal accessible at: http://localhost:${PORT}/admin.html`);
        console.log(`=======================================================`);
    });
});
