async function probe(key,q){const out={};if(q.models){const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(key));const j=await r.json();out.models=(j.models||[]).map(m=>m.name.replace('models/','')).filter(n=>/gemini/.test(n)&&!/tts|image|embed|audio|live/.test(n));return out}
 const m=q.model||'gemini-3.8-flash',gc={maxOutputTokens:+q.max||2000};if(q.think==='low')gc.thinkingConfig={thinkingLevel:'low'};if(q.think==='0')gc.thinkingConfig={thinkingBudget:0};if(q.think==='minimal')gc.thinkingConfig={thinkingLevel:'minimal'};
 const t0=Date.now();const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Write a tiny HTML page with a red square. Only HTML.'}]}],generationConfig:gc}),signal:AbortSignal.timeout(100000)});const j=await r.json().catch(()=>({}));out.status=r.status;out.ms=Date.now()-t0;out.err=j.error&&j.error.message;out.usage=j.usageMetadata;return out}
export default async function handler(req,res){
  if(req.method==='GET'&&req.query&&(req.query.probe||req.query.models)){const k=process.env.GEMINI_API_KEY;try{return res.status(200).json(await probe(k,req.query))}catch(e){return res.status(500).json({error:String(e.message||e)})}}
  const ping=req.method==='GET'&&req.query&&req.query.ping;if(req.method!=='POST'&&!ping)return res.status(405).json({error:'POST only'});
  const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch(e){body={}}}
  const prompt=ping?'Reply with only this JSON: {"ok":true}':body&&body.prompt;if(typeof prompt!=='string'||!prompt||prompt.length>200000)return res.status(400).json({error:'bad prompt'});
  const mode=body&&body.mode==='text'?'text':'json',long=!!(body&&body.long);const parts=[{text:prompt}];
  const imgs=(body&&Array.isArray(body.images)?body.images:body&&body.image?[body.image]:[]).slice(0,3);for(const im of imgs){if(im&&/^image\/(png|jpeg|webp)$/.test(im.mime)&&typeof im.data==='string'&&im.data.length<6e6)parts.push({inlineData:{mimeType:im.mime,data:im.data}})}
  const gc={temperature:mode==='text'?0.7:0.9,maxOutputTokens:long?60000:16000};if(mode==='json')gc.responseMimeType='application/json';
  const payload=JSON.stringify({contents:[{role:'user',parts}],generationConfig:gc});
  const models=(process.env.GEMINI_MODEL?[process.env.GEMINI_MODEL]:[]).concat(['gemini-3.8-flash','gemini-flash-latest','gemini-flash-lite-latest','gemini-3.8-flash']);
  const urls=[];for(const m of models){urls.push(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)}
  const t0=Date.now();let last='no response';const errs=[];
  for(let n=0;n<urls.length;n++){const u=urls[n];if(n)await new Promise(r=>setTimeout(r,1500));try{const BUD=long?170000:55000,PER=long?150000:25000;if(Date.now()-t0>BUD-15000)break;const r=await fetch(u+'?key='+encodeURIComponent(key),{signal:AbortSignal.timeout(Math.min(PER,BUD-(Date.now()-t0))),method:'POST',headers:{'Content-Type':'application/json'},body:payload});
    const j=await r.json().catch(()=>({}));
    if(r.ok){const text=(j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts||[]).map(p=>p.text||'').join('');if(text)return res.status(200).json({text});last='empty answer';continue}
    last=(j.error&&j.error.message)||('HTTP '+r.status);errs.push(u.split('/')[2]+' '+u.split('/models/')[1]+': '+last.slice(0,160))}catch(e){last=String(e&&e.message||e)}}
  return res.status(502).json({error:last,tries:errs});
}
