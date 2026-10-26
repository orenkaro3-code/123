export default async function handler(req,res){
  const ping=req.method==='GET'&&req.query&&req.query.ping;if(req.method!=='POST'&&!ping)return res.status(405).json({error:'POST only'});
  const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch(e){body={}}}
  const prompt=ping?'Reply with only this JSON: {"ok":true}':body&&body.prompt;if(typeof prompt!=='string'||!prompt||prompt.length>80000)return res.status(400).json({error:'bad prompt'});
  const payload=JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.9}});
  const models=(process.env.GEMINI_MODEL?[process.env.GEMINI_MODEL]:[]).concat(['gemini-3.8-flash','gemini-flash-latest','gemini-3.8-flash']);
  const urls=[];for(const m of models){urls.push(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)}
  let last='no response';const errs=[];
  for(const u of urls){try{const r=await fetch(u+'?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:payload});
    const j=await r.json().catch(()=>({}));
    if(r.ok){const text=(j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts||[]).map(p=>p.text||'').join('');if(text)return res.status(200).json({text});last='empty answer';continue}
    last=(j.error&&j.error.message)||('HTTP '+r.status);errs.push(u.split('/')[2]+' '+u.split('/models/')[1]+': '+last.slice(0,160))}catch(e){last=String(e&&e.message||e)}}
  return res.status(502).json({error:last,tries:errs});
}
