const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function tokens(value) {
  return new Set(clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(token => token.length > 1));
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach(token => { if (b.has(token)) overlap += 1; });
  const precision = overlap / b.size;
  const recall = overlap / a.size;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function nutrientValue(food, names) {
  const nutrients = Array.isArray(food && food.foodNutrients) ? food.foodNutrients : [];
  for (const nutrient of nutrients) {
    const name = String(nutrient && (nutrient.nutrientName || nutrient.name) || '').toLowerCase();
    if (names.some(candidate => name === candidate)) {
      const value = Number(nutrient.value);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function normalizeCandidate(food, query) {
  const description = clean(food && food.description, 240);
  const brandOwner = clean(food && (food.brandOwner || food.brandName), 160) || null;
  const gtin = clean(food && food.gtinUpc, 32) || null;
  const score = Math.max(similarity(query, description), similarity(query, `${brandOwner || ''} ${description}`));
  return {
    provider:'usda_fdc',
    providerId:food && food.fdcId != null ? String(food.fdcId) : null,
    canonicalName:description || 'Unnamed product',
    brand:brandOwner,
    gtin,
    dataType:food && food.dataType || null,
    score:Math.round(score * 1000) / 1000,
    nutrition:{
      caloriesKcal:nutrientValue(food, ['energy']),
      proteinG:nutrientValue(food, ['protein']),
      carbohydrateG:nutrientValue(food, ['carbohydrate, by difference']),
      fatG:nutrientValue(food, ['total lipid (fat)']),
      fiberG:nutrientValue(food, ['fiber, total dietary']),
      sugarsG:nutrientValue(food, ['total sugars']),
      sodiumMg:nutrientValue(food, ['sodium, na'])
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mysimplehealth.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method not allowed.' });

  const query = clean(req.body && (req.body.name || req.body.receiptText), 160);
  if (query.length < 2) return res.status(400).json({ success:false, message:'A receipt item name is required.' });
  if (!process.env.USDA_FDC_API_KEY) return res.status(503).json({ success:false, message:'USDA product matching is not configured.' });

  try {
    const response = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(process.env.USDA_FDC_API_KEY)}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        query,
        dataType:['Branded'],
        pageSize:8,
        pageNumber:1,
        sortBy:'dataType.keyword',
        sortOrder:'asc'
      })
    });
    if (!response.ok) {
      console.error('USDA receipt match failed', response.status);
      return res.status(502).json({ success:false, message:'Product matching is temporarily unavailable.' });
    }
    const payload = await response.json();
    const candidates = (Array.isArray(payload.foods) ? payload.foods : [])
      .map(food => normalizeCandidate(food, query))
      .filter(candidate => candidate.canonicalName)
      .sort((a,b) => b.score - a.score)
      .slice(0,5);
    return res.status(200).json({ success:true, query, candidates });
  } catch (error) {
    console.error('USDA receipt match error', error);
    return res.status(502).json({ success:false, message:'Product matching is temporarily unavailable.' });
  }
}
