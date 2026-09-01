const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v3/product';
const USDA_FDC_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const USER_AGENT = 'MySimpleHealth/0.1 (https://mysimplehealth.org; food acquisition)';
const FIELDS = [
  'code','product_name','generic_name','brands','quantity','serving_size',
  'categories','categories_tags','ingredients_text','allergens_tags','nutriments',
  'image_front_url','image_url','last_modified_t'
].join(',');

function digitsOnly(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function checkDigit(body) {
  let sum = 0;
  let weight = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

function normalizeCode(value) {
  const digits = digitsOnly(value);
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (checkDigit(digits.slice(0, -1)) !== Number(digits.at(-1))) return null;
  return digits;
}

function identifierScheme(code) {
  return code.length === 8 ? 'gtin_8' : code.length === 12 ? 'gtin_12' : code.length === 13 ? 'gtin_13' : 'gtin_14';
}

function firstString(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || null;
}

function parseQuantity(value) {
  if (!value || typeof value !== 'string') return { packageQuantity:null, packageUnit:null };
  const match = value.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?/);
  if (!match) return { packageQuantity:null, packageUnit:value.trim() || null };
  return {
    packageQuantity: Number(match[1]),
    packageUnit: match[2] ? match[2].toLowerCase() : null
  };
}

function normalizeNutrients(nutriments) {
  const source = nutriments && typeof nutriments === 'object' ? nutriments : {};
  const read = (...keys) => {
    for (const key of keys) {
      const raw = source[key];
      if (raw == null || raw === '') continue;
      const value = Number(raw);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  return {
    per100g: {
      caloriesKcal: read('energy-kcal_100g'),
      proteinG: read('proteins_100g'),
      carbohydrateG: read('carbohydrates_100g'),
      fatG: read('fat_100g'),
      saturatedFatG: read('saturated-fat_100g'),
      fiberG: read('fiber_100g'),
      sugarsG: read('sugars_100g'),
      sodiumMg: (() => {
        const grams = read('sodium_100g');
        return grams == null ? null : Math.round(grams * 1000 * 100) / 100;
      })()
    }
  };
}

function normalizeOpenFoodFactsProduct(raw, requestedCode) {
  const product = raw && raw.product && typeof raw.product === 'object' ? raw.product : raw || {};
  const quantity = parseQuantity(product.quantity);
  return {
    identifier: { scheme:identifierScheme(requestedCode), value:requestedCode },
    canonicalName: firstString(product.product_name, product.generic_name) || 'Unnamed product',
    brand: firstString(product.brands),
    description: firstString(product.generic_name),
    packageQuantity: quantity.packageQuantity,
    packageUnit: quantity.packageUnit,
    category: firstString(product.categories),
    imageUrl: firstString(product.image_front_url, product.image_url),
    nutrition: {
      servingSize: firstString(product.serving_size),
      ingredients: firstString(product.ingredients_text),
      allergens: Array.isArray(product.allergens_tags) ? product.allergens_tags : [],
      nutrients: normalizeNutrients(product.nutriments),
      source: 'open_food_facts',
      sourceRecordId: String(product.code || requestedCode),
      sourceUpdatedAt: product.last_modified_t ? new Date(Number(product.last_modified_t) * 1000).toISOString() : null
    },
    provenance: {
      sourceType: 'product_lookup',
      sourceProvider: 'open_food_facts',
      sourceRecordId: String(product.code || requestedCode),
      observedAt: new Date().toISOString()
    }
  };
}

function normalizeUsdaNutrients(foodNutrients) {
  const nutrients = Array.isArray(foodNutrients) ? foodNutrients : [];
  const find = names => {
    const wanted = names.map(name => name.toLowerCase());
    const item = nutrients.find(entry => wanted.includes(String(entry && (entry.nutrientName || entry.name) || '').toLowerCase()));
    if (!item || item.value == null || item.value === '') return null;
    const value = Number(item.value);
    return Number.isFinite(value) ? { value, unit:firstString(item.unitName, item.unit) } : null;
  };
  return {
    basis: 'usda_source_reported',
    calories: find(['Energy','Energy (Atwater General Factors)','Energy (Atwater Specific Factors)']),
    protein: find(['Protein']),
    carbohydrate: find(['Carbohydrate, by difference']),
    fat: find(['Total lipid (fat)']),
    saturatedFat: find(['Fatty acids, total saturated']),
    fiber: find(['Fiber, total dietary']),
    sugars: find(['Sugars, total including NLEA','Total Sugars']),
    sodium: find(['Sodium, Na'])
  };
}

function normalizeUsdaProduct(food, requestedCode) {
  const servingSize = food.servingSize == null ? null : `${food.servingSize}${food.servingSizeUnit ? ` ${food.servingSizeUnit}` : ''}`;
  return {
    identifier: { scheme:identifierScheme(requestedCode), value:requestedCode },
    canonicalName: firstString(food.description) || 'Unnamed product',
    brand: firstString(food.brandName, food.brandOwner),
    description: firstString(food.description),
    packageQuantity: null,
    packageUnit: null,
    category: firstString(food.foodCategory),
    imageUrl: null,
    nutrition: {
      servingSize,
      ingredients: firstString(food.ingredients),
      allergens: [],
      nutrients: normalizeUsdaNutrients(food.foodNutrients),
      source: 'usda_fooddata_central',
      sourceRecordId: food.fdcId == null ? null : String(food.fdcId),
      sourceUpdatedAt: firstString(food.publicationDate) || null
    },
    provenance: {
      sourceType: 'product_lookup',
      sourceProvider: 'usda_fooddata_central',
      sourceRecordId: food.fdcId == null ? null : String(food.fdcId),
      observedAt: new Date().toISOString()
    }
  };
}

async function lookupOpenFoodFacts(code) {
  const upstream = await fetch(`${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(code)}?fields=${encodeURIComponent(FIELDS)}`, {
    headers: { 'User-Agent':USER_AGENT, 'Accept':'application/json' }
  });
  if (upstream.status === 404) return null;
  if (!upstream.ok) throw new Error(`OPEN_FOOD_FACTS_${upstream.status}`);
  const raw = await upstream.json();
  const found = raw && (raw.status === 'success' || raw.status === 1 || raw.product);
  return found ? normalizeOpenFoodFactsProduct(raw, code) : null;
}

async function lookupUsda(code) {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) return null;
  const upstream = await fetch(`${USDA_FDC_SEARCH}?api_key=${encodeURIComponent(apiKey)}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Accept':'application/json', 'User-Agent':USER_AGENT },
    body:JSON.stringify({ query:code, dataType:['Branded'], pageSize:10 })
  });
  if (!upstream.ok) throw new Error(`USDA_FDC_${upstream.status}`);
  const raw = await upstream.json();
  const foods = Array.isArray(raw && raw.foods) ? raw.foods : [];
  const exact = foods.find(food => digitsOnly(food && food.gtinUpc) === code);
  return exact ? normalizeUsdaProduct(exact, code) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mysimplehealth.org');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success:false, message:'Method not allowed.' });

  const url = new URL(req.url || '/', 'https://mysimplehealth.org');
  const code = normalizeCode(url.searchParams.get('code'));
  if (!code) return res.status(400).json({ success:false, message:'Enter a valid UPC or GTIN.' });

  let openFoodFactsError = null;
  try {
    const product = await lookupOpenFoodFacts(code);
    if (product) return res.status(200).json({ success:true, found:true, product, provider:'open_food_facts' });
  } catch (error) {
    openFoodFactsError = error;
    console.error('open food facts lookup error', error && error.message ? error.message : error);
  }

  try {
    const product = await lookupUsda(code);
    if (product) return res.status(200).json({ success:true, found:true, product, provider:'usda_fooddata_central' });
  } catch (error) {
    console.error('USDA FoodData Central lookup error', error && error.message ? error.message : error);
    if (openFoodFactsError) return res.status(502).json({ success:false, message:'Product lookup is temporarily unavailable.' });
  }

  return res.status(404).json({
    success:false,
    found:false,
    code,
    message:'Product not found.',
    sourcesChecked: process.env.USDA_FDC_API_KEY ? ['open_food_facts','usda_fooddata_central'] : ['open_food_facts']
  });
}
