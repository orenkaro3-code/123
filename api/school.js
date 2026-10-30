import crypto from 'crypto';
const norm=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function signAcct(profile){const p=Buffer.from(JSON.stringify(profile)).toString('base64url'),sig=crypto.createHmac('sha256',process.env.SCHOOL_SECRET||'').update(p).digest('base64url');return `acct.${p}.${sig}`}
export function verifySchool(t){try{const[k,p,s]=String(t).split('.');if((k!=='school'&&k!=='acct')||!p||!s)return null;const sig=crypto.createHmac('sha256',process.env.SCHOOL_SECRET||'').update(p).digest('base64url');if(sig.length!==s.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(s)))return null;const d=JSON.parse(Buffer.from(p,'base64url').toString());return d.exp>Date.now()?d:null}catch(e){return null}}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!process.env.SCHOOL_SECRET)return res.status(500).json({error:'not configured'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}
  const code=norm(b&&b.code),codes=(process.env.SCHOOL_CODES||'').split(',').map(norm).filter(Boolean),i=codes.indexOf(code);
  if(!code||i<0){await new Promise(r=>setTimeout(r,700));return res.status(401).json({error:'הקוד לא נכון. בדקו שהקלדתם אותו בדיוק'})}
  const n=i+1,profile={sub:'tzemach-'+n,name:`תלמיד/ה ${n} · בית ספר צמח`,given_name:`תלמיד/ה ${n}`,school:'צמח',picture:'',exp:Date.now()+1000*60*60*24*365};
  const p=Buffer.from(JSON.stringify(profile)).toString('base64url'),sig=crypto.createHmac('sha256',process.env.SCHOOL_SECRET).update(p).digest('base64url');
  return res.status(200).json({token:`school.${p}.${sig}`,profile});
}
