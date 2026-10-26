import {put,list} from '@vercel/blob';
const TYPES=['design','anim','image'];
async function who(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;
  try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(6000)});if(!r.ok)return null;const p=await r.json();return p&&p.sub?p:null}catch(e){return null}}
export default async function handler(req,res){
  const type=String((req.query&&req.query.type)||(req.body&&req.body.type)||'');if(!TYPES.includes(type))return res.status(400).json({error:'bad type'});
  if(req.method==='GET'){res.setHeader('Cache-Control','public, s-maxage=20, max-age=10');
    try{const {blobs}=await list({prefix:`community/${type}/meta/`,limit:200});blobs.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
      const items=(await Promise.all(blobs.slice(0,60).map(b=>fetch(b.url).then(r=>r.ok?r.json():null).catch(()=>null)))).filter(Boolean);return res.status(200).json({items})}
    catch(e){return res.status(500).json({error:String(e.message||e)})}}
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const u=await who(req);if(!u)return res.status(401).json({error:'צריך להתחבר עם Google כדי לפרסם'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}
  const title=String(b.title||'').trim().slice(0,60)||'ללא שם',thumb=typeof b.thumb==='string'&&b.thumb.startsWith('data:image/')&&b.thumb.length<400000?b.thumb:'';
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const meta={id,type,title,author:(u.given_name||u.name||'משתמש').slice(0,40),authorPic:u.picture||'',authorId:u.sub,created:Date.now(),thumb};
  try{
    if(type==='design'){const s=JSON.stringify(b.data||{});if(s.length>3.5e6)return res.status(413).json({error:'העיצוב גדול מדי לפרסום. נסו להקטין תמונות'});const d=await put(`community/design/data/${id}.json`,s,{access:'public',contentType:'application/json',addRandomSuffix:false});meta.dataUrl=d.url}
    else if(type==='image'){const m=/^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(String(b.data||''));if(!m)return res.status(400).json({error:'bad image'});const buf=Buffer.from(m[3],'base64');if(buf.length>5e6)return res.status(413).json({error:'התמונה גדולה מדי'});const d=await put(`community/image/files/${id}.${m[2]==='jpeg'?'jpg':m[2]}`,buf,{access:'public',contentType:m[1],addRandomSuffix:false});meta.url=d.url}
    else{const a=b.data||{};const n=k=>Math.max(-2000,Math.min(2000,Number(a[k])||0));meta.anim={x:n('x'),y:n('y'),s:Math.max(0,Math.min(5,Number(a.s)||1)),r:n('r'),o:Math.max(0,Math.min(1,Number(a.o))),b:Math.max(0,Math.min(60,Number(a.b)||0)),dur:Math.max(.1,Math.min(10,Number(a.dur)||.8)),ease:['ease','ease-in','ease-out','ease-in-out','linear','bounce','elastic'].includes(a.ease)?a.ease:'ease-out',loop:!!a.loop}}
    await put(`community/${type}/meta/${id}.json`,JSON.stringify(meta),{access:'public',contentType:'application/json',addRandomSuffix:false});
    return res.status(200).json({ok:true,item:meta})}
  catch(e){return res.status(500).json({error:String(e.message||e)})}
}
