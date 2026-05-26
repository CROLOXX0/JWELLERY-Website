/* ==========================================================================
   Jwellery Robust Thread-Safe JSON Database Client
   ========================================================================== */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('data');

// Simple sequential lock queue to prevent concurrent write file corruption
const writeQueues = {};

async function executeLocked(collection, writeOperation) {
    if (!writeQueues[collection]) {
        writeQueues[collection] = Promise.resolve();
    }
    
    // Chain the new write operation onto the existing queue
    const nextPromise = writeQueues[collection].then(async () => {
        try {
            return await writeOperation();
        } catch (err) {
            console.error(`DB Write Error in collection '${collection}':`, err);
            throw err;
        }
    });

    writeQueues[collection] = nextPromise.catch(() => {}); // keep queue alive even on failure
    return nextPromise;
}

export class JsonCollection {
    constructor(name, defaultData = []) {
        this.name = name;
        this.filePath = path.join(DATA_DIR, `${name}.json`);
        this.defaultData = defaultData;
    }

    /**
     * Initialize folder and database files asynchronously
     */
    async init() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            try {
                await fs.access(this.filePath);
            } catch {
                // File does not exist, write default initial seed
                await fs.writeFile(this.filePath, JSON.stringify(this.defaultData, null, 2), 'utf-8');
                console.log(`Database: Collection '${this.name}' initialized at ${this.filePath}`);
            }
        } catch (err) {
            console.error(`DB Initialization Error for '${this.name}':`, err);
        }
    }

    /**
     * Read the full data array
     */
    async read() {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(content || '[]');
        } catch (err) {
            console.error(`DB Read Error in '${this.name}':`, err);
            return [];
        }
    }

    /**
     * Find documents matching query object
     */
    async find(query = {}) {
        const data = await this.read();
        return data.filter(doc => {
            for (const key in query) {
                if (doc[key] !== query[key]) return false;
            }
            return true;
        });
    }

    /**
     * Find single document matching query
     */
    async findOne(query = {}) {
        const data = await this.read();
        return data.find(doc => {
            for (const key in query) {
                if (doc[key] !== query[key]) return false;
            }
            return true;
        }) || null;
    }

    /**
     * Insert new document
     */
    async insert(doc) {
        return executeLocked(this.name, async () => {
            const data = await this.read();
            const newDoc = {
                id: doc.id || Math.random().toString(36).substr(2, 9),
                createdAt: new Date().toISOString(),
                ...doc
            };
            data.push(newDoc);
            await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
            return newDoc;
        });
    }

    /**
     * Update documents matching query with updates object
     */
    async update(query, updates) {
        return executeLocked(this.name, async () => {
            const data = await this.read();
            let count = 0;
            const updatedData = data.map(doc => {
                let matches = true;
                for (const key in query) {
                    if (doc[key] !== query[key]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    count++;
                    return { ...doc, ...updates, id: doc.id }; // preserve ID
                }
                return doc;
            });

            if (count > 0) {
                await fs.writeFile(this.filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
            }
            return count;
        });
    }

    /**
     * Delete documents matching query
     */
    async delete(query) {
        return executeLocked(this.name, async () => {
            const data = await this.read();
            const initialLength = data.length;
            const filteredData = data.filter(doc => {
                let matches = true;
                for (const key in query) {
                    if (doc[key] !== query[key]) {
                        matches = false;
                        break;
                    }
                }
                return !matches;
            });

            const deletedCount = initialLength - filteredData.length;
            if (deletedCount > 0) {
                await fs.writeFile(this.filePath, JSON.stringify(filteredData, null, 2), 'utf-8');
            }
            return deletedCount;
        });
    }
}

// --- SEED ORNAMENT DATA ---
const SEED_PRODUCTS = [
    {
        id: "rng-aura",
        name: "Lover's Knot Rose Ring",
        category: "rings",
        price: 24500,
        rating: 4.9,
        reviewsCount: 142,
        image: "assets/images/ring_premium.png",
        hoverImage: "assets/images/ring_premium.png",
        description: "An intertwining knot design crafted in solid 18k Rose Gold, set with micro-pavé conflict-free brilliant diamonds. The perfect symbol of modern, lightweight luxury.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "Ethically Sourced Diamonds (VVS1, Color G, 0.28 Carats)",
            weight: "approx. 3.4 grams",
            origin: "Handcrafted in Delhi, India",
            sizes: ["US 5", "US 6", "US 7", "US 8"]
        },
        stock: 12,
        featured: true
    },
    {
        id: "rng-eternity",
        name: "Infinite Twine Eternity Ring",
        category: "rings",
        price: 18900,
        rating: 4.8,
        reviewsCount: 96,
        image: "assets/images/ring_premium.png",
        hoverImage: "assets/images/ring_premium.png",
        description: "A continuous, delicate ribbon of 18k Rose Gold twisting gracefully around the finger. Sleek and understated, meant to be stacked or worn solo.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "None (High-polish luxury finish)",
            weight: "approx. 2.8 grams",
            origin: "Handcrafted in Delhi, India",
            sizes: ["US 5", "US 6", "US 7", "US 8"]
        },
        stock: 25,
        featured: false
    },
    {
        id: "nec-dew",
        name: "Solitaire Dew Pendant",
        category: "necklaces",
        price: 36000,
        rating: 5.0,
        reviewsCount: 208,
        image: "assets/images/necklace_elegant.png",
        hoverImage: "assets/images/necklace_elegant.png",
        description: "A breathtaking pear-cut solitaire diamond that catches light beautifully, floating seamlessly on an ultra-fine 18k Rose Gold Venetian chain.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "0.45 Carats Pear-cut Solitaire Diamond (VVS1, Color F)",
            weight: "approx. 4.2 grams",
            origin: "Handcrafted in Delhi, India",
            chainLength: "16 inches with a 2-inch extender"
        },
        stock: 8,
        featured: true
    },
    {
        id: "nec-celestial",
        name: "Celestial Minimalist Choker",
        category: "necklaces",
        price: 28500,
        rating: 4.7,
        reviewsCount: 74,
        image: "assets/images/necklace_elegant.png",
        hoverImage: "assets/images/necklace_elegant.png",
        description: "Dainty star-engraved discs suspended along a fluid, lightweight Rose Gold cable chain. Sits perfectly on the collarbone for everyday elegance.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "Star-set Brilliant Round Diamonds (0.08 Carats)",
            weight: "approx. 3.9 grams",
            origin: "Handcrafted in Delhi, India",
            chainLength: "14 inches with a 1.5-inch extender"
        },
        stock: 14,
        featured: false
    },
    {
        id: "ear-petal",
        name: "Petal Pearl Drop Studs",
        category: "earrings",
        price: 15400,
        rating: 4.9,
        reviewsCount: 112,
        image: "assets/images/earrings_studs.png",
        hoverImage: "assets/images/earrings_studs.png",
        description: "Artfully designed rose gold petal settings supporting a selected premium freshwater white pearl. Lightweight and stunning for modern brides and dinner dates.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "Grade AAA Hand-selected Freshwater Pearl (6mm)",
            weight: "approx. 2.5 grams (per pair)",
            origin: "Handcrafted in Delhi, India",
            backing: "Luxury butterfly push-back"
        },
        stock: 18,
        featured: true
    },
    {
        id: "ear-chevron",
        name: "Minimalist Chevron Hoops",
        category: "earrings",
        price: 12200,
        rating: 4.6,
        reviewsCount: 53,
        image: "assets/images/earrings_studs.png",
        hoverImage: "assets/images/earrings_studs.png",
        description: "Geometric sharp-angled hoop earrings in 18k Rose Gold. Designed with a seamless invisible click clasp, engineered for weightless comfort.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "None (Sleek brushed matte edges)",
            weight: "approx. 1.9 grams",
            origin: "Handcrafted in Delhi, India",
            backing: "Click-lock hinge"
        },
        stock: 30,
        featured: false
    },
    {
        id: "bng-aura",
        name: "Lotus Delicate Bangle",
        category: "bangles",
        price: 45000,
        rating: 4.9,
        reviewsCount: 88,
        image: "assets/images/bangles_minimal.png",
        hoverImage: "assets/images/bangles_minimal.png",
        description: "A flexible, high-tensile 18k Rose Gold bangle culminating in two delicate lotus buds studded with diamond pavé. An instant classic for chic styling.",
        details: {
            metal: "18k Solid Rose Gold",
            stone: "Round Cut Accent Diamonds (0.15 Carats)",
            weight: "approx. 6.2 grams",
            origin: "Handcrafted in Delhi, India",
            sizing: "Fits wrist sizes 5.5 to 6.5 inches comfortably"
        },
        stock: 6,
        featured: true
    },
    {
        id: "ank-stardust",
        name: "Stardust Delicate Anklet",
        category: "minimal",
        price: 9800,
        rating: 4.8,
        reviewsCount: 165,
        image: "assets/images/anklet_fashion.png",
        hoverImage: "assets/images/anklet_fashion.png",
        description: "A whimsical, barely-there ankle chain shimmering with diamond-cut metal beads that capture the sun. Ultimate minimal resort wear luxury.",
        details: {
            metal: "14k Solid Rose Gold",
            stone: "None",
            weight: "approx. 1.2 grams",
            origin: "Handcrafted in Delhi, India",
            length: "9 inches with a 1-inch adjustability chain"
        },
        stock: 45,
        featured: false
    }
];

// Instantiations
export const UsersDb = new JsonCollection('users');
export const ProductsDb = new JsonCollection('products', SEED_PRODUCTS);
export const OrdersDb = new JsonCollection('orders');
export const AdminsDb = new JsonCollection('admins', [
    {
        id: "admin-ananya",
        name: "Ananya Sen",
        email: "admin@jwellery.in",
        password: "admin123",
        phone: "+91 9999988888",
        role: "Atelier Owner"
    },
    {
        id: "admin-shayan",
        name: "Shayan Sen",
        email: "shayan@jwellery.in",
        password: "admin123",
        phone: "+91 9999977777",
        role: "Operations Lead"
    }
]);

// Export helper to initialize all databases
export async function initDb() {
    await UsersDb.init();
    await ProductsDb.init();
    await OrdersDb.init();
    await AdminsDb.init();
}
