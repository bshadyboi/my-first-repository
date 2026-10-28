(function(){"use strict";
const A=window.PropIQRuntime,S=A?.state,C=window.PropIQCalendar;if(!A||!C)return;
const $=id=>document.getElementById(id), esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const defaults={win:10,minRate:0,minGames:0,side:"any",margin:0,venue:"all",matchup:"all",minMinutes:0,stable:false,book:"all",gradeOnly:false,movers:false,sort:"default",preset:"all"};
const presetDefs={
 hot:{name:"🔥 Hot trends",win:10,minRate:80,minGames:10,sort:"grade"},
 tomorrowHot:{name:"🌙 Tomorrow + Hot",win:10,minRate:80,minGames:10,sort:"grade"},
 consistent:{name:"🛡️ Consistent",win:10,minRate:70,minGames:10,stable:true,sort:"grade"},
 matchup:{name:"⚔️ Matchup edge",win:10,minRate:60,minGames:8,matchup:"favorable",sort:"grade"},
 unders:{name:"↘️ Unders",win:10,minRate:70,minGames:8,side:"under",sort:"grade"},
 tomorrow:{name:"🌙 Early lines",win:10,minRate:0,minGames:0,sort:"default"},
 movers:{name:"📈 Line moves",win:10,minRate:0,minGames:0,movers:true,sort:"movement"}
};
let cfg={...defaults},saved=[],changes={},lastProviderAsOf=null,matchupMap=null,dvp=null,matchupLoading=false,venueLoading=false,rendering=false;
let marketIndex=new Map(),marketIndexStamp="",lastRows=[],filterProgress=0;
const lc=(k,def)=>{try{const x=JSON.parse(localStorage.getItem(k));return x===null?def:x}catch{return def}};
const put=(k,obj)=>{try{localStorage.setItem(k,JSON.stringify(obj))}catch{}};
cfg={...defaults,...lc("propiq-smart-config-v1",{})};saved=lc("propiq-smart-presets-v1",[]);if(!Array.isArray(saved))saved=[];
changes=lc("propiq-line-watch-v1",{});if(!changes||typeof changes!=="object"||Array.isArray(changes))changes={};
function resetFlags(){filterProgress=0}
function lineId(p,b){return [C.dateOf(p.startTime)||"unknown",norm(p.player),p.stat,p.period||"FULL",String(b.book||"")].join("|")}
function snapshotLine(b){if(b.mainLineVerified&&Number.isFinite(b.line))return b.line;if(b.dfs&&b.lines?.length===1&&Number.isFinite(b.lines[0].line))return b.lines[0].line;return null}
function capture(groups,asOf){if(!Array.isArray(groups)||!groups.length)return;let t=Date.parse(asOf)||Date.now();if(t<0||t>Date.now()+86400000)t=Date.now();const maxAge=14*86400000;let pruned=0;for(const [k,h] of Object.entries(changes)){if(!h||typeof h.lastSeen!=="number"||Date.now()-h.lastSeen>maxAge){delete changes[k];pruned++}}
let observed=0,changed=0;for(const p of groups){if(!p.startTime||!p.player||!p.stat||!["FULL","1H"].includes(p.period))continue;
for(const b of p.books||[]){const line=snapshotLine(b);if(!Number.isFinite(line))continue;
const id=lineId(p,b),prev=changes[id];if(!prev){changes[id]={player:p.player,stat:p.stat,period:p.period,book:b.label||b.book,provider:b.book,gameDate:C.dateOf(p.startTime),startTime:p.startTime,first:line,firstSeen:t,last:line,lastSeen:t,moves:[]};observed++;continue}
if(t<prev.lastSeen)continue;if(t===prev.lastSeen&&prev.last===line)continue;
if(Math.abs(prev.last-line)>.001){prev.moves=Array.isArray(prev.moves)?prev.moves:[];prev.moves.push({from:prev.last,to:line,at:t});prev.moves=prev.moves.slice(-8);prev.last=line;changed++}prev.lastSeen=t;
}}
let all=Object.entries(changes);if(all.length>2700){all.sort((a,b)=>b[1].lastSeen-a[1].lastSeen);changes=Object.fromEntries(all.slice(0,2500))}
lastProviderAsOf=asOf||null;put("propiq-line-watch-v1",changes);
if(changed){window.dispatchEvent(new Event("propiq:lines"))}
}
window.PropIQSmartCapture=capture;
function bookIndex(){const stamp=(S.booksSnapshot||"")+":"+(S.books?.length||0);if(stamp===marketIndexStamp)return;marketIndexStamp=stamp;marketIndex=new Map();
for(const g of S.books||[]){if(g.period!=="FULL")continue;const k=[C.dateOf(g.startTime),norm(g.player),g.stat].join("|");let items=marketIndex.get(k);if(!items){items=[];marketIndex.set(k,items)}items.push(g)}}
function booksFor(p){bookIndex();return marketIndex.get([C.dateOf(p.startTime),norm(p.player),p.stat].join("|"))||[]}
function exactBook(p,book){if(book==="all")return true;return booksFor(p).some(g=>(g.books||[]).some(b=>b.book===book&&(b.lines||[]).some(q=>Math.abs(q.line-p.line)<.001)))}
function movement(p){const book=String(p.marketBook||"");if(!book)return null;const results=[];for(const g of booksFor(p)){for(const b of g.books||[]){if(b.label!==book)continue;const h=changes[lineId(g,b)];if(h&&Math.abs(h.last-p.line)<.001)results.push(h)}}return results.sort((a,b)=>b.lastSeen-a.lastSeen)[0]||null}
function allMoves(offset=S.dayOffset){const day=C.targetDay(offset);return Object.values(changes).filter(h=>h.gameDate===day&&Array.isArray(h.moves)&&h.moves.length&&Number.isFinite(h.last)&&Number.isFinite(h.first)).sort((a,b)=>b.moves[b.moves.length-1].at-a.moves[a.moves.length-1].at)}
function snapshotSummary(){const d=C.targetDay();return Object.values(changes).filter(h=>h.gameDate===d).length}
function gameValue(g,stat){return A.statsForValues(g,stat)}
function games(p){const logs=S.playerLogs?.get(norm(p.player));if(logs?.length){return logs.map(g=>({value:gameValue(g,p.stat),min:g.min,homeAway:g.homeAway,opp:g.opp,date:g.date})).filter(g=>Number.isFinite(g.value))}
const v=S.detail?.get(A.key(p));return Array.isArray(v)?v.filter(Number.isFinite).map(x=>({value:x,min:null,homeAway:null,opp:null,date:null})):[]}
function splitGames(p){let rows=games(p);if(cfg.venue!=="all")rows=rows.filter(x=>x.homeAway===cfg.venue);return rows}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function frame(rows,line,side){const raw=rows.filter(r=>Number.isFinite(r.value));const hits=raw.filter(g=>g.value!==line&&(side==="over"?g.value>line:g.value<line)).length;const nonpush=raw.filter(g=>g.value!==line).length;return {hits,n:nonpush,valid:raw.length,pct:nonpush?Math.round(hits/nonpush*100):null,avg:mean(raw.map(g=>g.value)),pushes:raw.length-nonpush}}
function chooseSide(p,rows){if(cfg.side==="over"||cfg.side==="under")return cfg.side;const r=rows.slice(0,Math.min(10,rows.length));const over=frame(r,p.line,"over"),under=frame(r,p.line,"under");return (over.pct??-1)>=(under.pct??-1)?"over":"under"}
function stats(p){const rows=splitGames(p),sample=rows.slice(0,cfg.win),side=chooseSide(p,rows),windowStats=frame(sample,p.line,side),all=rows,f5=frame(all.slice(0,5),p.line,side),f10=frame(all.slice(0,10),p.line,side),f20=frame(all.slice(0,20),p.line,side);
const windowVals=sample.map(x=>x.value),avg=mean(windowVals),margin=avg===null?null:(side==="over"?avg-p.line:p.line-avg),marginPct=margin===null?null:100*margin/Math.max(1,Math.abs(p.line));
const minutes=sample.map(x=>x.min).filter(Number.isFinite),avgMinutes=mean(minutes),varSum=avgMinutes?minutes.reduce((s,x)=>s+(x-avgMinutes)**2,0)/minutes.length:null,minuteCV=varSum!==null&&avgMinutes>0?Math.sqrt(varSum)/avgMinutes:null;
return {side,rows,sample,windowStats,f5,f10,f20,avg,margin,marginPct,avgMinutes,minuteCV,minutesN:minutes.length}}
function grade(p,sideOverride){const copy=sideOverride?{...cfg,side:sideOverride}:null;if(copy){}const original=cfg.side;if(sideOverride)cfg.side=sideOverride;const m=stats(p);if(sideOverride)cfg.side=original;
const {side,f5,f10,f20,margin,avg,minuteCV,minutesN}=m;
if(f10.n<10)return {grade:"—",score:null,reason:"Needs 10 valid L10 games (currently "+f10.n+")",side,provisional:true,metrics:m};
let components=[{name:"L10 clears",score:f10.pct,weight:42},{name:"L5 clears",score:f5.pct??0,weight:15}];
if(f20.n>=15)components.push({name:"L20 clears",score:f20.pct,weight:18});
const raw=m.rows.slice(0,10).map(g=>g.value),a=mean(raw),stdev=a===null?null:Math.sqrt(mean(raw.map(n=>(n-a)**2)));
if(margin!==null){const relative=margin/Math.max(1,stdev||1);components.push({name:"Average vs line",score:clamp(50+relative*25,0,100),weight:15})}
if(minuteCV!==null&&minutesN>=7)components.push({name:"Minutes consistency",score:clamp(100-minuteCV*320,0,100),weight:10});
const total=components.reduce((n,x)=>n+x.weight,0),score=total?Math.round(components.reduce((n,x)=>n+x.score*x.weight,0)/total):null;
const robust=f20.n>=15&&minutesN>=7;const capped=score===null?null:robust?score:Math.min(79,score);
const letter=capped===null?"—":capped>=85?"A":capped>=70?"B":capped>=55?"C":"D";
return {grade:letter,score:capped,reason:components.map(x=>x.name+": "+Math.round(x.score)+"/100").join(" · ")+(robust?"":" · Limited: missing L20/minutes depth; max B"),side,provisional:!robust,metrics:m}}
let dvpMeta=new Map(),dvpRequested=new Set();
function matchupInfo(p){const d=dvpMeta.get(norm(p.player)),position=d?.player?.position||"",group=position==="PG"||position==="SG"||position==="G"?"G":position==="SF"||position==="PF"||position==="F"?"F":position==="C"?"C":null;
const expected=C.dateOf(p.startTime),str=d?.nextGame?.dateAndTime||d?.nextGame?.date,provided=/^\d{4}-\d{2}-\d{2}$/.test(String(str))?String(str):str?C.dateOf(str):null,opp=provided&&expected===provided?d?.nextGame?.opponentAbbr:null;
const result=dvp?.get(opp)?.[group]?.[p.stat];
return result&&Number.isFinite(result.rank)?{rank:result.rank,ratio:result.ratio,opp,position,source:"PropLab defense-versus-position"}:null}
function isFavorable(p,side){const m=matchupInfo(p);return !!m&&(side==="over"?m.rank>=21:m.rank<=10)}
async function initMatchups(){if(matchupLoading)return;matchupLoading=true;try{const data=await A.fetchJSON("/api/dvp");if(Array.isArray(data.teams))dvp=new Map(data.teams.map(x=>[x.team,x]));const rows=C.filter(S.market).filter(p=>["PTS","REB","AST"].includes(p.stat));const names=new Map();for(const p of rows)if(p.slug&&!dvpMeta.has(norm(p.player)))names.set(norm(p.player),p);const todo=[...names.values()].slice(0,75);let i=0;async function worker(){while(i<todo.length&&cfg.matchup==="favorable"){const p=todo[i++],name=norm(p.player);if(dvpRequested.has(name))continue;dvpRequested.add(name);try{const d=await A.fetchJSON("/api/insight?slug="+encodeURIComponent(p.slug)+"&stat="+encodeURIComponent(A.statSlugs[p.stat]));dvpMeta.set(name,d)}catch{}if(i%6===0)refreshMarket()}}
await Promise.all(Array.from({length:Math.min(4,todo.length)},worker));}catch{}finally{matchupLoading=false;refreshMarket()}}
async function initVenues(){if(venueLoading)return;venueLoading=true;try{const ids=S.playerIDs||new Map();const needed=[...ids.entries()].filter(([k,id])=>{const g=S.playerLogs.get(k);return g?.length&&!g.some(x=>x.homeAway)}).slice(0,75);let i=0;async function work(){while(i<needed.length&&cfg.venue!=="all"){const [key,id]=needed[i++];try{const r=await A.fetchJSON("/api/splits?id="+encodeURIComponent(id)),map=new Map((r.rows||[]).map(x=>[String(x.id),x.homeAway]));for(const g of S.playerLogs.get(key)||[])g.homeAway=map.get(String(g.id))||null}catch{}if(i%8===0)refreshMarket()}}
await Promise.all(Array.from({length:Math.min(4,needed.length)},work))}finally{venueLoading=false;refreshMarket()}}
function filter(rows){let output=[],analyzed=0,notAnalyzed=0;for(const p of rows){if(!exactBook(p,cfg.book))continue;const g=grade(p),m=g.metrics,r=m.windowStats;
if(m.rows.length)analyzed++;else notAnalyzed++;
if(cfg.movers){const h=movement(p);if(!h?.moves?.length)continue}
if(cfg.minRate>0&&(r.n<Math.max(5,cfg.minGames)||r.pct===null||r.pct<cfg.minRate))continue;
if(cfg.minGames>0&&r.n<cfg.minGames)continue;
if(cfg.side!=="any"&&m.side!==cfg.side)continue;
if(cfg.margin>0&&(m.marginPct===null||m.marginPct<cfg.margin))continue;
if(cfg.venue!=="all"&&!m.rows.length)continue;
if(cfg.minMinutes>0&&(m.avgMinutes===null||m.avgMinutes<cfg.minMinutes))continue;
if(cfg.stable&&(m.minuteCV===null||m.minutesN<5||m.minuteCV>.18))continue;
if(cfg.matchup==="favorable"&&!isFavorable(p,m.side))continue;
if(cfg.gradeOnly&&g.score===null)continue;
output.push(p)}
lastRows=output;
const label=$("smartCount");if(label)label.textContent=output.length+" matching · "+analyzed+" with available form"+(cfg.matchup==="favorable"&&(matchupLoading||!dvp)?" · evaluating position defenses":"")+(cfg.venue!=="all"&&venueLoading?" · loading venue splits":"");
return output}
function sortMode(){return cfg.sort}
function trendTag(p){const g=grade(p),m=g.metrics;return g.score===null?'':"Research "+g.grade+" ("+g.score+"/100), historical only. "+g.reason}
function badge(p){const g=grade(p);if(g.score===null)return g.metrics.windowStats.valid?'<span class="smart-grade muted" title="'+esc(g.reason)+'">Limited sample</span>':"";
return '<span class="smart-grade grade-'+g.grade.toLowerCase()+'" title="'+esc(trendTag(p))+'">Grade '+g.grade+' <small>'+g.score+'</small></span>'}
function movementBadge(p){const h=movement(p);if(!h)return '';const n=h.last-h.first,previous=h.moves?.length||0;
return '<span class="smart-move '+(n>0?"up":n<0?"down":"flat")+'" title="'+esc("First observed "+new Date(h.firstSeen).toLocaleString()+" · "+h.book+" · "+h.first+" → "+h.last)+'">'+(previous?(n>0?"↑ ":n<0?"↓ ":"→ ")+(n>0?"+":"")+Math.round(n*10)/10:"Tracking")+'</span>'}
function sort(rows){if(cfg.sort==="movement")rows.sort((a,b)=>Math.abs((movement(b)?.last||0)-(movement(b)?.first||0))-Math.abs((movement(a)?.last||0)-(movement(a)?.first||0)));return rows}
function persist(){put("propiq-smart-config-v1",cfg)}
function setConfig(k,v){cfg={...cfg,[k]:v,preset:"custom"};persist();if(k==="venue"&&v!=="all")initVenues();if(k==="matchup"&&v==="favorable")initMatchups();refreshMarket()}
function applyPreset(id){let p=presetDefs[id];if(!p)return;cfg={...defaults,...p,preset:id};persist();if(id==="tomorrow"||id==="tomorrowHot")C.setDay(1);if(cfg.matchup==="favorable")initMatchups();refreshMarket();if(S.page!=="market")A.nav("market")}
function setSaved(s){cfg={...defaults,...s.config,preset:"custom"};persist();if(cfg.matchup==="favorable")initMatchups();if(cfg.venue!=="all")initVenues();refreshMarket()}
function clear(){cfg={...defaults};persist();refreshMarket()}
function savedItems(){return '<div class="smart-save-row"><input id="smartSaveName" maxlength="45" type="text" placeholder="Name this filter…" aria-label="Saved filter name"/><button data-smart-save>Save view</button></div>'+(saved.length?'<div class="smart-saved-list">'+saved.map(s=>'<button data-smart-load="'+esc(s.id)+'">'+esc(s.name)+'</button>').join("")+'</div><button class="smart-delete" data-smart-delete>Delete saved view</button>':'<p class="smart-help">Save a filter to reuse it every night.</p>')}
function optionList(arr,v){return arr.map(([key,label])=>'<option value="'+esc(key)+'"'+(String(key)===String(v)?' selected':'')+'>'+esc(label)+'</option>').join("")}
function control(k,label,options){return '<label class="smart-field"><span>'+label+'</span><select data-smart-field="'+k+'">'+optionList(options,cfg[k])+'</select></label>'}
function drawer(){return '<div class="smart-drawer" id="smartDrawer" hidden><div class="smart-fields">'+
control("win","Recent games",[["3","Last 3"],["5","Last 5"],["10","Last 10"],["20","Last 20"]])+
control("minRate","Minimum hit rate",[["0","Any"],["50","50%+"],["60","60%+"],["70","70%+"],["80","80%+"],["90","90%+"],["100","100%"]])+
control("minGames","Min non-push games",[["0","No minimum"],["3","3 games"],["5","5 games"],["8","8 games"],["10","10 games"],["15","15 games"]])+
control("side","Direction",[["any","Best historical side"],["over","Higher only"],["under","Lower only"]])+
control("margin","Average over/under line",[["0","Any"],["5","5% buffer"],["10","10% buffer"],["20","20% buffer"]])+
control("venue","Venue split",[["all","All games"],["home","Home only"],["away","Away only"]])+
control("matchup","Position matchup",[["all","All matchups"],["favorable","Verified favorable DvP only"]])+
control("minMinutes","Minimum avg minutes",[["0","Any"],["20","20+ minutes"],["25","25+ minutes"],["30","30+ minutes"],["35","35+ minutes"]])+
control("book","Platform (same line)",[["all","All platforms"],...bookOptions()])+
control("sort","Research sort",[["default","Market default"],["grade","Research grade"],["movement","Largest observed line move"]])+
'</div><label class="smart-checkbox"><input type="checkbox" data-smart-checkbox="stable"'+(cfg.stable?" checked":"")+'> Stable minutes (CV ≤ 18%, 5+ samples)</label><label class="smart-checkbox"><input type="checkbox" data-smart-checkbox="gradeOnly"'+(cfg.gradeOnly?" checked":"")+'> Graded props only (10+ valid L10 games)</label><p class="smart-help">Filters require verified data. Missing positions, venues, or minutes never count as favorable. The score ranks past results—not a future hit probability.</p>'+savedItems()+'</div>'}
function bookOptions(){const bookMap=new Map();for(const g of S.books||[])for(const b of g.books||[])if(b.book)bookMap.set(b.book,b.label||b.book);return [...bookMap].sort((a,b)=>a[1].localeCompare(b[1])).map(([a,b])=>[a,b])}
function presets(){return '<div class="smart-presets">'+Object.entries(presetDefs).map(([k,p])=>'<button class="'+(cfg.preset===k?"active":"")+'" data-smart-preset="'+k+'">'+p.name+'</button>').join("")+'</div>'}
function movesCard(){const all=allMoves(),summary=snapshotSummary(),entries=all.slice(0,6);
return '<div class="smart-linewatch"><div class="smart-linewatch-top"><div><span class="smart-eyebrow">LINE WATCH · LOCAL HISTORY</span><strong>'+all.length+' changed lines on this slate</strong></div><span class="smart-line-count">'+summary+' watched</span></div><p class="smart-help">Snapshots saved in this browser when you visit or refresh PropIQ. No older history or background monitoring is implied. Provider-selected near-even sportsbook lines can shift as odds change.</p>'+(entries.length?'<div class="smart-line-list">'+entries.map(h=>'<div class="smart-line-item"><div><strong>'+esc(h.player)+'</strong><small>'+esc(h.book)+' · '+esc(h.stat)+' · '+esc(h.period)+'</small></div><strong class="'+(h.last>h.first?"up":"down")+'">'+h.first+' → '+h.last+'</strong><small>'+new Date(h.moves[h.moves.length-1].at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</small></div>').join("")+'</div>':'<div class="smart-line-empty">No line changes recorded yet. The first snapshot establishes your baseline; revisit or refresh later to detect real changes.</div>')+'</div>'}
function marketUI(){const market=$("screen-market");if(!market)return;let box=$("smartFilters");if(!box){box=document.createElement("div");box.id="smartFilters";box.className="smart-filters";const before=market.querySelector(".market-controls")||$("marketStatus");before?.before(box)}
const isBooks=S.marketMode==="books";
box.hidden=isBooks;
if(isBooks)return;
const open=box.dataset.open==="1";
box.innerHTML='<div class="smart-title"><div><span class="smart-eyebrow">PROPIQ · RESEARCH DISCOVERY</span><h3>Smart Filters <span class="smart-tag">Historical</span></h3></div><button class="smart-open" data-smart-toggle aria-expanded="'+open+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M7 12h10M10 17h4"/></svg> Filters</button></div>'+presets()+'<div class="smart-summary"><span id="smartCount">'+lastRows.length+' matches</span><button data-smart-reset>Clear filters</button></div>'+drawer()+movesCard();
box.dataset.open=open?"1":"0";const drawerEl=$("smartDrawer");if(drawerEl)drawerEl.hidden=!open;
}
function homeUI(){const today=$("screen-today");if(!today)return;let host=$("smartHomePresets");if(!host){host=document.createElement("div");host.id="smartHomePresets";host.className="smart-home";const banner=today.querySelector(".pi-top-cta");if(banner)banner.before(host);else today.prepend(host)}
host.innerHTML='<div class="smart-home-title"><strong>Explore by trend</strong><span>Tap to filter tomorrow or today</span></div>'+presets()}
function refreshMarket(){if(rendering)return;rendering=true;try{marketUI();homeUI();if(S.page==="market"&&S.marketMode==="featured"){A.renderMarket()}}finally{rendering=false}}
function sync(){marketUI();homeUI()}
document.addEventListener("click",e=>{const toggle=e.target.closest("[data-smart-toggle]");if(toggle){const panel=$("smartFilters");panel.dataset.open=panel.dataset.open==="1"?"0":"1";marketUI();return}
const preset=e.target.closest("[data-smart-preset]");if(preset){applyPreset(preset.dataset.smartPreset);return}
if(e.target.closest("[data-smart-reset]")){clear();return}
if(e.target.closest("[data-smart-save]")){const name=$("smartSaveName")?.value.trim();if(!name){$("smartSaveName")?.focus();return}const id="f"+Date.now().toString(36);saved=[{id,name:name.slice(0,45),config:{...cfg}},...saved].slice(0,12);put("propiq-smart-presets-v1",saved);marketUI();return}
const load=e.target.closest("[data-smart-load]");if(load){const s=saved.find(x=>x.id===load.dataset.smartLoad);if(s)setSaved(s);return}
if(e.target.closest("[data-smart-delete]")){const name=$("smartSaveName")?.value.trim();if(!name){const v=saved[0];if(v){saved=saved.slice(1);put("propiq-smart-presets-v1",saved);marketUI()}return}const old=saved.length;saved=saved.filter(x=>x.name!==name);if(saved.length===old)return;put("propiq-smart-presets-v1",saved);marketUI()}});
document.addEventListener("change",e=>{const sel=e.target.closest("[data-smart-field]");if(sel){const k=sel.dataset.smartField,v=["win","minRate","minGames","margin","minMinutes"].includes(k)?Number(sel.value):sel.value;if(k==="minGames"&&v>cfg.win)cfg.win=20;setConfig(k,v);return}const cb=e.target.closest("[data-smart-checkbox]");if(cb)setConfig(cb.dataset.smartCheckbox,cb.checked)});
window.addEventListener("propiq:market",sync);window.addEventListener("propiq:home",homeUI);
window.addEventListener("propiq:day",()=>{resetFlags();refreshMarket()});
window.addEventListener("propiq:logs",()=>{if(cfg.venue!=="all")initVenues();refreshMarket()});
window.addEventListener("propiq:lines",refreshMarket);
window.PropIQSmart={filter,grade,badge,movementBadge,sortMode,sort,refresh:refreshMarket,applyPreset,clear,config:()=>({...cfg}),stats,allMoves,capture};
if(Array.isArray(S.books)&&S.books.length)capture(S.books,S.booksSnapshot);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{sync();refreshMarket()});else{sync();refreshMarket()}
})();