// Google search for a topic via Gemini + Google Search grounding. Returns a short Hebrew fact sheet and the real source links.
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
  const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}b=b||{};
  const q=String((req.query&&req.query.q)||b.q||'').trim().slice(0,300);if(!q)return res.status(400).json({error:'missing q'});
  const ctx=String(b.context||'').slice(0,400);
  const prompt=`Search Google for up-to-date, accurate information about: «${q}».${ctx?` Context: it is for ${ctx}.`:''}
Then write in Hebrew a short fact sheet for making a presentation or a short video: 6-10 bullet points ("• "), each one concrete fact (numbers, dates, names, places, recent news when relevant). Simple language. No intro, no outro, no links in the text.`;
  const payload={contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{temperature:.4,maxOutputTokens:3000}};
  const models=['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-3.5-flash','gemini-flash-latest'];const errs=[];
  for(const m of models){try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
      const j=await r.json().catch(()=>({}));if(!r.ok){errs.push(m+': '+((j.error&&j.error.message)||r.status));continue}
      const cand=j.candidates&&j.candidates[0]||{};const text=((cand.content&&cand.content.parts)||[]).map(p=>p.text||'').join('').trim();if(!text){errs.push(m+': empty');continue}
      const gm=cand.groundingMetadata||{};const seen=new Set();const sources=(gm.groundingChunks||[]).map(c=>c.web||{}).filter(w=>w.uri&&!seen.has(w.uri)&&seen.add(w.uri)).slice(0,8).map(w=>({title:String(w.title||'').slice(0,120),uri:w.uri}));
      return res.status(200).json({text,sources,queries:gm.webSearchQueries||[],model:m})}catch(e){errs.push(m+': '+e.message)}}
  return res.status(502).json({error:'החיפוש לא הצליח כרגע',details:errs})}
