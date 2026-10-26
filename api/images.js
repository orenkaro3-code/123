export default async function handler(req,res){
  const q=String((req.query&&req.query.q)||'').trim().slice(0,100);if(!q)return res.status(400).json({error:'missing q'});
  res.setHeader('Cache-Control','public, s-maxage=3600, max-age=600');
  const items=[];
  try{const r=await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`,{headers:{'User-Agent':'paleta-design/1.0'},signal:AbortSignal.timeout(8000)});
    if(r.ok){const j=await r.json();for(const x of j.results||[])items.push({id:'ov-'+x.id,title:x.title||q,thumb:x.thumbnail||x.url,full:x.url,creator:x.creator||'',license:((x.license||'')+' '+(x.license_version||'')).trim().toUpperCase(),link:x.foreign_landing_url||'',w:x.width||0,h:x.height||0})}}catch(e){}
  if(items.length<8){try{const u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap '+q)}&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1200&format=json&origin=*`;
    const r=await fetch(u,{headers:{'User-Agent':'paleta-design/1.0 (contact: orenkaro3@gmail.com)'},signal:AbortSignal.timeout(8000)});const j=await r.json();
    for(const p of Object.values((j.query&&j.query.pages)||{})){const ii=p.imageinfo&&p.imageinfo[0];if(!ii)continue;const md=ii.extmetadata||{};items.push({id:'wm-'+p.pageid,title:(p.title||'').replace(/^File:/,'').replace(/\.[a-z]+$/i,''),thumb:ii.thumburl||ii.url,full:ii.thumburl||ii.url,creator:(md.Artist&&md.Artist.value||'').replace(/<[^>]+>/g,'').slice(0,80),license:(md.LicenseShortName&&md.LicenseShortName.value)||'',link:ii.descriptionurl||'',w:ii.thumbwidth||ii.width,h:ii.thumbheight||ii.height})}}catch(e){}}
  return res.status(200).json({items:items.slice(0,30)});
}
