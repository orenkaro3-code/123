export default async function handler(req,res){
  let u=String((req.query&&req.query.u)||'');try{u=new URL(u)}catch(e){return res.status(400).send('bad url')}
  if(u.protocol!=='https:')return res.status(400).send('https only');
  try{const r=await fetch(u.href,{headers:{'User-Agent':'paleta-design/1.0'},redirect:'follow',signal:AbortSignal.timeout(10000)});
    const ct=r.headers.get('content-type')||'';if(!r.ok||!ct.startsWith('image/'))return res.status(415).send('not an image');
    const buf=Buffer.from(await r.arrayBuffer());if(buf.length>8e6)return res.status(413).send('too big');
    res.setHeader('Content-Type',ct);res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','public, s-maxage=86400, max-age=86400');return res.status(200).send(buf)}
  catch(e){return res.status(502).send('fetch failed')}
}
