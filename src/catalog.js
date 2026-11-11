// PayPilot demo catalog. Prices in USD. The guard treats this file as the
// single source of truth: any cart line whose price differs from the
// catalog price is blocked as tampered.
export const CATALOG = [
  { sku: "WS-CHAIR",   name: "Ergonomic Mesh Chair",            price: 189.00, category: "workspace", tags: ["chair", "desk", "ergonomic", "back", "office", "wfh", "work from home"] },
  { sku: "WS-DESK",    name: "Standing Desk Frame (electric)",  price: 329.00, category: "workspace", tags: ["desk", "standing", "office", "wfh", "work from home"] },
  { sku: "WS-MONARM",  name: "Monitor Arm, gas spring",         price: 59.00,  category: "workspace", tags: ["monitor", "desk", "ergonomic", "screen"] },
  { sku: "WS-LAMP",    name: "LED Desk Lamp, eye-care",         price: 34.50,  category: "workspace", tags: ["lamp", "light", "desk", "eye"] },
  { sku: "AU-ANC",     name: "Noise-Cancelling Headphones",     price: 129.00, category: "audio",     tags: ["headphones", "audio", "music", "focus", "calls", "noise"] },
  { sku: "AU-BUDS",    name: "Wireless Earbuds",                price: 49.00,  category: "audio",     tags: ["earbuds", "audio", "music", "calls", "travel"] },
  { sku: "AU-MIC",     name: "USB Condenser Microphone",        price: 79.00,  category: "audio",     tags: ["microphone", "mic", "calls", "stream", "podcast", "meeting"] },
  { sku: "AU-SPK",     name: "Bluetooth Speaker",               price: 45.00,  category: "audio",     tags: ["speaker", "music", "party", "audio"] },
  { sku: "CP-MON27",   name: "27in QHD Monitor",                price: 219.00, category: "compute",   tags: ["monitor", "screen", "display", "code", "coding", "design"] },
  { sku: "CP-KEYB",    name: "Mechanical Keyboard, hot-swap",   price: 69.00,  category: "compute",   tags: ["keyboard", "typing", "code", "coding", "desk"] },
  { sku: "CP-MOUSE",   name: "Wireless Ergonomic Mouse",        price: 39.00,  category: "compute",   tags: ["mouse", "ergonomic", "desk", "code"] },
  { sku: "CP-HUB",     name: "USB-C Docking Hub 7-in-1",        price: 54.00,  category: "compute",   tags: ["usb", "hub", "dock", "laptop", "cable"] },
  { sku: "CP-WEBCAM",  name: "1080p Webcam",                    price: 64.00,  category: "compute",   tags: ["webcam", "camera", "calls", "meeting", "stream"] },
  { sku: "CP-SSD1T",   name: "Portable SSD 1TB",                price: 99.00,  category: "compute",   tags: ["ssd", "storage", "backup", "drive"] },
  { sku: "SW-NOTE",    name: "Notes App Pro (1 year)",          price: 24.00,  category: "software",  tags: ["notes", "app", "productivity", "writing", "study"] },
  { sku: "SW-VPN",     name: "VPN Subscription (1 year)",       price: 39.99,  category: "software",  tags: ["vpn", "security", "privacy", "travel"] },
  { sku: "SW-CLOUD",   name: "Cloud Storage 2TB (1 year)",      price: 119.00, category: "software",  tags: ["cloud", "storage", "backup", "photos"] },
  { sku: "WL-MAT",     name: "Yoga / Stretch Mat",              price: 29.00,  category: "wellness",  tags: ["yoga", "fitness", "health", "stretch", "exercise"] },
  { sku: "WL-BAND",    name: "Resistance Bands Set",            price: 19.00,  category: "wellness",  tags: ["fitness", "exercise", "health", "workout"] },
  { sku: "WL-BOTTLE",  name: "Insulated Steel Bottle 1L",       price: 22.00,  category: "wellness",  tags: ["bottle", "water", "travel", "gym"] },
  { sku: "TR-BACKPACK",name: "Travel Backpack 25L",             price: 89.00,  category: "travel",    tags: ["backpack", "travel", "bag", "trip"] },
  { sku: "TR-CHARGER", name: "GaN Fast Charger 65W",            price: 35.00,  category: "travel",    tags: ["charger", "travel", "phone", "laptop", "cable"] },
  { sku: "TR-NECK",    name: "Memory Foam Neck Pillow",         price: 25.00,  category: "travel",    tags: ["travel", "pillow", "flight", "sleep"] },
  { sku: "GM-PAD",     name: "Wireless Game Controller",        price: 59.99,  category: "gaming",    tags: ["game", "gaming", "controller", "play"] },
];

export const catalogBySku = (sku) => CATALOG.find((i) => i.sku === sku);
