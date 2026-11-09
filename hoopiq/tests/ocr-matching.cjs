const assert=require("node:assert/strict");
const ocr=require("../roster-ocr.js");
const people=[
 ["Ajay Mitchell","OKC"],["Jrue Holiday","POR"],["Nickeil Alexander-Walker","ATL"],
 ["Scottie Barnes","TOR"],["Anthony Davis","WSH"],["Anthony Black","ORL"],
 ["Aaron Gordon","DEN"],["Nicolas Claxton","CHI"],["Dylan Harper","SA"],["Payton Pritchard","BOS"],
 ["Aaron Mitchell","CLE"],["Donovan Mitchell","CLE"]
].map(([name,team],i)=>({id:i+1000,name,team}));
const text=[
 "A. MITCHELL","PG,SG OKC","J. HOLIDAY","PG,SG POR",
 "N. ALEXANDER-WALKER","PG,SG ATL","S. BARNES","SF,PF,C TOR",
 "A. DAVIS","PF,C WAS","A. BLACK","PG SG SF ORL",
 "A. GORDON","PF,C DEN","N. CLAXTON","C CHI",
 "D. HARPER","PG SG SAS","P. PRITCHARD","PG BOS"
].join("\n");
const parsed=ocr.getMatches(text,people);
const found=parsed.matches.map(p=>p.name);
for(const expected of ["Ajay Mitchell","Jrue Holiday","Nickeil Alexander-Walker","Scottie Barnes","Anthony Davis","Anthony Black","Aaron Gordon","Nicolas Claxton","Dylan Harper","Payton Pritchard"]){
 assert(found.includes(expected),expected+" was not recognized");
}
assert(!found.includes("Aaron Mitchell"),"picked same-initial wrong team");
assert(!found.includes("Donovan Mitchell"),"picked wrong Mitchell");
assert.equal(ocr.team("WAS"),"WSH");
assert.equal(ocr.team("SAS"),"SA");
const ambiguous=ocr.getMatches("A. MITCHELL",people);
assert(!ambiguous.matches.some(p=>p.name==="Ajay Mitchell"),"ambiguous name should not be selected");
assert(ambiguous.ambiguous.length>0);
const resolved=ocr.getMatches("A. MITCHELL\nPG SG OKC",people);
assert(resolved.matches.some(p=>p.name==="Ajay Mitchell"));
assert(!resolved.matches.some(p=>p.name==="Aaron Mitchell"));
assert(ocr.getMatches("N. ALEXANDER-WALKER\nATL",people).matches.some(p=>p.name==="Nickeil Alexander-Walker"));
console.log("Yahoo roster abbreviation matching checks passed; "+parsed.matches.length+" players recognized.");
