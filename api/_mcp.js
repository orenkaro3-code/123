import {put,list} from '@vercel/blob';
import crypto from 'crypto';
import META from './_meta.js';
// Paleta MCP server (Streamable HTTP, stateless JSON responses). Lets Claude make designs and slide decks in Paleta
// and shows them live inside the chat (MCP Apps viewer), with an "open in Paleta" link to keep editing.
const SITE='https://paleta-ebon.vercel.app';
const VIEWER='ui://paleta/viewer.html';
const PROTOS=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const THEMES=META.themes.map(t=>t.key),FORMATS=META.formats.map(f=>f.key),MOTIFS=META.motifs.map(m=>m.key);
const SLIDE={type:'object',properties:{style:{type:'string',enum:['cover','bullets','cards','stats','timeline','photo','quote','end'],description:'Slide layout. First slide "cover", last slide "end".'},kicker:{type:'string',description:'Short label above the title'},title:{type:'string',description:'Slide title, under 6 words. Use \\n for a line break.'},subtitle:{type:'string',description:'One sentence'},items:{type:'array',items:{type:'string'},description:'2-5 short points (bullets, cards, timeline), under 8 words each'},stats:{type:'array',items:{type:'array',items:{type:'string'}},description:'For "stats": pairs like [["85%","short label"]]'},icon:{type:'string',enum:META.icons},photo_query:{type:'string',description:'2-4 ENGLISH words for a real photo (cover, photo, bullets slides)'},hl:{type:'string',description:'Optional punchy 2-4 word phrase shown with a highlighter'},sticker:{type:'string',description:'Optional 1-3 word sticker badge (cover)'},alt:{type:'boolean',description:'Contrasting colour slide'}},required:['style','title']};
const DESIGN_PROPS={format:{type:'string',enum:FORMATS,description:'Canvas size: '+META.formats.map(f=>`${f.key}=${f.name} ${f.w}x${f.h}`).join(', ')},
 style:{type:'string',enum:['poster','split','mesh','frame','neon','burst','photo','band','edit','cards','round'],description:'Composition style. poster=bold campaign poster, split=photo half, mesh=soft gradient, frame=framed, neon=glow, burst=big number/sale, photo=full photo, band=colour band, edit=editorial, cards=list cards, round=rounded playful'},
 title:{type:'string',description:'Big headline in the user\'s language (Hebrew by default). Max 3 short lines, \\n for line breaks.'},kicker:{type:'string'},subtitle:{type:'string'},cta:{type:'string',description:'Button text, or empty'},big:{type:'string',description:'Short big number like -50% (burst style)'},items:{type:'array',items:{type:'string'},description:'2-4 short items (cards style)'},
 icon:{type:'string',enum:META.icons},photo_query:{type:'string',description:'English words for a real photo (photo/split/poster styles)'},hl:{type:'string',description:'Highlighter phrase (poster)'},sticker:{type:'string',description:'Sticker badge (poster)'},
 palette:{type:'integer',minimum:0,maximum:11,description:'0 white/blue, 1 navy/orange, 2 cream/red, 3 dark teal, 4 lilac, 5 black/lime, 6 sky, 7 pink, 8 sand/green, 9 night/cyan, 10 yellow, 11 Israel blue'},font:{type:'integer',minimum:0,maximum:7,description:'0 Rubik, 1 Secular One, 2 Suez One, 3 Frank Ruhl Libre, 4 Heebo, 5 Varela Round, 6 Karantina, 7 Assistant'}};
