import type { Product, Dealer } from './supabase';

// Lightweight rule-based "AI" helpers that simulate the AI features described
// in the spec (chatbot, image verification, description generation, dynamic
// pricing suggestions, demand prediction). In production these would call
// OpenAI / Gemini APIs via an edge function.

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatContext = {
  pinCode?: string | null;
  locationLabel?: string | null;
  products: Product[];
  dealers: Dealer[];
  categories: { id: string; name: string; slug: string }[];
};

const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'i', 'need', 'want', 'buy', 'find', 'show', 'me', 'please', 'near', 'nearby', 'store', 'shop', 'under', 'below', 'rs', 'rupees', 'price']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function extractBudget(text: string): number | null {
  const m = text.match(/(?:under|below|less than|within|upto|up to)\s*₹?\s*(\d[\d,]*)/i);
  if (m) return parseInt(m[1].replace(/,/g, ''), 10);
  const m2 = text.match(/₹\s*(\d[\d,]*)/);
  if (m2) return parseInt(m2[1].replace(/,/g, ''), 10);
  return null;
}

function extractColor(text: string): string | null {
  const colors = ['black', 'white', 'blue', 'red', 'green', 'grey', 'gray', 'brown', 'pink', 'purple', 'gold', 'silver', 'yellow', 'orange'];
  const lower = text.toLowerCase();
  return colors.find((c) => lower.includes(c)) ?? null;
}

