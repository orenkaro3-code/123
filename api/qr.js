import {put,list,del} from '@vercel/blob';
import {signAcct} from './school.js';
// QR sign-in (like WhatsApp Web): the computer shows a code, the phone signs in with Google and approves, the computer receives a paleta session token.
const ok=s=>/^[a-z0-9]{24,48}$/.test(s||'');
async function find(s){const {blobs}=await list({prefix:`qr/${s}`,limit:1});return blobs[0]||null}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
  if(!process.env.SCHOOL_SECRET)return res.status(500).json({error:'not configured'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}b=b||{};
  const s=String((req.query&&req.query.s)||b.s||'');if(!ok(s))return res.status(400).json({error:'bad session'});
  try{
    if(req.method==='GET'){const bl=await find(s);if(!bl)return res.status(200).json({ready:false});const r=await fetch(bl.url+'?t='+Date.now());const d=r.ok?await r.json():null;await del(bl.url).catch(()=>{});
      if(!d||Date.now()-d.at>5*60*1000)return res.status(200).json({ready:false,expired:true});return res.status(200).json({ready:true,token:d.token,profile:d.profile})}
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    const gt=String(b.gtoken||'');if(!gt)return res.status(401).json({error:'צריך להתחבר בטלפון'});
    const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+gt},signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(401).json({error:'ההתחברות בטלפון לא אומתה'});const g=await r.json();if(!g||!g.sub)return res.status(401).json({error:'ההתחברות בטלפון לא אומתה'});
    const profile={sub:g.sub,name:g.name||'',given_name:g.given_name||g.name||'',email:g.email||'',picture:g.picture||'',linked:true,exp:Date.now()+1000*60*60*24*90};
    await put(`qr/${s}.json`,JSON.stringify({token:signAcct(profile),profile,at:Date.now()}),{access:'public',contentType:'application/json',addRandomSuffix:true});
    return res.status(200).json({ok:true,name:profile.given_name})
  }catch(e){return res.status(500).json({error:String(e.message||e)})}}
