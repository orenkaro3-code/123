import {put,list} from '@vercel/blob';
import {verifySchool} from './school.js';
const KINDS=['site','game'];
async function who(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;if(t.startsWith('school.'))return verifySchool(t);
  try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(6000)});if(!r.ok)return null;const p=await r.json();return p&&p.sub?p:null}catch(e){return null}}
async function load(kind,id){const {blobs}=await list({prefix:`pub/${kind}/${id}.json`,limit:1});if(!blobs.length)return null;const r=await fetch(blobs[0].url+'?t='+Date.now());return r.ok?r.json():null}
const notFound='<!doctype html><meta charset="utf-8"><title>לא נמצא</title><body style="font-family:system-ui;text-align:center;padding:60px;direction:rtl"><h1>הדף לא נמצא</h1><p><a href="https://paleta-ebon.vercel.app">ליצירת אתר או משחק בפלטה</a></p>';
export default async function handler(req,res){
  const kind=String((req.query&&req.query.kind)||(req.body&&req.body.kind)||'');if(!KINDS.includes(kind))return res.status(400).json({error:'bad kind'});
  if(req.method==='GET'){
    if(req.query.list){try{const {blobs}=await list({prefix:`pub/${kind}/`,limit:200});blobs.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));const items=(await Promise.all(blobs.slice(0,40).map(b=>fetch(b.url).then(r=>r.ok?r.json():null).catch(()=>null)))).filter(Boolean).map(x=>({id:x.id,title:x.title,author:x.author,created:x.created,thumb:x.thumb||''}));res.setHeader('Cache-Control','public, s-maxage=30, max-age=10');return res.status(200).json({items})}catch(e){return res.status(500).json({error:String(e.message||e)})}}
    const id=String(req.query.id||'').replace(/[^a-z0-9]/gi,'').slice(0,40);let d=null;try{d=id?await load(kind,id):null}catch(e){}
    if(req.query.spec){if(!d)return res.status(404).json({error:'not found'});return res.status(200).json({id:d.id,title:d.title,spec:d.spec||null,authorId:d.authorId})}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"sandbox allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'");res.setHeader('Cache-Control','public, s-maxage=15, max-age=0');res.setHeader('X-Robots-Tag','noindex');
    if(!d)return res.status(404).send(notFound);return res.status(200).send(String(d.html||''))}
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  const u=await who(req);if(!u)return res.status(401).json({error:'צריך להתחבר (Google או קוד בית ספר) כדי לפרסם'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}
  const html=String(b.html||'');if(!html||html.length>4e6)return res.status(413).json({error:'הדף ריק או גדול מדי'});
  let id=String(b.id||'').replace(/[^a-z0-9]/gi,'').slice(0,40);if(id){try{const old=await load(kind,id);if(old&&old.authorId!==u.sub)id=''}catch(e){id=''}}
  if(!id)id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const doc={id,kind,title:String(b.title||'').slice(0,80)||'ללא שם',html,spec:b.spec&&JSON.stringify(b.spec).length<2e6?b.spec:null,thumb:typeof b.thumb==='string'&&b.thumb.startsWith('data:image/')&&b.thumb.length<300000?b.thumb:'',author:(u.given_name||u.name||'משתמש').slice(0,40),authorId:u.sub,created:Date.now()};
  try{await put(`pub/${kind}/${id}.json`,JSON.stringify(doc),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});return res.status(200).json({ok:true,id,url:`/${kind==='site'?'s':'g'}/${id}`})}
  catch(e){return res.status(500).json({error:String(e.message||e)})}
}
