export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}
  const key=b&&b.key,prompt=b&&b.prompt;if(typeof key!=='string'||!key.startsWith('sk-'))return res.status(400).json({error:'מפתח Claude לא תקין'});
  if(typeof prompt!=='string'||!prompt||prompt.length>80000)return res.status(400).json({error:'bad prompt'});
  let last='no response';
  for(const model of ['claude-sonnet-5-5','claude-haiku-5-5']){try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(55000),headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:8000,messages:[{role:'user',content:prompt+'\n\nReply with only the JSON object.'}]})});
    const j=await r.json().catch(()=>({}));if(r.ok){const text=(j.content||[]).map(c=>c.text||'').join('');if(text)return res.status(200).json({text,model})}
    last=(j.error&&j.error.message)||('HTTP '+r.status);if(r.status===401||r.status===403)break}catch(e){last=String(e&&e.message||e)}}
  return res.status(502).json({error:last});
}