const DECK_PROPS={title:{type:'string',description:'Deck title'},theme:{type:'string',enum:THEMES,description:'Visual style. Call paleta_list_styles to show the user the options and their names.'},anim:{type:'string',enum:MOTIFS,description:'Cartoon animation drawn on the slides in presentation mode, by topic'},palette:{type:'integer',minimum:0,maximum:11,description:'Only for theme "classic"'},font:{type:'integer',minimum:0,maximum:7,description:'Only for theme "classic"'},coverStyle:{type:'integer',minimum:0,maximum:3},slides:{type:'array',minItems:1,maxItems:20,items:SLIDE}};
const UI={ui:{resourceUri:VIEWER},'openai/outputTemplate':VIEWER};
const TOOLS=[
 {name:'paleta_list_styles',title:'Paleta styles',description:'List what Paleta can make: the 95 slide-deck themes (with Hebrew names), design formats and sizes, composition styles, icons and topic animations. Use it when the user wants to choose a style, before creating.',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'paleta_create_deck',title:'Create a slide deck in Paleta',description:'Create a Hebrew (or any language) slide deck in Paleta from slides you write. Paleta lays out each slide in the chosen theme, finds real photos from photo_query, and adds animations. The finished deck plays live in the chat and the user gets a link to open and edit it in Paleta. Write specific, accurate content; short titles; a rich mix of slide styles.',inputSchema:{type:'object',properties:DECK_PROPS,required:['title','slides']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},_meta:UI},
 {name:'paleta_create_design',title:'Create a design in Paleta',description:'Create a single design in Paleta (Instagram post, story, poster, flyer, invitation, YouTube thumbnail, business card and more). Paleta composes a professional layout with animations. It is shown live in the chat with a link to open and edit it in Paleta.',inputSchema:{type:'object',properties:DESIGN_PROPS,required:['format','title']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},_meta:UI},
 {name:'paleta_get',title:'Read a Paleta creation',description:'Read the current content of a deck or design you created earlier (by its id), before changing it.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'paleta_update',title:'Update a Paleta creation',description:'Change a deck or design you created earlier: send its id and the full new content (same fields as when creating). Use it when the user asks for a different style, text, colours, more slides and so on. The live view in the chat and the link both update.',inputSchema:{type:'object',properties:{id:{type:'string'},deck:{type:'object',properties:DECK_PROPS,description:'Full new deck (for decks)'},design:{type:'object',properties:DESIGN_PROPS,description:'Full new design (for designs)'}},required:['id']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},_meta:UI}];
const INSTRUCTIONS=`Paleta (פלטה) is a free Hebrew design app, like Canva. With these tools you design for the user inside Paleta.
- Talk with the user about the style first when it is unclear: offer 3-4 fitting deck themes or design styles by their Hebrew names (paleta_list_styles), the format, colours and tone.
- Then create with paleta_create_deck or paleta_create_design. Write the content yourself, in the user's language (Hebrew by default), accurate and specific; photo_query always in English.
- The result plays live in the chat. Give the user the "open in Paleta" link so they can edit, present, download or share.
- For changes, use paleta_update with the same id and the full new content.`;
const vid=()=>crypto.randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g,'x');
async function load(id){if(!/^[A-Za-z0-9_-]{8,20}$/.test(id))return null;const {blobs}=await list({prefix:`mcp/${id}.json`,limit:1});if(!blobs.length)return null;const r=await fetch(blobs[0].url+'?t='+Date.now(),{cache:'no-store'});return r.ok?r.json():null}
async function save(id,rec){await put(`mcp/${id}.json`,JSON.stringify(rec),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60})}
const clip=(v,n)=>typeof v==='string'?v.slice(0,n):v;
function cleanDeck(d){d=d&&typeof d==='object'?d:{};const slides=(Array.isArray(d.slides)?d.slides:[]).slice(0,20).map(s=>({...s,title:clip(s&&s.title,140),subtitle:clip(s&&s.subtitle,300)}));if(!slides.length)throw new Error('A deck needs at least one slide');return {title:clip(String(d.title||'מצגת'),80),theme:THEMES.includes(d.theme)?d.theme:'poster',anim:MOTIFS.includes(d.anim)?d.anim:undefined,palette:d.palette,font:d.font,coverStyle:d.coverStyle,slides}}
function cleanDesign(d){d=d&&typeof d==='object'?d:{};if(!String(d.title||'').trim())throw new Error('A design needs a title');return {...d,format:FORMATS.includes(d.format)?d.format:'ig',title:clip(String(d.title),200)}}
function result(id,rec,verb){const url=`${SITE}/?mcp=${id}`,what=rec.kind==='deck'?`מצגת "${rec.spec.title}" (${rec.spec.slides.length} שקפים, סגנון ${(META.themes.find(t=>t.key===rec.spec.theme)||{}).name||rec.spec.theme})`:`עיצוב "${String(rec.spec.title).replace(/\n/g,' ')}" (${(META.formats.find(f=>f.key===rec.spec.format)||{}).name||rec.spec.format})`;
 return {content:[{type:'text',text:`${verb}: ${what}.\nid: ${id}\nOpen and edit in Paleta: ${url}\nIt is playing live in the chat. Share the link with the user.`}],structuredContent:{id,kind:rec.kind,title:rec.spec.title,url,embed:`${url}&embed=1&v=${rec.v}`,v:rec.v}}}
