import {put,list} from '@vercel/blob';
const ok=id=>/^[a-z0-9]{10,40}$/.test(id||'');
async function load(id){const {blobs}=await list({prefix:`hw/${id}.json`,limit:1});if(!blobs.length)return null;const r=await fetch(blobs[0].url+'?t='+Date.now());return r.ok?r.json():null}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
  const id=String((req.query&&req.query.id)||(req.body&&req.body.id)||'');if(!ok(id))return res.status(400).json({error:'bad id'});
  if(req.method==='GET'){try{const d=await load(id);return d?res.status(200).json(d):res.status(404).json({error:'not found'})}catch(e){return res.status(500).json({error:String(e.message||e)})}}
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b={}}}
  const g=b.glyphs&&typeof b.glyphs==='object'?b.glyphs:{};let cur=null;try{cur=await load(id)}catch(e){}
  const out=cur||{id,glyphs:{},created:Date.now()};for(const[k,v]of Object.entries(g)){if([...k].length!==1)continue;if(v===null){delete out.glyphs[k];continue}const s=JSON.stringify(v);if(s.length>60000)continue;out.glyphs[k]=v}
  out.updated=Date.now();out.done=!!b.done||!!(cur&&cur.done);const s=JSON.stringify(out);if(s.length>2.5e6)return res.status(413).json({error:'too big'});
  try{await put(`hw/${id}.json`,s,{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});return res.status(200).json({ok:true,count:Object.keys(out.glyphs).length})}catch(e){return res.status(500).json({error:String(e.message||e)})}
}