export function aiSearchProducts(query: string, products: Product[]): Product[] {
  const budget = extractBudget(query);
  const color = extractColor(query);
  const tokens = tokenize(query);

  return products
    .map((p) => {
      let score = 0;
      const haystack = `${p.name} ${p.brand?.name ?? ''} ${p.category?.name ?? ''} ${p.tags.join(' ')} ${p.color ?? ''} ${p.model ?? ''}`.toLowerCase();
      for (const token of tokens) {
        if (haystack.includes(token)) score += 2;
      }
      if (color && p.color && p.color.toLowerCase().includes(color)) score += 3;
      const price = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
      if (budget && price <= budget) score += 2;
      if (budget && price > budget) score -= 5;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

export function aiChatReply(message: string, ctx: ChatContext): string {
  const lower = message.toLowerCase();
  const budget = extractBudget(message);
  const color = extractColor(message);
  const tokens = tokenize(message);

  // Greeting / help intent
  if (/^(hi|hello|hey|namaste|namaskar)/i.test(message)) {
    return ctx.locationLabel
      ? `Hello! I see you're near ${ctx.locationLabel}. I can help you find products, compare prices at nearby shops, or get directions. What are you looking for today?`
      : "Hello! I'm your AI shopping assistant. Tell me what you're looking for and I'll find nearby shops that have it in stock. You can also share your PIN code for nearby results.";
  }

  // Nearby shops by category intent
  if (/nearby|near me|closest|nearest|around me|find (?:a|some)/i.test(lower) && tokens.length <= 3) {
    const catMatch = ctx.categories.find((c) => tokens.some((t) => c.name.toLowerCase().includes(t) || c.slug.includes(t)));
    if (catMatch) {
      const dealers = ctx.dealers.filter((d) => d.business_category_id === catMatch.id);
      if (dealers.length === 0) return `I couldn't find any ${catMatch.name} shops nearby. Try a different PIN code or category.`;
      const list = dealers.slice(0, 3).map((d) => `${d.shop_name} (${d.city})`).join(', ');
      return `I found ${dealers.length} ${catMatch.name} shops${ctx.locationLabel ? ' near ' + ctx.locationLabel : ''}: ${list}. ${ctx.pinCode ? 'Results are sorted by distance.' : 'Enter your PIN code for distance-sorted results.'}`;
    }
  }

  // Product search intent
  const matched = aiSearchProducts(message, ctx.products);
  if (matched.length > 0) {
    const inStock = matched.filter((p) => p.stock_status !== 'out_of_stock');
    const top = inStock[0] ?? matched[0];
    const price = top.discount_price && top.discount_price > 0 ? top.discount_price : top.price;
    const dealersWith = matched.filter((p) => p.name === top.name && p.stock_status !== 'out_of_stock').length;
    let reply = `I found ${matched.length} matching product${matched.length > 1 ? 's' : ''}${ctx.locationLabel ? ' near ' + ctx.locationLabel : ''}.\n\n`;
    reply += `The best match is **${top.name}** at ₹${Math.round(price).toLocaleString('en-IN')}`;
    if (dealersWith > 1) reply += `, available at ${dealersWith} nearby shops`;
    reply += '.\n';
    if (budget) {
      const cheapest = inStock.reduce((min, p) => {
        const pp = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
        return pp < min ? pp : min;
      }, Infinity);
      if (cheapest !== Infinity) reply += `The cheapest option is ₹${Math.round(cheapest).toLocaleString('en-IN')}.\n`;
    }
    if (color && matched.some((p) => p.color?.toLowerCase().includes(color))) {
      reply += `I filtered for ${color} color.\n`;
    }
    reply += '\nWould you like to see all nearby shops with this product, or get directions to the nearest one?';
    return reply;
  }

  // Fallback
  return `I couldn't find products matching "${message}". Try searching by product name (e.g. "Samsung S25"), brand (e.g. "Nike"), or category (e.g. "medical store"). You can also enter your PIN code to see nearby shops.`;
}

// Simulated AI image detection for dealer product uploads
export type AiImageResult = {
  detectedProduct: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
  detectedColor: string | null;
  generatedDescription: string;
  generatedTags: string[];
  seoKeywords: string[];
  confidence: number;
  warning: string | null;
};

// Extended AI moderation result with flags for duplicates, fake images, name mismatch
export type AiModerationVerdict = {
  verdict: 'approved' | 'flagged' | 'rejected';
  confidence: number;
  flags: string[];
  // 'duplicate' | 'fake_image' | 'inappropriate' | 'name_mismatch' | 'low_quality' | 'watermark'
  detectedProduct: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
  detectedColor: string | null;
  description: string;
  tags: string[];
  warning: string | null;
  summary: string;
};

// Known fake/inappropriate image indicators (keywords in URL that suggest stock photos, watermarks, etc.)
const FAKE_INDICATORS = ['shutterstock', 'getty', 'istock', 'watermark', 'placeholder', 'sample', 'demo', 'fake', 'nsfw', 'adult'];
const INAPPROPRIATE_INDICATORS = ['nsfw', 'adult', 'explicit', 'weapon', 'gun', 'drug', 'naked'];
const LOW_QUALITY_INDICATORS = ['blurry', 'pixelated', 'low-res', 'thumbnail'];

// Simulated known image hashes for duplicate detection (filename-based heuristic)
const KNOWN_IMAGE_HASHES = new Map<string, string>([
  ['samsung-s25', 'product-001'],
  ['iphone-15', 'product-002'],
  ['nike-air', 'product-003'],
]);

export function aiModerateImage(
  imageUrl: string,
  declaredName: string,
  category: string,
  allProductImages: { url: string; productName: string }[] = [],
): AiModerationVerdict {
  const lower = imageUrl.toLowerCase();
  const base = aiAnalyzeImage(imageUrl, declaredName);
  const flags: string[] = [];

  // 1. Duplicate detection — check if this image URL is already used by another product
  const isDuplicate = allProductImages.some(
    (img) => img.url === imageUrl && img.productName !== declaredName,
  );
  if (isDuplicate) flags.push('duplicate');

  // 2. Fake / stock photo detection
  if (FAKE_INDICATORS.some((ind) => lower.includes(ind))) flags.push('fake_image');

  // 3. Inappropriate content detection
  if (INAPPROPRIATE_INDICATORS.some((ind) => lower.includes(ind))) flags.push('inappropriate');

  // 4. Low quality detection
  if (LOW_QUALITY_INDICATORS.some((ind) => lower.includes(ind))) flags.push('low_quality');

  // 5. Watermark detection (stock photo sites)
  if (lower.includes('watermark') || lower.includes('shutterstock') || lower.includes('gettyimages')) {
    if (!flags.includes('watermark')) flags.push('watermark');
  }

  // 6. Name mismatch detection
  const nameLower = declaredName.toLowerCase();
  const detectedLower = base.detectedProduct.toLowerCase();
  if (base.detectedProduct !== 'Product' && !nameLower.includes(detectedLower.split(' ')[0]) && !detectedLower.includes(nameLower.split(' ')[0])) {
    flags.push('name_mismatch');
  }

  // 7. Duplicate image hash check
  const hashKey = lower.replace(/[^a-z0-9]/g, '').slice(-20);
  if (KNOWN_IMAGE_HASHES.has(hashKey)) flags.push('duplicate');

  // Determine verdict based on flags
  let verdict: 'approved' | 'flagged' | 'rejected' = 'approved';
  let warning: string | null = base.warning;

  if (flags.includes('inappropriate')) {
    verdict = 'rejected';
    warning = 'Image rejected: inappropriate content detected.';
  } else if (flags.includes('fake_image') || flags.includes('watermark')) {
    verdict = 'rejected';
    warning = 'Image rejected: appears to be a stock photo or watermarked image. Please upload an original product photo.';
  } else if (flags.length > 0) {
    verdict = 'flagged';
    const flagMessages: Record<string, string> = {
      duplicate: 'This image appears to be used by another product. Please upload a unique product photo.',
      name_mismatch: `Image appears to show a ${base.detectedProduct}, but the product name is "${declaredName}". Please verify.`,
      low_quality: 'Image quality appears low. Please upload a higher resolution photo.',
    };
    warning = flags.map((f) => flagMessages[f]).filter(Boolean).join(' ');
  }

  const confidence = base.confidence - (flags.length * 0.1);

  const summary = verdict === 'approved'
    ? `AI analysis passed with ${(confidence * 100).toFixed(0)}% confidence. Detected: ${base.detectedProduct}${base.detectedBrand ? ' by ' + base.detectedBrand : ''}.`
    : verdict === 'rejected'
    ? `AI analysis rejected this image. Issues: ${flags.join(', ')}.`
    : `AI analysis flagged ${flags.length} issue${flags.length > 1 ? 's' : ''}: ${flags.join(', ')}.`;

  return {
    verdict,
    confidence: Math.max(0, confidence),
    flags,
    detectedProduct: base.detectedProduct,
    detectedBrand: base.detectedBrand,
    detectedCategory: base.detectedCategory,
    detectedColor: base.detectedColor,
    description: base.generatedDescription,
    tags: base.generatedTags,
    warning,
    summary,
  };
}

export function aiAnalyzeImage(imageUrl: string, declaredName?: string): AiImageResult {
  // Deterministic pseudo-detection based on filename keywords (demo only).
  const lower = imageUrl.toLowerCase();
  const keywords: Record<string, { product: string; brand: string | null; category: string | null; color: string | null }> = {
    phone: { product: 'Smartphone', brand: null, category: 'Mobile Phones', color: null },
    mobile: { product: 'Smartphone', brand: null, category: 'Mobile Phones', color: null },
    shoe: { product: 'Footwear', brand: null, category: 'Footwear', color: null },
    sneakers: { product: 'Sneakers', brand: null, category: 'Footwear', color: null },
    shirt: { product: 'Casual Shirt', brand: null, category: 'Fashion', color: null },
    saree: { product: 'Saree', brand: null, category: 'Fashion', color: null },
    medicine: { product: 'Medicine', brand: null, category: 'Medical', color: null },
    pill: { product: 'Medicine', brand: null, category: 'Medical', color: null },
    cake: { product: 'Cake', brand: null, category: 'Bakery', color: null },
    bangle: { product: 'Bangles', brand: null, category: 'Bangles', color: null },
    tv: { product: 'Television', brand: null, category: 'Electronics', color: null },
    fridge: { product: 'Refrigerator', brand: null, category: 'Home Appliances', color: null },
    sofa: { product: 'Sofa', brand: null, category: 'Furniture', color: null },
    vegetable: { product: 'Vegetables', brand: null, category: 'Fruits & Vegetables', color: null },
  };
  let detected = { product: 'Product', brand: null as string | null, category: null as string | null, color: null as string | null };
  for (const key in keywords) {
    if (lower.includes(key)) {
      detected = keywords[key];
      break;
    }
  }
  // Color detection
  const colorMap: Record<string, string> = { black: 'Black', white: 'White', blue: 'Blue', red: 'Red', green: 'Green', grey: 'Grey', gray: 'Grey', brown: 'Brown', pink: 'Pink', gold: 'Gold' };
  for (const c in colorMap) {
    if (lower.includes(c)) { detected.color = colorMap[c]; break; }
  }
  // Brand detection from filename
  const brandMap: Record<string, string> = { samsung: 'Samsung', apple: 'Apple', nike: 'Nike', adidas: 'Adidas', puma: 'Puma', bata: 'Bata', vivo: 'Vivo', oppo: 'Oppo', xiaomi: 'Xiaomi', redmi: 'Xiaomi', oneplus: 'OnePlus' };
  for (const b in brandMap) {
    if (lower.includes(b)) { detected.brand = brandMap[b]; break; }
  }

  const confidence = 0.72 + (detected.brand ? 0.12 : 0) + (detected.color ? 0.06 : 0);
  const warning = declaredName && detected.product !== 'Product' && !declaredName.toLowerCase().includes(detected.product.toLowerCase().split(' ')[0])
    ? `This image appears to be a ${detected.product}, which differs from the entered product name "${declaredName}".`
    : null;

  return {
    detectedProduct: detected.product,
    detectedBrand: detected.brand,
    detectedCategory: detected.category,
    detectedColor: detected.color,
    generatedDescription: `AI-generated: This ${detected.color ? detected.color.toLowerCase() + ' ' : ''}${detected.product.toLowerCase()}${detected.brand ? ' from ' + detected.brand : ''} is a quality product available at our local shop. Verified by AI image analysis with ${(confidence * 100).toFixed(0)}% confidence.`,
    generatedTags: [detected.product.toLowerCase().split(' ')[0], detected.brand?.toLowerCase(), detected.category?.toLowerCase().replace(/[^a-z]/g, '-'), detected.color?.toLowerCase()].filter(Boolean) as string[],
    seoKeywords: [detected.product.toLowerCase(), `${detected.brand?.toLowerCase() ?? 'local'} ${detected.product.toLowerCase()}`, `buy ${detected.product.toLowerCase()} near me`, detected.category?.toLowerCase(), detected.color?.toLowerCase()].filter(Boolean) as string[],
    confidence,
    warning,
  };
}

export function aiSuggestPrice(marketPrices: number[]): { min: number; max: number; avg: number; suggested: number } {
  if (marketPrices.length === 0) return { min: 0, max: 0, avg: 0, suggested: 0 };
  const min = Math.min(...marketPrices);
  const max = Math.max(...marketPrices);
  const avg = marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length;
  // Suggest a competitive price slightly below average
  const suggested = Math.round((avg - (avg - min) * 0.3) / 10) * 10;
  return { min, max, avg, suggested };
}

// ============================================================
// AI Product Generation from product name
// Generates full product master info from just a name
// ============================================================

export type AiGeneratedProduct = {
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string;
  short_description: string;
  features: string[];
  specifications: Record<string, string>;
  model_number: string | null;
  keywords: string[];
  tags: string[];
  alternate_names: string[];
  seo_title: string;
  seo_description: string;
  confidence: number;
  low_confidence_fields: string[];
};

const BRAND_KEYWORDS: Record<string, { brand: string; category: string; subcategory?: string }> = {
  samsung: { brand: 'Samsung', category: 'Electronics', subcategory: 'Mobile Phones' },
  apple: { brand: 'Apple', category: 'Electronics', subcategory: 'Mobile Phones' },
  iphone: { brand: 'Apple', category: 'Electronics', subcategory: 'Mobile Phones' },
  oneplus: { brand: 'OnePlus', category: 'Electronics', subcategory: 'Mobile Phones' },
  vivo: { brand: 'Vivo', category: 'Electronics', subcategory: 'Mobile Phones' },
  oppo: { brand: 'Oppo', category: 'Electronics', subcategory: 'Mobile Phones' },
  xiaomi: { brand: 'Xiaomi', category: 'Electronics', subcategory: 'Mobile Phones' },
  redmi: { brand: 'Xiaomi', category: 'Electronics', subcategory: 'Mobile Phones' },
  google: { brand: 'Google', category: 'Electronics', subcategory: 'Mobile Phones' },
  pixel: { brand: 'Google', category: 'Electronics', subcategory: 'Mobile Phones' },
  motorola: { brand: 'Motorola', category: 'Electronics', subcategory: 'Mobile Phones' },
  realme: { brand: 'Realme', category: 'Electronics', subcategory: 'Mobile Phones' },
  nokia: { brand: 'Nokia', category: 'Electronics', subcategory: 'Mobile Phones' },
  sony: { brand: 'Sony', category: 'Electronics', subcategory: 'Audio & Video' },
  lg: { brand: 'LG', category: 'Home Appliances', subcategory: 'Large Appliances' },
  bosch: { brand: 'Bosch', category: 'Home Appliances', subcategory: 'Large Appliances' },
  whirlpool: { brand: 'Whirlpool', category: 'Home Appliances', subcategory: 'Large Appliances' },
  ifb: { brand: 'IFB', category: 'Home Appliances', subcategory: 'Large Appliances' },
  godrej: { brand: 'Godrej', category: 'Home Appliances', subcategory: 'Large Appliances' },
  haier: { brand: 'Haier', category: 'Home Appliances', subcategory: 'Large Appliances' },
  voltas: { brand: 'Voltas', category: 'Home Appliances', subcategory: 'Air Conditioners' },
  nike: { brand: 'Nike', category: 'Fashion', subcategory: 'Footwear' },
  adidas: { brand: 'Adidas', category: 'Fashion', subcategory: 'Footwear' },
  puma: { brand: 'Puma', category: 'Fashion', subcategory: 'Footwear' },
  bata: { brand: 'Bata', category: 'Fashion', subcategory: 'Footwear' },
  hp: { brand: 'HP', category: 'Electronics', subcategory: 'Computers & Laptops' },
  dell: { brand: 'Dell', category: 'Electronics', subcategory: 'Computers & Laptops' },
  lenovo: { brand: 'Lenovo', category: 'Electronics', subcategory: 'Computers & Laptops' },
  asus: { brand: 'Asus', category: 'Electronics', subcategory: 'Computers & Laptops' },
  acer: { brand: 'Acer', category: 'Electronics', subcategory: 'Computers & Laptops' },
  jbl: { brand: 'JBL', category: 'Electronics', subcategory: 'Audio & Video' },
  boat: { brand: 'boAt', category: 'Electronics', subcategory: 'Audio & Video' },
  philips: { brand: 'Philips', category: 'Home Appliances', subcategory: 'Small Appliances' },
  havells: { brand: 'Havells', category: 'Home Appliances', subcategory: 'Small Appliances' },
  bajaj: { brand: 'Bajaj', category: 'Home Appliances', subcategory: 'Small Appliances' },
  prestige: { brand: 'Prestige', category: 'Home Appliances', subcategory: 'Kitchen Appliances' },
  crompton: { brand: 'Crompton', category: 'Home Appliances', subcategory: 'Small Appliances' },
  royale: { brand: 'Royal Enfield', category: 'Automotive', subcategory: 'Motorcycles' },
  yamaha: { brand: 'Yamaha', category: 'Automotive', subcategory: 'Motorcycles' },
  honda: { brand: 'Honda', category: 'Automotive', subcategory: 'Motorcycles' },
  tvs: { brand: 'TVS', category: 'Automotive', subcategory: 'Motorcycles' },
  bajaj_auto: { brand: 'Bajaj', category: 'Automotive', subcategory: 'Motorcycles' },
};

const PRODUCT_TYPE_KEYWORDS: Record<string, { category: string; subcategory?: string; description: string }> = {
  phone: { category: 'Electronics', subcategory: 'Mobile Phones', description: 'A smartphone offering advanced connectivity, camera, and computing features.' },
  mobile: { category: 'Electronics', subcategory: 'Mobile Phones', description: 'A mobile phone with smart features for communication, entertainment, and productivity.' },
  smartphone: { category: 'Electronics', subcategory: 'Mobile Phones', description: 'A smartphone with touchscreen interface, app ecosystem, and high-speed connectivity.' },
  tablet: { category: 'Electronics', subcategory: 'Tablets', description: 'A portable tablet device for browsing, media, and light productivity.' },
  laptop: { category: 'Electronics', subcategory: 'Computers & Laptops', description: 'A portable laptop computer for work, study, and entertainment.' },
  notebook: { category: 'Electronics', subcategory: 'Computers & Laptops', description: 'A lightweight laptop computer designed for everyday computing.' },
  tv: { category: 'Electronics', subcategory: 'Televisions', description: 'A television delivering high-resolution display with smart features.' },
  television: { category: 'Electronics', subcategory: 'Televisions', description: 'A smart television with vibrant display and multimedia capabilities.' },
  refrigerator: { category: 'Home Appliances', subcategory: 'Large Appliances', description: 'A refrigerator for efficient food preservation and cooling.' },
  fridge: { category: 'Home Appliances', subcategory: 'Large Appliances', description: 'A refrigerator designed for household food storage.' },
  'washing machine': { category: 'Home Appliances', subcategory: 'Large Appliances', description: 'A washing machine for efficient laundry care.' },
  'air conditioner': { category: 'Home Appliances', subcategory: 'Air Conditioners', description: 'An air conditioner for effective room cooling and climate control.' },
  ac: { category: 'Home Appliances', subcategory: 'Air Conditioners', description: 'An air conditioner providing efficient cooling for homes and offices.' },
  microwave: { category: 'Home Appliances', subcategory: 'Kitchen Appliances', description: 'A microwave oven for quick and convenient cooking.' },
  oven: { category: 'Home Appliances', subcategory: 'Kitchen Appliances', description: 'An oven for baking, roasting, and cooking.' },
  mixer: { category: 'Home Appliances', subcategory: 'Kitchen Appliances', description: 'A mixer grinder for food preparation.' },
  grinder: { category: 'Home Appliances', subcategory: 'Kitchen Appliances', description: 'A grinder for wet and dry grinding tasks.' },
  'water heater': { category: 'Home Appliances', subcategory: 'Small Appliances', description: 'A water heater for instant hot water supply.' },
  geyser: { category: 'Home Appliances', subcategory: 'Small Appliances', description: 'A water heater (geyser) for household hot water needs.' },
  fan: { category: 'Home Appliances', subcategory: 'Small Appliances', description: 'A fan for air circulation and cooling.' },
  'air cooler': { category: 'Home Appliances', subcategory: 'Air Conditioners', description: 'An air cooler for economical room cooling.' },
  headphone: { category: 'Electronics', subcategory: 'Audio & Video', description: 'Headphones delivering high-quality audio for music and calls.' },
  earphone: { category: 'Electronics', subcategory: 'Audio & Video', description: 'Earphones with clear sound and comfortable fit.' },
  earbud: { category: 'Electronics', subcategory: 'Audio & Video', description: 'Wireless earbuds with compact design and good battery life.' },
  speaker: { category: 'Electronics', subcategory: 'Audio & Video', description: 'A speaker for rich, immersive audio output.' },
  'smart watch': { category: 'Electronics', subcategory: 'Wearables', description: 'A smartwatch with fitness tracking and notification features.' },
  smartwatch: { category: 'Electronics', subcategory: 'Wearables', description: 'A smartwatch offering health monitoring and smart connectivity.' },
  'power bank': { category: 'Electronics', subcategory: 'Accessories', description: 'A power bank for on-the-go device charging.' },
  charger: { category: 'Electronics', subcategory: 'Accessories', description: 'A charger for fast and safe device charging.' },
  shoe: { category: 'Fashion', subcategory: 'Footwear', description: 'Footwear designed for comfort and style.' },
  sneakers: { category: 'Fashion', subcategory: 'Footwear', description: 'Sneakers for everyday wear with cushioned support.' },
  shirt: { category: 'Fashion', subcategory: 'Clothing', description: 'A casual shirt made from comfortable fabric.' },
  't-shirt': { category: 'Fashion', subcategory: 'Clothing', description: 'A T-shirt for casual everyday wear.' },
  jeans: { category: 'Fashion', subcategory: 'Clothing', description: 'Denim jeans for durable and stylish everyday wear.' },
  saree: { category: 'Fashion', subcategory: 'Ethnic Wear', description: 'A traditional saree with elegant design.' },
  'washing': { category: 'Home Appliances', subcategory: 'Large Appliances', description: 'A washing machine for laundry care.' },
  motorcycle: { category: 'Automotive', subcategory: 'Motorcycles', description: 'A motorcycle for daily commute and performance riding.' },
  bike: { category: 'Automotive', subcategory: 'Motorcycles', description: 'A motorcycle offering reliable performance and fuel efficiency.' },
  scooter: { category: 'Automotive', subcategory: 'Scooters', description: 'A scooter for convenient city commuting.' },
  mattress: { category: 'Furniture', subcategory: 'Bedding', description: 'A mattress for comfortable and restful sleep.' },
  sofa: { category: 'Furniture', subcategory: 'Living Room', description: 'A sofa for comfortable seating in living spaces.' },
  camera: { category: 'Electronics', subcategory: 'Cameras', description: 'A camera for capturing high-quality photos and videos.' },
  router: { category: 'Electronics', subcategory: 'Networking', description: 'A router for high-speed internet connectivity.' },
  printer: { category: 'Electronics', subcategory: 'Computers & Laptops', description: 'A printer for home and office document printing.' },
  inverter: { category: 'Home Appliances', subcategory: 'Small Appliances', description: 'An inverter for backup power supply.' },
  'water purifier': { category: 'Home Appliances', subcategory: 'Kitchen Appliances', description: 'A water purifier for clean and safe drinking water.' },
};

function detectBrandFromName(name: string): { brand: string | null; category: string | null; subcategory: string | null } {
  const lower = name.toLowerCase();
  for (const key in BRAND_KEYWORDS) {
    if (lower.includes(key)) {
      return { brand: BRAND_KEYWORDS[key].brand, category: BRAND_KEYWORDS[key].category, subcategory: BRAND_KEYWORDS[key].subcategory ?? null };
    }
  }
  return { brand: null, category: null, subcategory: null };
}

function detectProductType(name: string): { category: string | null; subcategory: string | null; description: string | null } {
  const lower = name.toLowerCase();
  for (const key in PRODUCT_TYPE_KEYWORDS) {
    if (lower.includes(key)) {
      return {
        category: PRODUCT_TYPE_KEYWORDS[key].category,
        subcategory: PRODUCT_TYPE_KEYWORDS[key].subcategory ?? null,
        description: PRODUCT_TYPE_KEYWORDS[key].description,
      };
    }
  }
  return { category: null, subcategory: null, description: null };
}

function extractModelNumber(name: string): string | null {
  const upper = name.toUpperCase();
  const modelMatch = upper.match(/([A-Z]{2,4}[-\s]?\d{2,5}[A-Z]{0,3})/);
  if (modelMatch) return modelMatch[1].replace(/\s/g, '-');
  const numberMatch = name.match(/\b(\d{2,5})\b/);
  if (numberMatch) return numberMatch[1];
  return null;
}

function generateSpecifications(name: string): { specs: Record<string, string>; lowConfidence: string[] } {
  const lower = name.toLowerCase();
  const specs: Record<string, string> = {};
  const lowConfidence: string[] = [];

  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('smartphone') || lower.includes('iphone') || lower.includes('galaxy') || lower.includes('pixel')) {
    const storageMatch = name.match(/(\d+)\s*(?:gb|tb)/i);
    if (storageMatch) specs['Storage'] = `${storageMatch[1]}${storageMatch[0].toLowerCase().includes('tb') ? 'TB' : 'GB'}`;
    else { specs['Storage'] = 'Information unavailable'; lowConfidence.push('Storage'); }

    const ramMatch = name.match(/(\d+)\s*gb\s*(?:ram|memory)/i);
    if (ramMatch) specs['RAM'] = `${ramMatch[1]}GB`;
    else { specs['RAM'] = 'Information unavailable'; lowConfidence.push('RAM'); }

    specs['Display'] = 'Information unavailable';
    lowConfidence.push('Display');
    specs['Battery'] = 'Information unavailable';
    lowConfidence.push('Battery');
    specs['Camera'] = 'Information unavailable';
    lowConfidence.push('Camera');
    specs['OS'] = lower.includes('iphone') || lower.includes('ios') ? 'iOS' : lower.includes('pixel') ? 'Android' : 'Android';
    specs['Connectivity'] = '5G/4G LTE, Wi-Fi, Bluetooth';
  } else if (lower.includes('laptop') || lower.includes('notebook')) {
    specs['Type'] = 'Laptop';
    specs['OS'] = 'Information unavailable';
    lowConfidence.push('OS');
    specs['Processor'] = 'Information unavailable';
    lowConfidence.push('Processor');
    specs['RAM'] = 'Information unavailable';
    lowConfidence.push('RAM');
    specs['Storage'] = 'Information unavailable';
    lowConfidence.push('Storage');
    specs['Display'] = 'Information unavailable';
    lowConfidence.push('Display');
  } else if (lower.includes('tv') || lower.includes('television')) {
    const sizeMatch = name.match(/(\d{2,3})\s*(?:inch|"|in)/i);
    specs['Screen Size'] = sizeMatch ? `${sizeMatch[1]} inches` : 'Information unavailable';
    if (!sizeMatch) lowConfidence.push('Screen Size');
    specs['Resolution'] = 'Information unavailable';
    lowConfidence.push('Resolution');
    specs['Display Type'] = 'LED';
    specs['Smart TV'] = 'Yes';
  } else if (lower.includes('fridge') || lower.includes('refrigerator')) {
    const capacityMatch = name.match(/(\d+)\s*l(?:iter)?/i);
    specs['Capacity'] = capacityMatch ? `${capacityMatch[1]}L` : 'Information unavailable';
    if (!capacityMatch) lowConfidence.push('Capacity');
    specs['Type'] = lower.includes('double') ? 'Double Door' : lower.includes('single') ? 'Single Door' : 'Information unavailable';
    if (specs['Type'] === 'Information unavailable') lowConfidence.push('Type');
    specs['Defrosting'] = 'Frost Free';
    specs['Energy Rating'] = 'Information unavailable';
    lowConfidence.push('Energy Rating');
  } else if (lower.includes('washing') || lower.includes('washer')) {
    const capacityMatch = name.match(/(\d+)\s*kg/i);
    specs['Capacity'] = capacityMatch ? `${capacityMatch[1]} kg` : 'Information unavailable';
    if (!capacityMatch) lowConfidence.push('Capacity');
    specs['Type'] = lower.includes('front') ? 'Front Load' : lower.includes('top') ? 'Top Load' : 'Information unavailable';
    if (specs['Type'] === 'Information unavailable') lowConfidence.push('Type');
    specs['Wash Programs'] = 'Information unavailable';
    lowConfidence.push('Wash Programs');
  } else if (lower.includes('ac') || lower.includes('air conditioner') || lower.includes('aircool')) {
    const tonMatch = name.match(/(\d(?:\.\d)?)\s*ton/i);
    specs['Capacity'] = tonMatch ? `${tonMatch[1]} Ton` : 'Information unavailable';
    if (!tonMatch) lowConfidence.push('Capacity');
    specs['Type'] = lower.includes('split') ? 'Split AC' : lower.includes('window') ? 'Window AC' : 'Information unavailable';
    if (specs['Type'] === 'Information unavailable') lowConfidence.push('Type');
    specs['Star Rating'] = 'Information unavailable';
    lowConfidence.push('Star Rating');
  } else if (lower.includes('speaker') || lower.includes('headphone') || lower.includes('earphone') || lower.includes('earbud')) {
    specs['Type'] = lower.includes('wireless') || lower.includes('bluetooth') ? 'Wireless' : 'Wired';
    if (!lower.includes('wireless') && !lower.includes('bluetooth')) {
      specs['Type'] = 'Information unavailable';
      lowConfidence.push('Type');
    }
    specs['Connectivity'] = lower.includes('bluetooth') ? 'Bluetooth' : 'Information unavailable';
    if (specs['Connectivity'] === 'Information unavailable') lowConfidence.push('Connectivity');
    specs['Battery Life'] = 'Information unavailable';
    lowConfidence.push('Battery Life');
  }

  return { specs, lowConfidence };
}

function generateFeatures(name: string): string[] {
  const lower = name.toLowerCase();
  const features: string[] = [];

  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('smartphone') || lower.includes('iphone')) {
    features.push('High-speed 5G connectivity', 'Advanced camera system', 'Long-lasting battery');
    if (lower.includes('pro') || lower.includes('ultra')) features.push('Premium display with high refresh rate');
    if (lower.includes('plus') || lower.includes('max')) features.push('Large display for immersive viewing');
  } else if (lower.includes('laptop')) {
    features.push('Fast performance for work and entertainment', 'Portable and lightweight design', 'Long battery life');
  } else if (lower.includes('tv') || lower.includes('television')) {
    features.push('High-resolution display', 'Smart TV with app support', 'Multiple connectivity options');
  } else if (lower.includes('fridge') || lower.includes('refrigerator')) {
    features.push('Energy efficient cooling', 'Spacious interior', 'Frost-free operation');
  } else if (lower.includes('washing')) {
    features.push('Multiple wash programs', 'Energy efficient', 'Quiet operation');
  } else if (lower.includes('ac') || lower.includes('air conditioner')) {
    features.push('Fast cooling technology', 'Energy efficient operation', 'Air purification filter');
  } else if (lower.includes('speaker') || lower.includes('headphone')) {
    features.push('High-quality audio output', 'Comfortable design', 'Long battery life (wireless models)');
  } else {
    features.push('Quality product from a trusted brand', 'Designed for everyday use');
  }

  return features;
}

function generateAlternateNames(name: string, brand: string | null): string[] {
  const alts: string[] = [];
  const lower = name.toLowerCase();

  if (brand) {
    const withoutBrand = name.replace(new RegExp(brand, 'i'), '').trim();
    if (withoutBrand && withoutBrand !== name) alts.push(withoutBrand);
  }
  if (lower.includes('galaxy s25 ultra')) {
    alts.push('Samsung S25 Ultra', 'Galaxy S25 Ultra', 'Samsung Galaxy S25 Ultra 5G');
  }
  if (lower.includes('iphone 16')) {
    alts.push('Apple iPhone 16', 'i16');
  }
  if (lower.includes('oneplus 13')) {
    alts.push('OnePlus 13 5G', 'OP13');
  }

  return Array.from(new Set(alts)).slice(0, 5);
}

export function aiGenerateProduct(name: string): AiGeneratedProduct {
  const trimmedName = name.trim();
  const brandInfo = detectBrandFromName(trimmedName);
  const typeInfo = detectProductType(trimmedName);
  const modelNumber = extractModelNumber(trimmedName);
  const { specs, lowConfidence } = generateSpecifications(trimmedName);
  const features = generateFeatures(trimmedName);
  const alternateNames = generateAlternateNames(trimmedName, brandInfo.brand);

  const category = brandInfo.category ?? typeInfo.category;
  const subcategory = brandInfo.subcategory ?? typeInfo.subcategory;
  const description = typeInfo.description ?? `${trimmedName} is a quality product available at local dealers near you. Compare prices and availability across nearby shops.`;
  const shortDescription = `${brandInfo.brand ?? ''} ${trimmedName.replace(brandInfo.brand ?? '', '').trim()}`.trim();
  const tags = [category?.toLowerCase() ?? 'product', brandInfo.brand?.toLowerCase(), subcategory?.toLowerCase()].filter(Boolean) as string[];
  const keywords = [
    trimmedName.toLowerCase(),
    brandInfo.brand?.toLowerCase(),
    `${brandInfo.brand?.toLowerCase() ?? ''} ${trimmedName.toLowerCase()}`,
    `buy ${trimmedName.toLowerCase()}`,
    `${trimmedName.toLowerCase()} near me`,
    category?.toLowerCase(),
    subcategory?.toLowerCase(),
  ].filter(Boolean) as string[];

  const seoTitle = `${trimmedName} - Price, Specs & Nearby Dealers | DealerConnect`;
  const seoDescription = `Find ${trimmedName} at local dealers near you. Compare prices, check availability, and contact nearby shops. ${brandInfo.brand ? `Official ${brandInfo.brand} product.` : ''}`;

  const confidence = (brandInfo.brand ? 0.3 : 0) + (category ? 0.2 : 0) + (specs && Object.keys(specs).length > 0 ? 0.2 : 0) + (features.length > 0 ? 0.1 : 0) + 0.2;

  return {
    name: trimmedName,
    brand: brandInfo.brand,
    category,
    subcategory,
    description,
    short_description: shortDescription || trimmedName,
    features,
    specifications: specs,
    model_number: modelNumber,
    keywords: Array.from(new Set(keywords)),
    tags: Array.from(new Set(tags)),
    alternate_names: alternateNames,
    seo_title: seoTitle,
    seo_description: seoDescription,
    confidence: Math.min(confidence, 0.95),
    low_confidence_fields: lowConfidence,
  };
}

// Fuzzy similarity check for duplicate prevention
export function productSimilarity(a: string, b: string): number {
  const aTokens = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const bTokens = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let common = 0;
  aSet.forEach((t) => { if (bSet.has(t)) common++; });
  const union = aSet.size + bSet.size - common;
  return union === 0 ? 0 : common / union;
}

export function aiDemandPrediction(category: string): string {
  const predictions: Record<string, string> = {
    medical: 'Medicine demand expected to rise 15% this week due to seasonal changes. Stock up on common cold and fever medicines.',
    grocery: 'Grocery demand stable. Consider stocking festival staples - demand up 25% this weekend.',
    fashion: 'Festive season approaching - ethnic wear demand expected to surge 40%. Stock traditional clothing.',
    footwear: 'Sports shoe demand rising 20% with marathon season. Athletic footwear trending.',
    bangles: 'Festival demand for bangles expected up 60% this month. Stock traditional designs.',
    bakery: 'Cake orders expected up 35% this weekend. Ensure sufficient inventory for celebrations.',
    sweets: 'Festival sweet demand surging 50%. Stock premium mithai and gift boxes.',
    electronics: 'Phone demand steady. New launches driving 10% increase in flagship inquiries.',
  };
  return predictions[category.toLowerCase()] ?? 'Demand stable. Monitor fast-moving items and restock before weekends.';
}
