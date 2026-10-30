import {put,list} from '@vercel/blob';
import crypto from 'crypto';
import {verifySchool} from './school.js';
// One AI video per person per day (Israel time). Identity: Google account, school code, or else the IP address (hashed).
const day=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
async function who(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';
  if(t.startsWith('school.')||t.startsWith('acct.')){const s=verifySchool(t);if(s)return (t.startsWith('acct.')?'g:':'s:')+s.sub}
  else if(t){try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(6000)});if(r.ok){const p=await r.json();if(p&&p.sub)return 'g:'+p.sub}}catch(e){}}
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim();return 'ip:'+ip}
const key=async req=>{const id=crypto.createHash('sha256').update((process.env.SCHOOL_SECRET||'paleta')+'|'+await who(req)).digest('hex').slice(0,32);return `vq/${day()}/${id}.json`};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
  try{const k=await key(req);const {blobs}=await list({prefix:k,limit:1});const used=blobs.length>0;
    if(req.method==='GET')return res.status(200).json({used,left:used?0:1,day:day()});
    if(req.method!=='POST')return res.status(405).json({error:'method'});
    if(used)return res.status(429).json({error:'כבר יצרתם סרטון AI היום. אפשר ליצור סרטון חדש מחר',used:true,left:0});
    await put(k,JSON.stringify({at:Date.now()}),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});
    return res.status(200).json({used:true,left:0})}
  catch(e){return res.status(200).json({used:false,left:1,soft:true})}}