async function callTool(name,a){a=a||{};
 if(name==='paleta_list_styles')return {content:[{type:'text',text:JSON.stringify({deck_themes:META.themes,design_formats:META.formats,design_styles:DESIGN_PROPS.style.enum,topic_animations:META.motifs,icons:META.icons})}],structuredContent:{deck_themes:META.themes,design_formats:META.formats,design_styles:DESIGN_PROPS.style.enum,topic_animations:META.motifs}};
 if(name==='paleta_create_deck'){const id=vid(),rec={kind:'deck',spec:cleanDeck(a),v:1,at:Date.now()};await save(id,rec);return result(id,rec,'Created')}
 if(name==='paleta_create_design'){const id=vid(),rec={kind:'design',spec:cleanDesign(a),v:1,at:Date.now()};await save(id,rec);return result(id,rec,'Created')}
 if(name==='paleta_get'){const rec=await load(String(a.id||''));if(!rec)return {isError:true,content:[{type:'text',text:'Not found. Check the id.'}]};return {content:[{type:'text',text:JSON.stringify({id:a.id,kind:rec.kind,spec:rec.spec})}],structuredContent:{id:a.id,kind:rec.kind,spec:rec.spec}}}
 if(name==='paleta_update'){const id=String(a.id||'');const rec=await load(id);if(!rec)return {isError:true,content:[{type:'text',text:'Not found. Check the id.'}]};
  if(rec.kind==='deck'){if(!a.deck)return {isError:true,content:[{type:'text',text:'This id is a deck: send the full new content in "deck".'}]};rec.spec=cleanDeck(a.deck)}else{if(!a.design)return {isError:true,content:[{type:'text',text:'This id is a design: send the full new content in "design".'}]};rec.spec=cleanDesign(a.design)}
  rec.v=(rec.v||1)+1;rec.at=Date.now();await save(id,rec);return result(id,rec,'Updated')}
 throw Object.assign(new Error('Unknown tool: '+name),{code:-32602})}
