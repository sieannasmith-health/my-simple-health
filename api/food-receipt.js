const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.FOOD_RECEIPT_MODEL || 'gpt-5.6-luna';

const ALLOWED_STORES = new Set(['Costco','Meijer','Kroger','Whole Foods','BJ\'s','Other']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mysimplehealth.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method not allowed.' });

  const { image, store = 'Other' } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ success:false, message:'A receipt image is required.' });
  }
  if (image.length > 12_000_000) {
    return res.status(413).json({ success:false, message:'Receipt image is too large.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ success:false, message:'Receipt scanning is not configured yet.' });
  }

  const requestedStore = ALLOWED_STORES.has(store) ? store : 'Other';
  const schema = {
    type:'object',
    additionalProperties:false,
    properties:{
      merchant:{ type:'string' },
      purchaseDate:{ type:['string','null'] },
      subtotal:{ type:['number','null'] },
      tax:{ type:['number','null'] },
      total:{ type:['number','null'] },
      items:{
        type:'array',
        items:{
          type:'object',
          additionalProperties:false,
          properties:{
            receiptText:{ type:'string' },
            normalizedName:{ type:'string' },
            quantity:{ type:['number','null'] },
            unitPrice:{ type:['number','null'] },
            lineTotal:{ type:['number','null'] },
            confidence:{ type:'number', minimum:0, maximum:1 }
          },
          required:['receiptText','normalizedName','quantity','unitPrice','lineTotal','confidence']
        }
      }
    },
    required:['merchant','purchaseDate','subtotal','tax','total','items']
  };

  try {
    const response = await fetch(OPENAI_URL, {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:MODEL,
        input:[{
          role:'user',
          content:[
            { type:'input_text', text:`Read this grocery receipt. The user selected ${requestedStore}. Extract only what is visible. Normalize abbreviated grocery line items into plain food/product names when reasonably supported, but do not invent products, quantities, or prices. Preserve uncertainty through the confidence field.` },
            { type:'input_image', image_url:image }
          ]
        }],
        text:{ format:{ type:'json_schema', name:'grocery_receipt', strict:true, schema } }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('food receipt parse failed', response.status, detail.slice(0,1000));
      return res.status(502).json({ success:false, message:'The receipt could not be read right now.' });
    }

    const payload = await response.json();
    const text = payload.output_text || payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!text) return res.status(502).json({ success:false, message:'No receipt data was returned.' });

    const receipt = JSON.parse(text);
    return res.status(200).json({ success:true, receipt:{ ...receipt, selectedStore:requestedStore } });
  } catch (error) {
    console.error('food receipt error', error);
    return res.status(500).json({ success:false, message:'The receipt could not be processed.' });
  }
}
