const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.FOOD_DATE_LABEL_MODEL || process.env.FOOD_RECEIPT_MODEL || 'gpt-5.6-luna';

const LABEL_TYPES = ['expiration','use_by','best_by','best_if_used_by','sell_by','freeze_by','packed_on','manufactured_on','unknown'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mysimplehealth.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success:false, message:'Method not allowed.' });

  const { image } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ success:false, message:'A food date-label image is required.' });
  }
  if (image.length > 8_000_000) {
    return res.status(413).json({ success:false, message:'The date-label image is too large.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ success:false, message:'Food date scanning is not configured yet.' });
  }

  const schema = {
    type:'object',
    additionalProperties:false,
    properties:{
      printedText:{ type:'string' },
      labelType:{ type:'string', enum:LABEL_TYPES },
      normalizedDate:{ type:['string','null'] },
      confidence:{ type:'number', minimum:0, maximum:1 },
      ambiguous:{ type:'boolean' },
      ambiguityReason:{ type:['string','null'] }
    },
    required:['printedText','labelType','normalizedDate','confidence','ambiguous','ambiguityReason']
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
            {
              type:'input_text',
              text:'Read only the visible date label on this food package. Preserve the visible wording in printedText. Classify the label as expiration, use_by, best_by, best_if_used_by, sell_by, freeze_by, packed_on, manufactured_on, or unknown. normalizedDate must be YYYY-MM-DD only when the full calendar date is clearly supported by the image. Do not invent a missing year, month, or day. If the date is incomplete, illegible, conflicting, or otherwise uncertain, set normalizedDate to null, ambiguous to true, explain briefly in ambiguityReason, and lower confidence. A best-by or sell-by label is not automatically an expiration date.'
            },
            { type:'input_image', image_url:image }
          ]
        }],
        text:{ format:{ type:'json_schema', name:'msh_food_date_label', strict:true, schema } }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('food date label parse failed', response.status, detail.slice(0,1000));
      return res.status(502).json({ success:false, message:'The date label could not be read right now.' });
    }

    const payload = await response.json();
    const text = payload.output_text || payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!text) return res.status(502).json({ success:false, message:'No date-label data was returned.' });
    const extracted = JSON.parse(text);
    return res.status(200).json({
      success:true,
      extraction:{
        ...extracted,
        extractedAt:new Date().toISOString(),
        provenance:'MODEL_INFERRED'
      }
    });
  } catch (error) {
    console.error('food date label error', error);
    return res.status(500).json({ success:false, message:'The date label could not be processed.' });
  }
}
