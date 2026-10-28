(function(){"use strict";
const rt=window.PropIQRuntime;if(!rt)return;const state=rt.state,$=id=>document.getElementById(id);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>Number.isFinite(v)?String(Math.round(v*10)/10):"—";
const odds=v=>Number.isFinite(v)?(v>0?"+":"")+v:"—";
const norm=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const stateCompare={id:null,line:null,side:"over",groups:null,ref:null};
function ageText(s){if(!Number.isFinite(s))return "Quote age not supplied";if(s<60)return Math.max(1,Math.round(s))+"s before snapshot";if(s<3600)return Math.ceil(s/60)+"m before snapshot";return Math.round(s/3600)+"h before snapshot"}
function gradeAge(s){return !Number.isFinite(s)?"unknown":s<600?"fresh":s<1800?"moderate":"older"}
function bestSide(records,which){const valid=records.filter(x=>!x.book.dfs&&Number.isFinite(x.quote?.[which]));valid.sort((a,b)=>b.quote[which]-a.quote[which]);return valid[0]||null}
function bySport(group,p){if(!group||!p)return group;return [...group].sort((a,b)=>Math.abs(Date.parse(a.startTime)-Date.parse(p.startTime))-Math.abs(Date.parse(b.startTime)-Date.parse(p.startTime)))[0]}
function normalizeOffers(p){const id=norm(p?.player||"")+"|"+(p?.stat||"");return id}
function compare(groups,p){const root=$("compareContent"),context=$("compareContext");if(!root)return;
if(!groups.length){root.innerHTML='<div class="notice">No source-specific full-game lines are available for this player and statistic. Open the Market board to choose another prop.</div>';return}
const group=(p&&groups.length>1?bySport(groups,p):groups[0])||groups[0];
const id=normalizeOffers(group)+"|"+String(group.startTime||"");if(id!==stateCompare.id){stateCompare.id=id;stateCompare.line=Number.isFinite(p?.line)?p.line:Number.isFinite(group.line)?group.line:null;stateCompare.side=p?.side==="under"?"under":"over"}
stateCompare.groups=groups;stateCompare.ref=p;
const books=[...(group.books||[])],allLines=[...new Set(books.flatMap(b=>(b.lines||[]).map(l=>l.line)).filter(Number.isFinite))].sort((a,b)=>a-b);
if(stateCompare.line===null||!allLines.some(x=>Math.abs(x-stateCompare.line)<.001)){if(allLines.length)stateCompare.line=allLines.find(x=>Math.abs(x-group.line)<.001)??allLines[Math.floor(allLines.length/2)]}
const line=stateCompare.line,selected=books.map(b=>({book:b,quote:b.lines?.find(q=>Math.abs(q.line-line)<.001)||null})),matched=selected.filter(x=>x.quote),alt=selected.filter(x=>!x.quote).sort((a,b)=>a.book.label.localeCompare(b.book.label));
const over=bestSide(matched,"over"),under=bestSide(matched,"under"),prizes=matched.filter(x=>x.book.dfs);
const order=(a,b)=>(!!b.quote-!!a.quote)||a.book.label.localeCompare(b.book.label);
selected.sort(order);
const asOf=state.booksSnapshot,stamp=asOf?new Date(asOf).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Unknown";
context.innerHTML='<div class="cmp-context"><div><span class="cmp-label">🔒 PRIVATE BOOK COMPARISON</span><h3>'+safe(group.player)+'</h3><p>'+safe(group.stat)+" · "+safe(group.matchup||"NBA")+' · Full game</p></div><div><strong>'+books.length+'</strong><small>Platforms</small></div></div>';
root.innerHTML='<div class="cmp-select"><div><label for="cmpLine">Exact threshold</label><select id="cmpLine">'+allLines.map(v=>'<option value="'+v+'"'+(v===line?" selected":"")+'>'+num(v)+' '+safe(group.stat)+'</option>').join("")+'</select></div><div><label>Direction</label><div class="cmp-side"><button data-cmp-side="over" class="'+(stateCompare.side==="over"?"active":"")+'">Higher</button><button data-cmp-side="under" class="'+(stateCompare.side==="under"?"active":"")+'">Lower</button></div></div></div>'
+'<div class="cmp-snapshot"><span>Snapshot: '+safe(stamp)+'</span><span>'+matched.length+'/'+books.length+' platforms at the exact line</span></div>'
+'<div class="cmp-winners"><div class="cmp-winner"><span>BEST HIGHER PRICE</span><strong>'+(over?odds(over.quote.over):"—")+'</strong><small>'+(over?safe(over.book.label)+" · "+num(line):"No comparable sportsbook quote")+'</small></div><div class="cmp-winner"><span>BEST LOWER PRICE</span><strong>'+(under?odds(under.quote.under):"—")+'</strong><small>'+(under?safe(under.book.label)+" · "+num(line):"No comparable sportsbook quote")+'</small></div></div>'
+'<h3 class="cmp-title">Exact-line comparison <small>'+num(line)+' '+safe(group.stat)+'</small></h3>'
+'<div class="cmp-table">'+matched.map(({book,quote})=>{const winning=(stateCompare.side==="over"?over:under)?.book.book===book.book&&!book.dfs;
return '<div class="cmp-row '+(winning?"cmp-winning":"")+'"><div class="cmp-book"><span class="cmp-brand">'+safe(book.label.slice(0,1))+'</span><div><strong>'+safe(book.label)+'</strong><small>'+(book.dfs?"Pick’em threshold":"Sportsbook odds")+'</small></div></div><div class="cmp-prices">'+(book.dfs?'<span class="cmp-dfs">Available as a DFS threshold</span>':'<span class="'+(winning&&stateCompare.side==="over"?"best":"")+'">↑ '+odds(quote.over)+'</span><span class="'+(winning&&stateCompare.side==="under"?"best":"")+'">↓ '+odds(quote.under)+'</span>')+'</div><small class="cmp-age '+gradeAge(quote.ageSeconds)+'">'+safe(ageText(quote.ageSeconds))+'</small></div>'}).join("")+(matched.length?"":'<div class="cmp-empty">No platforms currently quote this exact line.</div>')+'</div>'
+(alt.length?'<div class="cmp-alts"><div class="cmp-alts-head"><h3>Different-line offers</h3><small>Not directly comparable</small></div>'+alt.map(({book})=>{let offers=[...(book.lines||[])].sort((a,b)=>Math.abs(a.line-line)-Math.abs(b.line-line)).slice(0,4);return '<div class="cmp-altrow"><strong>'+safe(book.label)+'</strong><div>'+offers.map(q=>'<span>'+num(q.line)+(book.dfs?"":(" · ↑"+odds(q.over)+" ↓"+odds(q.under)))+'</span>').join("")+'</div></div>'}).join("")+'</div>':"")
+'<div class="cmp-note"><strong>Research-only comparison</strong><p>'+(state.booksIncomplete?'The provider reports incomplete market coverage. ':'')+'Best price ranks American-odds quotes at the exact same player, stat, threshold, period, and selected direction. DFS thresholds do not have conventional sportsbook odds and aren’t ranked against them. Each age is measured at the provider snapshot, not guaranteed current. Verify in the sportsbook before acting.</p></div>';
}
document.addEventListener("change",e=>{if(e.target.id!=="cmpLine")return;stateCompare.line=Number(e.target.value);if(stateCompare.groups)compare(stateCompare.groups,stateCompare.ref)});
document.addEventListener("click",e=>{const b=e.target.closest("[data-cmp-side]");if(!b)return;stateCompare.side=b.dataset.cmpSide;if(stateCompare.groups)compare(stateCompare.groups,stateCompare.ref)});
window.renderPrivateCompare=compare;
})();