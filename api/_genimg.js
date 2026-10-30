import {put} from '@vercel/blob';
import crypto from 'crypto';
// AI image generation with Gemini (Google). The image is stored in Vercel Blob and its URL is returned.
let MODELS=null;
async function imgModels(key){if(MODELS)return MODELS;let found=[];try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(key),{signal:AbortSignal.timeout(8000)});const j=await r.json();found=(j.models||[]).map(m=>String(m.name||'').replace(/^models\//,'')).filter(n=>/image/i.test(n)&&/gemini/i.test(n)&&!/edit/i.test(n))}catch(e){}
  const score=n=>{const v=parseFloat((/(\d+(\.\d+)?)/.exec(n)||[])[1]||0);return v*10+(/flash/.test(n)?3:0)-(/preview/.test(n)?1:0)};found.sort((a,b)=>score(b)-score(a));MODELS=[...new Set([...found,'gemini-2.5-flash-image','gemini-2.5-flash-image-preview'])];return MODELS}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
  const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}b=b||{};
  if(req.method==='GET'&&req.query&&req.query.models)return res.status(200).json({models:await imgModels(key)});
  const prompt=String((req.query&&req.query.p)||b.prompt||'').trim().slice(0,900);if(!prompt)return res.status(400).json({error:'missing prompt'});
  const ar=['1:1','16:9','9:16','4:3','3:4'].includes(b.aspect||req.query.aspect)?(b.aspect||req.query.aspect):'16:9';
  const text=`${prompt}. High quality, no text, no letters, no watermark, no logos.`;const errs=[];
  for(const m of (await imgModels(key)).slice(0,3)){try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text}]}],generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:ar}}}),signal:AbortSignal.timeout(55000)});
      const j=await r.json().catch(()=>({}));if(!r.ok){errs.push(m+': '+((j.error&&j.error.message)||r.status).toString().slice(0,160));continue}
      const part=((j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts)||[]).find(p=>p.inlineData&&p.inlineData.data);if(!part){errs.push(m+': no image');continue}
      const buf=Buffer.from(part.inlineData.data,'base64'),mt=part.inlineData.mimeType||'image/png',ext=/jpeg/.test(mt)?'jpg':'png';const id=crypto.createHash('sha1').update(text+ar+Date.now()).digest('hex').slice(0,20);
      const bl=await put(`gen/${id}.${ext}`,buf,{access:'public',contentType:mt,addRandomSuffix:false});return res.status(200).json({url:bl.url,model:m})}catch(e){errs.push(m+': '+e.message)}}
  return res.status(502).json({error:'יצירת התמונה לא הצליחה',details:errs})}
