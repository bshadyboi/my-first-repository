(function(){"use strict";const app=window.PropIQRuntime,C=window.PropIQCalendar;if(!app||!C)return;
const S=app.state,$=id=>document.getElementById(id);
function dayLabel(offset){return new Date(C.targetDay(offset)+"T12:00:00").toLocaleDateString([],{month:"short",day:"numeric"})}
let refreshing=false;
function count(offset){const entries=C.filter(S.market,offset);const half=C.filter(S.books,offset).filter(x=>x.period==="1H");return {full:entries.length,half:half.length,games:new Set(entries.map(x=>x.startTime).filter(Boolean)).size}}
function markup(type){const info0=count(0),info1=count(1),selected=S.dayOffset;const key=type==="home"?"piHomeDay":"piMarketDay";
return '<div class="tomorrow-nav" id="'+key+'"><div class="tomorrow-tabs">'+[0,1].map(n=>'<button class="'+(n===selected?"active":"")+'" data-day-select="'+n+'" aria-pressed="'+(n===selected?'true':'false')+'"><span>'+(n===0?"Today":"Tomorrow")+'</span><small>'+dayLabel(n)+' · '+(n===0?info0:info1).full+' props</small></button>').join("")+'</div><button class="tomorrow-refresh" data-day-refresh title="Recheck posted lines" aria-label="Refresh available prop lines">↻</button></div>'}
function mount(){const home=$("screen-today"),market=$("screen-market");if(home&&!$("piHomeDay")){const d=document.createElement("div");d.id="piHomeDayHost";const title=home.querySelector(".pi-today-title");if(title)title.after(d);else home.prepend(d)}if(market&&!$("piMarketDay")){const d=document.createElement("div");d.id="piMarketDayHost";const title=market.querySelector(".page-title");if(title)title.after(d);else market.prepend(d)}}
function update(){mount();for(const [id,type] of [["piHomeDayHost","home"],["piMarketDayHost","market"]]){const root=$(id);if(root)root.innerHTML=markup(type)}
const title=$("screen-today")?.querySelector(".pi-today-title h1");if(title)title.textContent=S.dayOffset?"Tomorrow":"Today";
const banner=$("screen-today")?.querySelector(".pi-top-cta h2");if(banner)banner.textContent=S.dayOffset?"Tomorrow’s Top 5 Props":"Today’s Top 5 Props";
const date=C.targetDay(),n=count(S.dayOffset);
let status=$("tomorrowFeedStatus");if(!status){const host=$("piHomeDayHost");if(host){status=document.createElement("p");status.id="tomorrowFeedStatus";status.className="tomorrow-status";host.after(status)}}
if(status){const stamp=S.booksSnapshot?new Date(S.booksSnapshot).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"unknown";status.textContent=(S.marketLoaded?n.full+" full-game props posted": "Checking available props")+" · "+date+" (Pacific)"+(S.booksConnected?" · "+(S.booksStale?"CACHED snapshot (verify before use)":"feed snapshot")+" "+stamp:"")+(S.booksIncomplete?" · source coverage may be incomplete":"")+(S.dayOffset&&count(1).half?" · "+count(1).half+" first-half markets":"");}
let notice=$("tomorrowEmptyNotice");if(S.marketLoaded&&S.dayOffset===1&&n.full===0&&count(0).full>0){if(!notice){const anchor=$("piHomeDayHost");if(anchor){notice=document.createElement("div");notice.id="tomorrowEmptyNotice";notice.className="tomorrow-empty-notice";anchor.after(notice)}}if(notice)notice.innerHTML='<strong>Tomorrow’s lines aren’t posted yet.</strong><span> '+count(0).full+' full-game props are available for today.</span><button type="button" data-switch-today>View Today’s Props</button>';}else if(notice){notice.remove();}
}
document.addEventListener("click",async e=>{const today=e.target.closest("[data-switch-today]");if(today){S.stat="";const search=$("marketSearch"),match=$("marketGame");if(search)search.value="";if(match)match.value="";window.PropIQSmart?.clear();C.setDay(0);update();return}const btn=e.target.closest("[data-day-select]");if(btn){C.setDay(Number(btn.dataset.daySelect));update();return}
const refresh=e.target.closest("[data-day-refresh]");if(refresh&&!refreshing){refreshing=true;document.querySelectorAll("[data-day-refresh]").forEach(b=>b.disabled=true);try{await C.refresh();update()}catch{ }finally{refreshing=false;document.querySelectorAll("[data-day-refresh]").forEach(b=>b.disabled=false)}}});
window.addEventListener("propiq:day",update);
window.addEventListener("propiq:home",()=>{if(S.page==="today")update()});
window.addEventListener("propiq:market",()=>{if(S.page==="market")update()});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",update);else update();
})();