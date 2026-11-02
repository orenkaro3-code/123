import {put,list} from '@vercel/blob';
import crypto from 'crypto';
import {verifySchool} from './school.js';
// Site stats: POST records one browser session (views, device, and the signed-in account if any).
// GET returns totals for the admin page; only emails listed in ADMIN_EMAILS may read it.
const day=d=>(d||new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
const clean=(v,n=200)=>String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,n);
async function google(t){try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(6000)});if(!r.ok)return null;const p=await r.json();return p&&p.sub?p:null}catch(e){return null}}
async function who(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;
  if(t.startsWith('school.')||t.startsWith('acct.')){const s=verifySchool(t);if(!s)return null;return t.startsWith('acct.')?{via:'qr',sub:s.sub,email:s.email||'',name:s.name||'',pic:s.picture||''}:{via:'school',sub:s.sub,email:'',name:s.name||('קוד בית ספר '+(s.code||'')),pic:''}}
  const p=await google(t);return p?{via:'google',sub:p.sub,email:p.email||'',name:p.name||'',pic:p.picture||''}:null}
function device(ua){ua=String(ua||'');if(/iPad|Tablet/i.test(ua))return 'טאבלט';if(/Mobi|Android|iPhone/i.test(ua))return 'טלפון';return 'מחשב'}
function browser(ua){ua=String(ua||'');if(/Edg\//.test(ua))return 'Edge';if(/SamsungBrowser/.test(ua))return 'Samsung';if(/Chrome\//.test(ua))return 'Chrome';if(/Safari\//.test(ua))return 'Safari';if(/Firefox\//.test(ua))return 'Firefox';return 'אחר'}
const sec=()=>process.env.SCHOOL_SECRET||'paleta';
const keyFor=(d,sid)=>`st/${d}/${crypto.createHmac('sha256',sec()).update(sid).digest('hex').slice(0,40)}.json`;
async function readJSON(url){try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)});return r.ok?await r.json():null}catch(e){return null}}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
 try{
  if(req.method==='POST'){let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}b=b||{};
   const sid=clean(b.sid,40),vid=clean(b.vid,40);if(!/^[a-z0-9]{8,40}$/i.test(sid)||!/^[a-z0-9]{8,40}$/i.test(vid))return res.status(400).json({error:'bad id'});
   const u=await who(req),now=Date.now(),d=day(),ua=req.headers['user-agent']||'';
   const rec={sid,vid,day:d,first:Math.min(now,Number(b.first)||now),last:now,views:Math.max(1,Math.min(500,Number(b.views)||1)),path:clean(b.path,120),ref:clean(b.ref,160),dev:device(ua),br:browser(ua),
    country:clean(req.headers['x-vercel-ip-country'],4),city:decodeURIComponent(clean(req.headers['x-vercel-ip-city'],60)||''),user:u};
   await put(keyFor(d,sid),JSON.stringify(rec),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});
   return res.status(200).json({ok:true})}
  if(req.method!=='GET')return res.status(405).json({error:'method'});
  const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';const me=t&&!t.includes('.')?await google(t):null;
  const admins=String(process.env.ADMIN_EMAILS||'').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if(!me)return res.status(401).json({error:'צריך להתחבר עם Google'});
  if(!me.email_verified||!admins.includes(String(me.email).toLowerCase()))return res.status(403).json({error:'לחשבון הזה אין גישה לדף הניהול',email:me.email});
  const days=Math.max(1,Math.min(60,Number(req.query.days)||14));const since=day(new Date(Date.now()-(days-1)*864e5));
  let blobs=[],cursor;do{const r=await list({prefix:'st/',limit:1000,cursor});blobs.push(...r.blobs.filter(x=>x.pathname.slice(3,13)>=since));cursor=r.hasMore?r.cursor:null}while(cursor&&blobs.length<3000);
  blobs.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));blobs=blobs.slice(0,1500);
  const recs=[];for(let i=0;i<blobs.length;i+=40){const part=await Promise.all(blobs.slice(i,i+40).map(x=>readJSON(x.url)));recs.push(...part.filter(Boolean))}
  const byDay={};for(let k=0;k<days;k++){const dd=day(new Date(Date.now()-(days-1-k)*864e5));byDay[dd]={day:dd,views:0,sessions:0,visitors:new Set()}}
  const vis=new Set(),users={},cnt=(o,k)=>{if(!k)return;o[k]=(o[k]||0)+1},refs={},devs={},brs={},ctry={};let views=0;
  for(const r of recs){views+=r.views;vis.add(r.vid);const D=byDay[r.day];if(D){D.views+=r.views;D.sessions++;D.visitors.add(r.vid)}
   let ref='';try{ref=r.ref?new URL(r.ref).hostname.replace(/^www\./,''):''}catch(e){}cnt(refs,ref||'ישיר / לא ידוע');cnt(devs,r.dev);cnt(brs,r.br);cnt(ctry,r.country||'?');
   if(r.user&&r.user.sub){const k=r.user.via+':'+r.user.sub,U=users[k]||(users[k]={via:r.user.via,email:r.user.email,name:r.user.name,pic:r.user.pic,first:r.first,last:r.last,sessions:0,views:0});U.sessions++;U.views+=r.views;U.first=Math.min(U.first,r.first);U.last=Math.max(U.last,r.last);if(r.user.email)U.email=r.user.email;if(r.user.name)U.name=r.user.name;if(r.user.pic)U.pic=r.user.pic}}
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const recent=recs.sort((a,b)=>b.last-a.last).slice(0,40).map(r=>({last:r.last,views:r.views,dev:r.dev,br:r.br,country:r.country,city:r.city,ref:r.ref,user:r.user?{via:r.user.via,email:r.user.email,name:r.user.name}:null}));
  return res.status(200).json({days,since,totals:{views,sessions:recs.length,visitors:vis.size,signedIn:Object.keys(users).length,today:byDay[day()]?{views:byDay[day()].views,visitors:byDay[day()].visitors.size}:null},
   series:Object.values(byDay).map(x=>({day:x.day,views:x.views,sessions:x.sessions,visitors:x.visitors.size})),users:Object.values(users).sort((a,b)=>b.last-a.last),refs:top(refs),devices:top(devs),browsers:top(brs),countries:top(ctry),recent,capped:blobs.length>=1500,admin:me.email})
 }catch(e){return res.status(500).json({error:String(e.message||e)})}}
