const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v3/product';
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
      const value = Number(source[key]);
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

function normalizeProduct(raw, requestedCode) {
  const product = raw && raw.product && typeof raw.product === 'object' ? raw.product : raw || {};
  const quantity = parseQuantity(product.quantity);
  return {
    identifier: {
      scheme: requestedCode.length === 8 ? 'gtin_8' : requestedCode.length === 12 ? 'gtin_12' : requestedCode.length === 13 ? 'gtin_13' : 'gtin_14',
      value: requestedCode
    },
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mysimplehealth.org');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success:false, message:'Method not allowed.' });

  const url = new URL(req.url || '/', 'https://mysimplehealth.org');
  const code = normalizeCode(url.searchParams.get('code'));
  if (!code) return res.status(400).json({ success:false, message:'Enter a valid UPC or GTIN.' });

  try {
    const upstream = await fetch(`${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(code)}?fields=${encodeURIComponent(FIELDS)}`, {
      headers: { 'User-Agent':USER_AGENT, 'Accept':'application/json' }
    });

    if (upstream.status === 404) return res.status(404).json({ success:false, found:false, code, message:'Product not found.' });
    if (!upstream.ok) {
      console.error('food product lookup failed', upstream.status);
      return res.status(502).json({ success:false, message:'Product lookup is temporarily unavailable.' });
    }

    const raw = await upstream.json();
    const status = raw && (raw.status === 'success' || raw.status === 1 || raw.product);
    if (!status) return res.status(404).json({ success:false, found:false, code, message:'Product not found.' });

    return res.status(200).json({
      success:true,
      found:true,
      product:normalizeProduct(raw, code),
      provider:'open_food_facts'
    });
  } catch (error) {
    console.error('food product lookup error', error);
    return res.status(502).json({ success:false, message:'Product lookup is temporarily unavailable.' });
  }
}