const VIEW_HTML=`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;background:#111318;font:14px system-ui,sans-serif;color:#fff}#f{display:block;width:100%;aspect-ratio:16/10;border:0;background:#111318}
.bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#181B22}.bar b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar a,.bar button{background:#4C74FF;color:#fff;text-decoration:none;border:0;border-radius:9px;padding:7px 12px;font:600 13px system-ui;cursor:pointer}
#w{padding:40px 16px;text-align:center;color:#9aa0ae}</style></head><body>
<div class="bar"><span>🎨</span><b id="t">פלטה</b><button id="o" hidden>פתיחה בפלטה</button></div><div id="w">פלטה מעצבת…</div><iframe id="f" hidden allow="fullscreen" title="Paleta"></iframe>
<script>
let rid=0,url='';const send=(m,p)=>{const id=++rid;parent.postMessage({jsonrpc:'2.0',id,method:m,params:p||{}},'*');return id};
function show(sc){if(!sc||!sc.embed)return;url=sc.url;document.getElementById('t').textContent=sc.title||'פלטה';const f=document.getElementById('f');if(f.dataset.src!==sc.embed){f.dataset.src=sc.embed;f.src=sc.embed}f.hidden=false;document.getElementById('w').hidden=true;document.getElementById('o').hidden=false}
document.getElementById('o').onclick=()=>{send('ui/open-link',{url});try{window.open(url,'_blank')}catch(e){}};
addEventListener('message',e=>{const d=e.data;if(!d||d.jsonrpc!=='2.0')return;
 if(d.method==='ui/notifications/tool-result'){const r=d.params||{};show(r.structuredContent||(r.result&&r.result.structuredContent))}
 else if(d.method==='ui/notifications/tool-input'){document.getElementById('w').textContent='פלטה מעצבת…'}
 else if(d.id&&d.result&&d.result.hostContext&&d.result.hostContext.toolResult){show(d.result.hostContext.toolResult.structuredContent)}});
send('ui/initialize',{appInfo:{name:'paleta-viewer',version:'1.0.0'},appCapabilities:{},protocolVersion:'2025-11-21'});setTimeout(()=>parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*'),300);
try{const o=window.openai;if(o&&o.toolOutput)show(o.toolOutput)}catch(e){}
<\/script></body></html>`;
const RES={uri:VIEWER,name:'Paleta viewer',description:'Plays the Paleta deck or design in the chat',mimeType:'text/html;profile=mcp-app'};
const RES_META={ui:{prefersBorder:true,csp:{frameDomains:[SITE],resourceDomains:[SITE],connectDomains:[SITE]},domain:SITE},'openai/widgetCSP':{connect_domains:[SITE],resource_domains:[SITE],frame_domains:[SITE]}};
async function rpc(m){const {id,method,params}=m||{};const ok=r=>({jsonrpc:'2.0',id,result:r}),err=(c,msg)=>({jsonrpc:'2.0',id,error:{code:c,message:msg}});
 try{if(method==='initialize'){const pv=params&&params.protocolVersion;return ok({protocolVersion:PROTOS.includes(pv)?pv:PROTOS[1],capabilities:{tools:{listChanged:false},resources:{listChanged:false}},serverInfo:{name:'paleta',title:'Paleta · פלטה',version:'1.0.0',websiteUrl:SITE,icons:[{src:SITE+'/logo.png',mimeType:'image/png'}]},instructions:INSTRUCTIONS})}
  if(method==='ping')return ok({});
  if(method==='tools/list')return ok({tools:TOOLS});
  if(method==='tools/call'){try{return ok(await callTool(params&&params.name,params&&params.arguments))}catch(e){if(e.code===-32602)return err(-32602,e.message);return ok({isError:true,content:[{type:'text',text:String(e.message||e)}]})}}
  if(method==='resources/list')return ok({resources:[RES]});
  if(method==='resources/templates/list')return ok({resourceTemplates:[]});
  if(method==='prompts/list')return ok({prompts:[]});
  if(method==='resources/read'){if(params&&params.uri===VIEWER)return ok({contents:[{uri:VIEWER,mimeType:RES.mimeType,text:VIEW_HTML,_meta:RES_META}]});return err(-32002,'Resource not found')}
  return err(-32601,'Method not found: '+method)}catch(e){return err(-32603,String(e.message||e))}}
export default async function handler(req,res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS, DELETE');res.setHeader('Access-Control-Expose-Headers','Mcp-Session-Id');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method==='GET'&&req.query&&req.query.get){res.setHeader('Cache-Control','no-store');const rec=await load(String(req.query.get)).catch(()=>null);return rec?res.status(200).json({kind:rec.kind,spec:rec.spec,v:rec.v}):res.status(404).json({error:'not found'})}
 if(req.method==='GET'){res.setHeader('Allow','POST');return res.status(405).json({error:'Paleta MCP server: connect it in Claude as a custom connector with this URL.'})}
 if(req.method==='DELETE')return res.status(405).end();
 if(req.method!=='POST')return res.status(405).end();
 let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){return res.status(400).json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})}}
 const batch=Array.isArray(b),msgs=batch?b:[b];const out=[];for(const m of msgs){if(m&&m.method&&m.id===undefined)continue;if(m&&m.method)out.push(await rpc(m))}
 if(!out.length)return res.status(202).end();res.setHeader('Content-Type','application/json');return res.status(200).send(JSON.stringify(batch?out:out[0]))}
