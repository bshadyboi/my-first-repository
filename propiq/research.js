(function(){"use strict";
const api=window.PropIQRuntime;if(!api)return;
const st=api.state,$=id=>document.getElementById(id);
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const round=v=>Number.isFinite(v)?String(Math.round(v*10)/10):"—";
const research={window:10,split:"all",season:"all",details:new Map(),loading:new Set(),gameIndex:null};
const me=(p)=>String(p?.player||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")+"|"+p.stat;
function opponent(p){const k=me(p),d=research.details.get(k);if(d?.nextGame?.opponentAbbr)return d.nextGame.opponentAbbr;
const parts=String(p.matchup||"").split(" @ ").map(x=>x.trim().toUpperCase()),team=String(p.team||"").toUpperCase();
return parts.length===2&&team?(parts[0]===team?parts[1]:parts[1]===team?parts[0]:null):null}
function stats(g,s){if(!g)return null;switch(s){case"PTS":return g.pts;case"REB":return g.reb;case"AST":return g.ast;case"3PM":return g.threes;
case"PRA":return [g.pts,g.reb,g.ast].every(Number.isFinite)?g.pts+g.reb+g.ast:null;
case"PR":return [g.pts,g.reb].every(Number.isFinite)?g.pts+g.reb:null;
case"PA":return [g.pts,g.ast].every(Number.isFinite)?g.pts+g.ast:null;
case"RA":return [g.reb,g.ast].every(Number.isFinite)?g.reb+g.ast:null;
case"STL":return g.stl;case"BLK":return g.blk;case"TO":return g.to;case"FTM":return g.ftm;default:return null}}
function avg(rows){let vals=rows.map(x=>x.value).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
function calc(rows,side,line){let hits=rows.filter(x=>x.value!==line&&(side==="over"?x.value>line:x.value<line)).length,nonPush=rows.filter(x=>x.value!==line).length,push=rows.length-nonPush;return {hits,nonPush,push,pct:nonPush?Math.round(hits/nonPush*100):null}}
function ensureDOM(){const page=$("screen-player"),line=page?.querySelector(".line-card");if(!line||$("researchLab"))return;
const lab=document.createElement("section");lab.id="researchLab";lab.className="research-lab";lab.innerHTML='<div class="rl-title"><div><span class="rl-eyebrow">PROPIQ · DEEP RESEARCH</span><h3>Performance Lab <span class="rl-live">● ESPN game logs</span></h3></div><span class="rl-source" id="rlDataQuality">Loading…</span></div><div class="rl-control"><div class="rl-label">Game window</div><div class="rl-chips" id="rlWindows"><button data-rl-window="3">L3</button><button data-rl-window="5">L5</button><button data-rl-window="10">L10</button><button data-rl-window="20">L20</button></div></div><div class="rl-control"><div class="rl-label">Split</div><div class="rl-chips" id="rlSplits"><button data-rl-split="all">All games</button><button data-rl-split="home">Home</button><button data-rl-split="away">Away</button><button data-rl-split="opponent" id="rlOpponentButton">vs opponent</button></div></div><div class="rl-seasonbar"><span id="rlOpponentTitle">Based on verified game history</span><select id="rlSeason" aria-label="Research season"><option value="all">All available seasons</option></select></div><div class="rl-metrics" id="rlMetrics"><div class="placeholder">Loading research…</div></div><div class="rl-chartcard"><div class="rl-chartheading"><strong id="rlChartTitle">Last 10 games</strong><small id="rlLineLegend">Higher/Lower at selected threshold</small></div><div class="rl-chart" id="rlChart"></div><div class="rl-bar-note" id="rlBarNote">Select a bar to inspect an actual game.</div></div><div class="rl-minute" id="rlMinutes"></div><p class="rl-foot" id="rlFoot"></p>';
line.after(lab);
}
function requestOpponent(p){if(!p?.slug||!api.statSlugs[p.stat])return;const k=me(p);if(research.details.has(k)||research.loading.has(k))return;research.loading.add(k);
fetch("/api/insight?slug="+encodeURIComponent(p.slug)+"&stat="+encodeURIComponent(api.statSlugs[p.stat])).then(async r=>r.ok?await r.json():null).then(d=>{research.details.set(k,d);if(st.current&&me(st.current)===k)render()}).catch(()=>{research.details.set(k,null)}).finally(()=>research.loading.delete(k))}
function render(){const p=st.current;if(!p||st.page!=="player")return;ensureDOM();if(!$("researchLab"))return;
requestOpponent(p);const games=(p.logs||[]),opp=opponent(p),fallback=!games.length&&p.fallbackStat===p.stat&&Array.isArray(p.fallback)?p.fallback.filter(Number.isFinite):[];
const seasonSelect=$("rlSeason"),years=[...new Set(games.map(g=>g.season).filter(Number.isFinite))].sort((a,b)=>b-a);
const selected=research.season;if(selected!=="all"&&!years.some(y=>String(y)===selected))research.season="all";
seasonSelect.innerHTML='<option value="all">All available seasons</option>'+years.map(y=>'<option value="'+y+'">'+(y-1)+'–'+String(y).slice(-2)+' regular season</option>').join("");
seasonSelect.value=research.season;
$("rlWindows").querySelectorAll("button").forEach(b=>b.classList.toggle("active",Number(b.dataset.rlWindow)===research.window));
$("rlSplits").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.rlSplit===research.split));
const oppBtn=$("rlOpponentButton");oppBtn.textContent=opp?"vs "+opp:"vs opponent";oppBtn.disabled=!opp;if(!opp&&research.split==="opponent")research.split="all";
$("rlOpponentTitle").textContent=opp?"Upcoming opponent: "+opp+" · historical matchup available":research.loading.has(me(p))?"Checking next opponent…":"Upcoming opponent not verified";
const all=games.length?games.map(g=>({...g,value:stats(g,p.stat)})).filter(g=>Number.isFinite(g.value)):fallback.map((v,i)=>({id:"fallback-"+i,date:null,opp:null,season:null,min:null,homeAway:null,value:v}));
const inSeason=research.season==="all"?all:all.filter(g=>String(g.season)===research.season);
let eligible=inSeason.filter(g=>research.split==="all"||research.split==="opponent"&&g.opp===opp||g.homeAway===research.split);
let sample=eligible.slice(0,research.window),hit=calc(sample,p.side,p.line),mean=avg(sample);
const countAll=inSeason.length,countSplit=eligible.length,labeled=games.filter(g=>g.homeAway==="home"||g.homeAway==="away").length;
const seasonMixed=new Set(sample.map(g=>g.season)).size>1;
$("rlDataQuality").textContent=games.length?all.length+" stat games":fallback.length?fallback.length+" source observations":"Awaiting verified logs";
$("rlMetrics").innerHTML='<div class="rl-stat"><strong>'+ (hit.pct===null?"—":hit.pct+"%")+'</strong><small>Hit rate · '+hit.hits+'/'+hit.nonPush+' non-push games</small></div><div class="rl-stat"><strong>'+round(mean)+'</strong><small>'+escape(p.stat)+' average · '+sample.length+' games</small></div><div class="rl-stat"><strong>'+(mean===null?"—":(mean-p.line>0?"+":"")+round(mean-p.line))+'</strong><small>Average minus line · '+round(p.line)+'</small></div><div class="rl-stat"><strong>'+hit.push+'</strong><small>Pushes · excluded from rate</small></div>';
const max=Math.max(1,p.line,...sample.map(g=>g.value))*1.14;
const lineY=Math.min(99,Math.max(0,p.line/max*100));
$("rlChartTitle").textContent="Last "+sample.length+" eligible game"+(sample.length===1?"":"s")+(research.split==="all"?"":" · "+research.split);
$("rlLineLegend").textContent=(p.side==="over"?"Higher":"Lower")+" "+round(p.line)+" "+p.stat;
if(sample.length){$("rlChart").innerHTML='<div class="rl-bars" style="min-width:'+Math.max(100,sample.length*36)+'px"><div class="rl-threshold" style="bottom:'+lineY+'%"><span>Line '+round(p.line)+'</span></div>'+sample.map((g,i)=>{const hit=g.value!==p.line&&(p.side==="over"?g.value>p.line:g.value<p.line);let d=new Date(g.date);const label=!g.date||Number.isNaN(+d)?"G"+(i+1):d.toLocaleDateString([],{month:"numeric",day:"numeric"});return '<button class="rl-bar" data-rl-game="'+i+'" title="'+escape(g.opp)+" · "+escape(label)+'"><b>'+round(g.value)+'</b><i class="'+(g.value===p.line?"push":hit?"hit":"miss")+'" style="height:'+Math.max(3,Math.round(g.value/max*125))+'px"></i><small>'+escape(label)+'</small></button>'}).join("")+'</div>'; research.gameIndex=sample;}
else{$("rlChart").innerHTML='<div class="rl-empty">No verified games match this combination of season and split.</div>';research.gameIndex=[]}
$("rlBarNote").textContent=sample.length?"Tap any bar to see the date, opponent, venue and minutes.":"Choose All games or another season to expand the sample.";
const min5=eligible.slice(0,5).map(g=>g.min).filter(Number.isFinite),min10=eligible.slice(0,10).map(g=>g.min).filter(Number.isFinite);
const avgMin5=min5.length?min5.reduce((a,b)=>a+b,0)/min5.length:null,avgMin10=min10.length?min10.reduce((a,b)=>a+b,0)/min10.length:null;
const prev5=eligible.slice(5,10).map(g=>g.min).filter(Number.isFinite);const avgPrev=prev5.length>=3?prev5.reduce((a,b)=>a+b,0)/prev5.length:null;const deltaMinutes=avgPrev!==null&&avgMin5!==null&&min5.length>=3?avgMin5-avgPrev:null;
$("rlMinutes").innerHTML='<div><span class="rl-eyebrow">PLAYING TIME</span><h4>Minutes trend</h4></div><div class="rl-min-stats"><span><strong>'+round(avgMin5)+'</strong><small>L5 eligible min</small></span><span><strong>'+round(avgMin10)+'</strong><small>L10 eligible min</small></span><span><strong>'+(deltaMinutes===null?'—':(deltaMinutes>=0?'+':'')+round(deltaMinutes))+'</strong><small>Δ vs prior 5 minutes</small></span></div>';
let notes='Source: ESPN regular-season game logs. '+countSplit+' eligible games in '+research.split+' split, '+sample.length+' shown; '+countAll+' games with this stat in the season scope. ';
if(!games.length)notes=fallback.length?"Limited Stat Pick game-log values only; venue, dates and minutes are not supplied for this source. ":"Loading verified game data… ";
if(research.split!=="all"&&sample.length<5)notes+='Small split sample — treat percentages cautiously. ';
if((research.split==="home"||research.split==="away")&&labeled<games.length)notes+='Venue labels missing for '+(games.length-labeled)+' games, which are excluded. ';
if(seasonMixed)notes+='Sample spans multiple seasons. ';
notes+='This describes past performance, not the chance of the next result. When available, home/away labels are taken from ESPN, not inferred.';
$("rlFoot").textContent=notes;
}
function focusBar(i){const g=research.gameIndex?.[i],p=st.current;if(!g||!p)return;const date=new Date(g.date),day=!g.date||Number.isNaN(+date)?"Unknown date":date.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"}),place=g.homeAway==="home"?"Home":g.homeAway==="away"?"Away":"Venue unavailable";$("rlBarNote").textContent=day+" · "+place+" vs "+(g.opp||"opponent")+" · "+round(g.value)+" "+p.stat+" · "+round(g.min)+" minutes";}
document.addEventListener("click",e=>{const w=e.target.closest("[data-rl-window]");if(w){research.window=Number(w.dataset.rlWindow);render();return}const split=e.target.closest("[data-rl-split]");if(split){if(split.disabled)return;research.split=split.dataset.rlSplit;render();return}const bar=e.target.closest("[data-rl-game]");if(bar){focusBar(Number(bar.dataset.rlGame));return}});
document.addEventListener("change",e=>{if(e.target.id==="rlSeason"){research.season=e.target.value;render()}});
window.addEventListener("propiq:player",render);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{ensureDOM();render()});else{ensureDOM();render()}
})();