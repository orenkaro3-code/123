let MODELS=null;
async function ttsModels(key){
  if(MODELS)return MODELS;
  const pref=['gemini-2.5-flash-preview-tts','gemini-2.5-pro-preview-tts'];let found=[];
  try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(key),{signal:AbortSignal.timeout(8000)});const j=await r.json();
    found=(j.models||[]).map(m=>String(m.name||'').replace(/^models\//,'')).filter(n=>/tts/i.test(n));}catch(e){}
  found.sort((a,b)=>(/flash/.test(b)?1:0)-(/flash/.test(a)?1:0));
  MODELS=[...new Set([...found,...pref])];return MODELS;
}
function wav(pcm,rate){const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+pcm.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm])}
const VOICES=['Kore','Puck','Charon','Aoede','Fenrir','Leda','Orus','Zephyr','Sulafat','Algieba'];
export default async function handler(req,res){
  const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:'GEMINI_API_KEY missing'});
  if(req.method==='GET'&&req.query&&req.query.models)return res.status(200).json({models:await ttsModels(key)});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch(e){body={}}}
  if(req.method==='GET'&&req.query&&req.query.test)body={text:'שלום! זה ניסיון של קול בעברית בפלטה.',voice:'Kore'};
  else if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const text=String(body&&body.text||'').trim().slice(0,1200);if(!text)return res.status(400).json({error:'missing text'});
  const voice=VOICES.includes(body.voice)?body.voice:'Kore';const style=String(body.style||'').slice(0,120);
  const payload=JSON.stringify({contents:[{parts:[{text:(style?style+': ':'')+text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}});
  const errs=[];
  for(const m of (await ttsModels(key)).slice(0,4)){
    try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(40000)});
      const j=await r.json().catch(()=>({}));
      if(r.ok){const part=((j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts)||[]).find(p=>p.inlineData&&p.inlineData.data);
        if(part){const mt=part.inlineData.mimeType||'';const rate=+((/rate=(\d+)/.exec(mt)||[])[1]||24000);const raw=Buffer.from(part.inlineData.data,'base64');const out=/wav/i.test(mt)?raw:wav(raw,rate);
          if(req.method==='GET'){res.setHeader('Content-Type','audio/wav');return res.status(200).send(out)}
          return res.status(200).json({audio:out.toString('base64'),model:m})}
        errs.push(m+': no audio')}else errs.push(m+': '+((j.error&&j.error.message)||r.status).toString().slice(0,200))}catch(e){errs.push(m+': '+String(e&&e.message||e).slice(0,120))}}
  return res.status(502).json({error:'tts failed',tries:errs});
}
