import React, { useState, useMemo, useEffect } from "react";

const STRUCTURES = [
  { id:"ansm",         name:"ANSM-L",                       acq:"Limited Event",      bonuses:{specialCost:4, specialGSC:2} },
  { id:"acrobat",      name:"Acrobat's Waiting Room",        acq:"Shop (F4)",          bonuses:{specialCost:4, specialTime:2} },
  { id:"sheep",        name:"Glass Sheep",                   acq:"Specialty Item",     bonuses:{specialCost:3, specialTime:1} },
  { id:"cards",        name:"Card-Flipping Game",            acq:"Pet Cookie Shop",    bonuses:{generalCost:2} },
  { id:"divine",       name:"Divine Protection",             acq:"42 Masterpieces",    bonuses:{generalCost:1, specialEnergy:2} },
  { id:"night",        name:"Night of Great Journey",        acq:"Limited/Shop",       bonuses:{generalGSC:2, generalTime:1} },
  { id:"luterra",      name:"Luterra King Statue",           acq:"90% E.Luterra Tome", bonuses:{specialGSC:1, specialEnergy:3} },
  { id:"worldtree",    name:"World Tree Leaves",             acq:"World Tree Leaves",  bonuses:{generalTime:2, generalGSC:1} },
  { id:"acrobatweapon",name:"Acrobat's Weapon Display Rack", acq:"Shop/Event",         bonuses:{specialEnergy:4, specialGSC:2} },
];

const OUTFITS = [
  { id:"payla",   name:"Payla - Vern Ball",          bonuses:{specialCost:2, specialGSC:4} },
  { id:"thirain", name:"Thirain - Irresistible Heir", bonuses:{generalCost:1, generalTime:2} },
  { id:"nia",     name:"Nia - Basic Outfit",          bonuses:{specialCost:1} },
  { id:"nineveh", name:"Nineveh - Cute Maid",         bonuses:{generalGSC:2, generalTime:1} },
];

const CAPS = {
  specialCost:10, generalCost:30, specialGSC:10, specialTime:10,
  specialEnergy:10, generalEnergy:10, generalGSC:30, generalTime:30,
};

const STATS = {
  specialEnergy:{label:"[Special] Crafting Action Energy Consumption", color:"#5ba4cf", pri:1, positive:false},
  specialGSC:   {label:"[Special] Crafting Great Success Chance",      color:"#c080e0", pri:2, positive:true},
  specialCost:  {label:"[Special] Crafting Cost",                      color:"#f0a500", pri:3, positive:false},
  specialTime:  {label:"[Special] Crafting Time",                      color:"#60c890", pri:4, positive:false},
  generalGSC:   {label:"Crafting Great Success Chance",                color:"#9060c0", pri:5, positive:true},
  generalTime:  {label:"Crafting Time",                                color:"#50b070", pri:6, positive:false},
  generalCost:  {label:"Crafting Cost",                                color:"#d4c060", pri:7, positive:false},
  generalEnergy:{label:"Crafting Action Energy",                       color:"#4890bf", pri:8, positive:false},
};

const PET_STATS    = ["specialEnergy","specialGSC","specialTime"];
const INNATE_STATS = Object.keys(STATS).filter(function(s){
  return !PET_STATS.includes(s) && s !== "specialCost" && s !== "generalEnergy";
});

function fmtBonus(k, v) { return (STATS[k] && STATS[k].positive ? "+" : "-") + v + "%"; }
function step(v, delta) { return Math.max(0, Math.round((v + delta) * 2) / 2); }

const BASE_FEE     = 400;
const BASE_ENERGY  = 288;
const DAILY_ENERGY = 17503;
const ABIDOS_PER   = 10;
const BASE_GSC     = 0.05;
const TAX_RATE = 0.95;

function getCraftFee(costReduction) {
  // costReduction is expected as decimal (e.g. 0.12 for 12%)
  return BASE_FEE * (1 - costReduction);
}

function materialCostFn(prices) {
  return (33 / 100 * prices.abidosTimberPrice)
       + (45 / 100 * prices.tenderPrice)
       + (86 / 100 * prices.timberPrice);
}

function effectiveGSC(spGSC, genGSC) {
  return BASE_GSC * (1 + spGSC / 100) + genGSC / 100;
}

function computeWeights(prices, innate, fullSlots, craftSlots) {
  var mat          = materialCostFn(prices);
  var innateEner   = (innate.specialEnergy || 0) / 100;
  var innateCost   = (innate.generalCost   || 0) / 100;
  var baseEner     = BASE_ENERGY * (1 - innateEner);
  var baseFee      = BASE_FEE    * (1 - innateCost);
  var energyCrafts = DAILY_ENERGY / baseEner;
  var slotCrafts   = craftSlots * 10 * 2;
  var dailyCrafts  = Math.min(energyCrafts, slotCrafts);
  var gsc          = effectiveGSC(innate.specialGSC || 0, innate.generalGSC || 0);
  var expAbidos    = ABIDOS_PER * (1 + gsc);
  var craftFee = BASE_FEE * (1 - innateCost);
var revenue = expAbidos * prices.abidosPrice * TAX_RATE;

var profitPerCraft = revenue - mat - craftFee;
  var costW        = BASE_FEE * 0.01 * dailyCrafts;
  var extraEnergyCrafts = Math.min(DAILY_ENERGY / (baseEner * 0.99), slotCrafts) - dailyCrafts;
  var energyW      = fullSlots ? Math.max(0, extraEnergyCrafts * profitPerCraft) : 0;
  // special GSC: multiplicative from 5% base → 1% bonus adds 0.05×0.01 = 0.0005 to chance
  var spGscW       = BASE_GSC * 0.01 * ABIDOS_PER * prices.abidosPrice * dailyCrafts;
  // general GSC: additive → 1% bonus adds 0.01 to chance directly (20× more valuable)
  var genGscW      = 0.01 * ABIDOS_PER * prices.abidosPrice * dailyCrafts;
  return {
    specialCost:   Math.max(1, costW),
    generalCost:   Math.max(1, costW),
    specialEnergy: Math.max(0, energyW),
    generalEnergy: 0,
    specialTime:   2,
    generalTime:   2,
    specialGSC:    Math.max(1, spGscW),
    generalGSC:    Math.max(1, genGscW),
  };
}

function combos(arr, k) {
  if (k <= 0) return [[]];
  if (arr.length === 0) return [];
  var h = arr[0], t = arr.slice(1);
  return combos(t, k-1).map(function(c){ return [h].concat(c); }).concat(combos(t, k));
}

function calcTotals(structs, outfits, innate) {
  var t = Object.assign({}, innate);
  structs.concat(outfits).forEach(function(it) {
    Object.keys(it.bonuses).forEach(function(k) {
      t[k] = (t[k] || 0) + it.bonuses[k];
    });
  });
  return t;
}

function effOf(tot) {
  var e = {};
  Object.keys(tot).forEach(function(k) {
    e[k] = Math.min(tot[k], CAPS[k] !== undefined ? CAPS[k] : tot[k]);
  });
  return e;
}

function scoreCombo(structs, outfits, innate, sSlots, oSlots, prices, craftSlots) {
  var tot = calcTotals(structs, outfits, innate);
  var e = effOf(tot), ei = effOf(innate);
  var full = sSlots === 3 && oSlots === 3;
  var W = computeWeights(prices, innate, full, craftSlots);
  return Object.keys(W).reduce(function(s, k) {
    return s + ((e[k] || 0) - (ei[k] || 0)) * W[k];
  }, 0);
}

function optimize(availS, availO, innate, sSlots, oSlots, prices, n, craftSlots) {
  n = n || 3;
  var sk = Math.min(sSlots, availS.length), ok = Math.min(oSlots, availO.length);
  if (sk === 0 || ok === 0) return [];
  var sc = combos(availS, sk), oc = combos(availO, ok), all = [];
  sc.forEach(function(s) {
    oc.forEach(function(o) {
      all.push({ structs:s, outfits:o, score:scoreCombo(s, o, innate, sSlots, oSlots, prices, craftSlots) });
    });
  });
  return all.sort(function(a,b){ return b.score - a.score; }).slice(0, n).map(function(r) {
    return Object.assign({}, r, { tot: calcTotals(r.structs, r.outfits, innate) });
  });
}

function calcProfileProfit(profile, price, cost, gsc, costReduction, energyPerCraft, craftingSlots) {
  const ABIDOS_PER = 10;

  // Expected output with GSC
  const expectedOutput = ABIDOS_PER * (1 + gsc);

  // Apply marketplace tax
  const revenue = expectedOutput * price * TAX_RATE;

  // Apply crafting fee with reduction
  const craftFee = getCraftFee(costReduction);

  const profitPerCraft = revenue - cost - craftFee;

  // Energy limit
  const DAILY_ENERGY = 2880;
  const energyCrafts = DAILY_ENERGY / energyPerCraft;

  // Slot limit (2 runs/day)
  const slotCrafts = craftingSlots * 10 * 2;

  const dailyCrafts = Math.min(energyCrafts, slotCrafts);

  return {
    profitPerCraft,
    dailyCrafts,
    dailyProfit: profitPerCraft * dailyCrafts
  };
}

function optimalProfit(options) {
  const {
    price,
    cost,
    gsc,
    costReduction,
    energyPerCraft,
    craftingSlots
  } = options;

  const ABIDOS_PER = 10;

  const expectedOutput = ABIDOS_PER * (1 + gsc);

  const revenue = expectedOutput * price * TAX_RATE;

  const craftFee = getCraftFee(costReduction);

  const profitPerCraft = revenue - cost - craftFee;

  const DAILY_ENERGY = 2880;
  const energyCrafts = DAILY_ENERGY / energyPerCraft;
  const slotCrafts = craftingSlots * 10 * 2;

  const dailyCrafts = Math.min(energyCrafts, slotCrafts);

  return {
    profitPerCraft,
    dailyCrafts,
    dailyProfit: profitPerCraft * dailyCrafts
  };
}

// ── Styles ──────────────────────────────────────────────────────────
var BG="#0a1520", PANEL="#111d2b", BORDER="#1e3050", TEXT="#c8d4e0", DIM="#5a7a90", GOLD="#f0a500";

function btnStyle(active, danger) {
  return {
    background: danger ? "#2a0d0d" : active ? "#1e4070" : "#0d1825",
    color:      danger ? "#e06060" : active ? "#c8e4ff" : DIM,
    border:     "1px solid " + (danger ? "#6a2020" : active ? "#2d6aad" : BORDER),
    borderRadius:5, padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit",
  };
}

var panelStyle = { background:PANEL, border:"1px solid "+BORDER, borderRadius:8, padding:14, marginBottom:12 };

var inputStyle = {
  background:"#0d1825", border:"1px solid "+BORDER, color:TEXT,
  borderRadius:4, padding:"3px 8px", fontSize:12, fontFamily:"inherit", width:90, textAlign:"right",
};

// ── Sub-components ────────────────────────────────────────────────────
function Checkbox(props) {
  var color = props.color || "#2d6aad";
  return (
    <div onClick={props.onChange} style={{
      width:15, height:15, border:"1.5px solid "+(props.checked ? color : "#2a4060"),
      borderRadius:3, background:props.checked ? color : "transparent",
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    }}>
      {props.checked && <span style={{color:"#fff", fontSize:10, lineHeight:1}}>&#10003;</span>}
    </div>
  );
}

function SlotPicker(props) {
  var max = props.max || 3;
  var opts = props.options || Array.from({length:max}, function(_,i){ return i+1; });
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
      <span style={{fontSize:12, color:TEXT}}>{props.label}</span>
      <div style={{display:"flex", gap:4}}>
        {opts.map(function(n) {
          return (
            <button key={n} onClick={function(){ props.onChange(n); }}
              style={Object.assign({}, btnStyle(props.value===n), {padding:"3px 10px", fontSize:12, minWidth:32})}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceInput(props) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
      <span style={{fontSize:11, color:DIM}}>{props.label}</span>
      <div style={{display:"flex", alignItems:"center", gap:4}}>
        <input type="number" min="0" value={props.value}
          onChange={function(e){ props.onChange(Math.max(0, parseInt(e.target.value)||0)); }}
          style={inputStyle}/>
        <span style={{fontSize:11, color:DIM, width:12}}>g</span>
      </div>
    </div>
  );
}

function StatCounter(props) {
  var stat = props.stat, v = props.value, cap = CAPS[stat];
  var capped = cap && v >= cap;
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
      <span style={{fontSize:11, color: capped ? "#e08050" : DIM}}>
        {STATS[stat].label}{capped ? " !" : ""}
      </span>
      <div style={{display:"flex", alignItems:"center", gap:4, flexShrink:0}}>
        <button onClick={function(){ props.onChange(step(v, -0.5)); }}
          style={Object.assign({}, btnStyle(false), {padding:"1px 6px", fontSize:13})}>-</button>
        <span style={{width:36, textAlign:"center", fontSize:13, color: capped ? "#e08050" : TEXT}}>{v}%</span>
        <button onClick={function(){ props.onChange(step(v, 0.5)); }}
          style={Object.assign({}, btnStyle(false), {padding:"1px 6px", fontSize:13})}>+</button>
      </div>
    </div>
  );
}

function StatBar(props) {
  var stat = props.stat, rawTotal = props.rawTotal || 0, innateVal = props.innateVal || 0;
  var cap      = CAPS[stat] || 100;
  var meta     = STATS[stat] || {label:stat, color:"#888", positive:false};
  var effTotal  = Math.min(rawTotal, cap);
  var effInnate = Math.min(innateVal, cap);
  var equipGain = Math.max(0, effTotal - effInnate);
  var waste     = rawTotal - effTotal;
  var pctInnate = (effInnate / cap) * 100;
  var pctEquip  = (equipGain / cap) * 100;
  var atCap     = effTotal >= cap;
  var sign      = meta.positive ? "+" : "-";
  return (
    <div style={{marginBottom:6}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:DIM, marginBottom:2}}>
        <span>{meta.label}</span>
        <span style={{color: waste>0 ? "#e06060" : atCap ? GOLD : TEXT}}>
          {sign}{effTotal}% / {cap}%{waste > 0 ? " (+" + waste + "% wasted)" : ""}
        </span>
      </div>
      <div style={{height:5, background:"#0a1420", borderRadius:3, display:"flex", overflow:"hidden"}}>
        {pctInnate > 0 && <div style={{height:"100%", width:pctInnate+"%", background:"#2a4060"}}/>}
        {pctEquip  > 0 && <div style={{height:"100%", width:pctEquip+"%",  background:waste>0 ? meta.color+"70" : meta.color}}/>}
      </div>
    </div>
  );
}

function ResultCard(props) {
  var r = props.r, rank = props.rank, innate = props.innate;
  var activeStats = Object.keys(STATS)
    .filter(function(s){ return (r.tot[s]||0) > 0 || (innate[s]||0) > 0; })
    .sort(function(a,b){ return (STATS[a].pri||9) - (STATS[b].pri||9); });
  var totalWaste = Object.keys(r.tot).reduce(function(s,k){
    var cap = CAPS[k]; return s + (cap ? Math.max(0, r.tot[k] - cap) : 0);
  }, 0);
  var badges = [];
  if (rank === 0) badges.push({txt:"OPTIMAL", col:GOLD});
  if (totalWaste > 0) badges.push({txt:totalWaste+"% wasted", col:"#e09040"});
  else badges.push({txt:"No waste", col:"#60c060"});
  return (
    <div style={{background:rank===0?"#121d12":PANEL, border:"1px solid "+(rank===0?"#2a5a2a":BORDER), borderRadius:8, padding:14, marginBottom:10}}>
      <div style={{display:"flex", alignItems:"center", gap:7, marginBottom:11, flexWrap:"wrap"}}>
        <span style={{background:rank===0?"#205a20":"#1a3a5a", color:"#fff", borderRadius:4, padding:"2px 9px", fontSize:11, fontWeight:"bold"}}>#{rank+1}</span>
        {badges.map(function(b,i){ return <span key={i} style={{fontSize:11, color:b.col}}>{b.txt}</span>; })}
        <span style={{marginLeft:"auto", fontSize:11, color:DIM}}>score {r.score.toFixed(0)}</span>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:11}}>
        <div>
          <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>STRUCTURES</div>
          {r.structs.map(function(s){
            return (
              <div key={s.id} style={{marginBottom:4}}>
                <span style={{fontSize:12, color:TEXT}}>- {s.name}</span>
                <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                  {Object.keys(s.bonuses).map(function(k){ return (STATS[k]?STATS[k].label:k)+" "+fmtBonus(k,s.bonuses[k]); }).join("  /  ")}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{fontSize:10, color:"#cf9a5b", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>OUTFITS</div>
          {r.outfits.map(function(o){
            return (
              <div key={o.id} style={{marginBottom:4}}>
                <span style={{fontSize:12, color:TEXT}}>- {o.name}</span>
                <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                  {Object.keys(o.bonuses).map(function(k){ return (STATS[k]?STATS[k].label:k)+" "+fmtBonus(k,o.bonuses[k]); }).join("  /  ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{borderTop:"1px solid "+BORDER, paddingTop:8}}>
        {activeStats.map(function(s){ return <StatBar key={s} stat={s} rawTotal={r.tot[s]||0} innateVal={innate[s]||0}/>; })}
      </div>
    </div>
  );
}

function SummaryTab(props) {
  var profiles = props.profiles, prices = props.prices;
  var rows = profiles.map(function(p){
    return Object.assign({name:p.name}, calcProfileProfit(p, prices));
  });
  var totalDaily   = rows.reduce(function(s,r){ return s + (r.daily||0); }, 0);
  var totalMonthly = totalDaily * 30;
  var totalYearly  = totalDaily * 365;
  function goldColor(v){ return v >= 0 ? "#60c060" : "#e06060"; }
  function fmt(v){ return Math.round(v).toLocaleString()+"g"; }
  return (
    <div>
      <div style={panelStyle}>
        <div style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1, marginBottom:12}}>PER PROFILE</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr repeat(3, auto)", gap:"6px 18px", alignItems:"baseline"}}>
          {["Profile","Crafts/day","Profit/craft","Daily profit"].map(function(h,i){
            return <div key={i} style={{fontSize:10, color:DIM, fontWeight:"bold", borderBottom:"1px solid "+BORDER, paddingBottom:4}}>{h}</div>;
          })}
          {rows.map(function(r,i){
            if (!r.daily && r.daily !== 0) return (
              <React.Fragment key={i}>
                <div style={{fontSize:12, color:TEXT}}>{r.name}</div>
                <div style={{fontSize:11, color:"#e06060", gridColumn:"span 3"}}>No items enabled</div>
              </React.Fragment>
            );
            return (
              <React.Fragment key={i}>
                <div style={{fontSize:12, color:TEXT, fontWeight:"600"}}>{r.name}</div>
                <div style={{fontSize:12, color:TEXT, textAlign:"right"}}>{r.dailyCrafts.toFixed(1)}</div>
                <div style={{fontSize:12, color:goldColor(r.ppc), textAlign:"right"}}>{fmt(r.ppc)}</div>
                <div style={{fontSize:12, color:goldColor(r.daily), textAlign:"right", fontWeight:"bold"}}>{fmt(r.daily)}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12}}>
        {[
          {label:"Daily",   value:totalDaily},
          {label:"Monthly", value:totalMonthly, sub:"x30 days"},
          {label:"Yearly",  value:totalYearly,  sub:"x365 days"},
        ].map(function(item){
          return (
            <div key={item.label} style={Object.assign({}, panelStyle, {textAlign:"center", marginBottom:0})}>
              <div style={{fontSize:11, color:DIM, marginBottom:4}}>{item.label}{item.sub ? " ("+item.sub+")" : ""}</div>
              <div style={{fontSize:26, fontWeight:"bold", color:goldColor(item.value)}}>{fmt(item.value)}</div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:10, color:DIM, marginTop:10, textAlign:"center"}}>
        Based on current market prices and each profile's optimal combo.
      </div>
    </div>
  );
}

// ── Defaults & persistence ────────────────────────────────────────────
var DEF_INNATE     = {specialEnergy:3, specialGSC:0, specialCost:0, specialTime:3, generalGSC:3, generalTime:6, generalCost:4, generalEnergy:0};
var DEF_STRUCTS    = ["acrobat","sheep","cards","divine","luterra","worldtree","acrobatweapon"];
var DEF_OUTFITS    = ["payla","thirain","nia","nineveh"];
var DEF_PRICES     = {abidosPrice:150, timberPrice:155, tenderPrice:309, abidosTimberPrice:2049};
var DEF_SSLOTS     = 3, DEF_OSLOTS = 3, DEF_CRAFT_SLOTS = 4;
var LS_KEY         = "stronghold-optimizer-profiles";
var LS_IDX         = "stronghold-optimizer-idx";
var LS_PRICES      = "stronghold-optimizer-prices";

function loadProfiles() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && p.length) return p.map(cleanProfile);
    }
  } catch(e) {}
  return [{id:1, name:"Main", innate:Object.assign({},DEF_INNATE), structs:DEF_STRUCTS.slice(), outfits:DEF_OUTFITS.slice(), structureSlots:DEF_SSLOTS, outfitSlots:DEF_OSLOTS, craftSlots:DEF_CRAFT_SLOTS}];
}

function mergeInnate(stored) {
  return Object.assign({}, DEF_INNATE, stored);
}

var VALID_STRUCT_IDS = STRUCTURES.map(function(s){ return s.id; });
var VALID_OUTFIT_IDS = OUTFITS.map(function(o){ return o.id; });

function cleanProfile(x) {
  return Object.assign(
    {structureSlots:DEF_SSLOTS, outfitSlots:DEF_OSLOTS, craftSlots:DEF_CRAFT_SLOTS},
    x,
    {
      innate: mergeInnate(x.innate || {}),
      structs: (x.structs || []).filter(function(id){ return VALID_STRUCT_IDS.indexOf(id) >= 0; }),
      outfits: (x.outfits || []).filter(function(id){ return VALID_OUTFIT_IDS.indexOf(id) >= 0; }),
    }
  );
}

function loadIdx(profiles) {
  try { var i = parseInt(localStorage.getItem(LS_IDX)||"0"); return Math.min(i, profiles.length-1); } catch(e) {}
  return 0;
}

function loadPrices() {
  try { var raw = localStorage.getItem(LS_PRICES); if(raw) return Object.assign({},DEF_PRICES,JSON.parse(raw)); } catch(e) {}
  return Object.assign({},DEF_PRICES);
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  var profilesInit = loadProfiles();
  var [profiles, setProfiles] = useState(profilesInit);
  var [idx, setIdx]           = useState(loadIdx(profilesInit));
  var [prices, setPrices]     = useState(loadPrices);
  var [tab, setTab]           = useState("opt");
  var [newName, setNewName]   = useState("");
  var [editingName, setEditingName] = useState(false);
  var [nameInput, setNameInput]     = useState("");

  useEffect(function(){ try{localStorage.setItem(LS_KEY,    JSON.stringify(profiles));}catch(e){} }, [profiles]);
  useEffect(function(){ try{localStorage.setItem(LS_IDX,    String(idx));             }catch(e){} }, [idx]);
  useEffect(function(){ try{localStorage.setItem(LS_PRICES, JSON.stringify(prices));  }catch(e){} }, [prices]);

  var p    = profiles[idx];
  function upd(ch) { setProfiles(function(prev){ return prev.map(function(x,i){ return i===idx ? Object.assign({},x,ch) : x; }); }); }
  function togS(id) { upd({structs: p.structs.indexOf(id)>=0 ? p.structs.filter(function(x){return x!==id;}) : p.structs.concat([id])}); }
  function togO(id) { upd({outfits: p.outfits.indexOf(id)>=0 ? p.outfits.filter(function(x){return x!==id;}) : p.outfits.concat([id])}); }
  function setIn(k,v)     { upd({innate:  Object.assign({},p.innate,  {[k]:v})}); }
  function setPrice(k,v)  { setPrices(function(prev){ return Object.assign({},prev,{[k]:v}); }); }

  function addProf() {
    if (!newName.trim()) return;
    setProfiles(function(prev){ return prev.concat([{id:Date.now(), name:newName.trim(), innate:Object.assign({},DEF_INNATE), structs:DEF_STRUCTS.slice(), outfits:DEF_OUTFITS.slice(), structureSlots:DEF_SSLOTS, outfitSlots:DEF_OSLOTS, craftSlots:DEF_CRAFT_SLOTS}]); });
    setIdx(profiles.length);
    setNewName("");
  }
  function delProf() {
    if (profiles.length <= 1) return;
    setProfiles(function(prev){ return prev.filter(function(_,i){ return i!==idx; }); });
    setIdx(Math.max(0, idx-1));
  }
  function renameProf() { if(nameInput.trim()) upd({name:nameInput.trim()}); setEditingName(false); }

  var availS     = STRUCTURES.filter(function(s){ return p.structs.indexOf(s.id)>=0; });
  var availO     = OUTFITS.filter(function(o){ return p.outfits.indexOf(o.id)>=0; });
  var sSlots     = p.structureSlots || DEF_SSLOTS;
  var oSlots     = p.outfitSlots    || DEF_OSLOTS;
  var craftSlots = (p.craftSlots !== undefined && p.craftSlots !== null) ? p.craftSlots : DEF_CRAFT_SLOTS;
  var fullSlots  = sSlots===3 && oSlots===3;
  var W          = computeWeights(prices, p.innate, fullSlots, craftSlots);
  var innateGSC    = ((p.innate.specialGSC||0) + (p.innate.generalGSC||0)) / 100;
  var slotCraftsMax = craftSlots * 10 * 2;

  var totalCrafts  = craftSlots * 10;
  var needAbidos   = totalCrafts * 33;
  var needTender   = totalCrafts * 45;
  var needTimber   = totalCrafts * 86;
  var stacksAbidos = Math.ceil(needAbidos / 100);
  var stacksTender = Math.ceil(needTender  / 100);
  var stacksTimber = Math.ceil(needTimber  / 100);
  var shoppingGold = stacksAbidos*prices.abidosTimberPrice + stacksTender*prices.tenderPrice + stacksTimber*prices.timberPrice;
  var matCost      = materialCostFn(prices);
  var profitInnate = ABIDOS_PER * (1 + innateGSC) * prices.abidosPrice - matCost - BASE_FEE*(1-(p.innate.generalCost||0)/100);

  var results = useMemo(function(){
    return optimize(availS, availO, p.innate, sSlots, oSlots, prices);
  }, [availS.map(function(s){return s.id;}).join(), availO.map(function(o){return o.id;}).join(), JSON.stringify(p.innate), sSlots, oSlots, JSON.stringify(prices)]);

// inside App component
var optimalProfit = useMemo(function(){
  if (!results.length) return null;

  var tot = results[0].tot;
  var craftSlots = p.craftSlots || 4;

  var effSpCost  = Math.min(tot.specialCost  ||0, 10);
  var effGenCost = Math.min(tot.generalCost  ||0, 30);
  var effEnergy  = Math.min(tot.specialEnergy||0, 10);

  var reducedFee    = BASE_FEE    * (1 - (effSpCost + effGenCost)/100);
  var reducedEnergy = BASE_ENERGY * (1 - effEnergy/100);

  // ✅ FIX: proper craft limit
  var energyCrafts = DAILY_ENERGY / reducedEnergy;
  var slotCrafts   = craftSlots * 10 * 2;
  var dailyCrafts  = Math.min(energyCrafts, slotCrafts);

  var gsc = effectiveGSC(tot.specialGSC || 0, tot.generalGSC || 0);
  var expAbidos = ABIDOS_PER * (1 + gsc);

  var costReduction = (effSpCost + effGenCost) / 100;
  var craftFee = getCraftFee(costReduction);

  var revenue = expAbidos * prices.abidosPrice * TAX_RATE;

  var ppc = revenue - matCost - craftFee;

  return {
    ppc: ppc,
    daily: dailyCrafts * ppc,
    dailyCrafts: dailyCrafts,
    slotLimited: slotCrafts < energyCrafts
  };
}, [results, JSON.stringify(prices), matCost, p.craftSlots]);

  var cappedInnate = Object.keys(p.innate).filter(function(k){ return CAPS[k] && p.innate[k] >= CAPS[k]; });

  function rowJ(label, val, color) {
    return (
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", fontSize:11, marginBottom:4}}>
        <span style={{color:DIM}}>{label}</span>
        <span style={{color:color||TEXT}}>{val}</span>
      </div>
    );
  }

  return (
    <div style={{background:BG, color:TEXT, minHeight:"100vh", fontFamily:"'Segoe UI',sans-serif", padding:12, fontSize:13}}>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:18, fontWeight:"bold", color:GOLD}}>Stronghold Optimizer</div>
        <div style={{fontSize:11, color:DIM}}>Abidos Fusion Material profit maximizer - Lost Ark T4</div>
      </div>

      <div style={Object.assign({},panelStyle,{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", padding:10})}>
        <span style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1}}>PROFILE</span>
        {profiles.map(function(pf,i){
          return <button key={pf.id} style={btnStyle(i===idx)} onClick={function(){setIdx(i);}}>{pf.name}</button>;
        })}
        <input value={newName} onChange={function(e){setNewName(e.target.value);}}
          onKeyDown={function(e){if(e.key==="Enter")addProf();}} placeholder="New profile..."
          style={{background:"#0d1825", border:"1px solid "+BORDER, color:TEXT, borderRadius:4, padding:"4px 8px", fontSize:11, width:120, fontFamily:"inherit"}}/>
        <button style={btnStyle(false)} onClick={addProf}>+ Add</button>
        {profiles.length > 1 && <button style={btnStyle(false,true)} onClick={delProf}>x Delete</button>}
        {editingName
          ? <React.Fragment>
              <input value={nameInput} onChange={function(e){setNameInput(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter")renameProf();if(e.key==="Escape")setEditingName(false);}}
                style={{background:"#0d1825", border:"1px solid #2d6aad", color:TEXT, borderRadius:4, padding:"4px 8px", fontSize:11, width:120, fontFamily:"inherit"}} autoFocus/>
              <button style={btnStyle(true)} onClick={renameProf}>OK</button>
            </React.Fragment>
          : <button style={btnStyle(false)} onClick={function(){setNameInput(p.name);setEditingName(true);}}>Rename</button>
        }
      </div>

      <div style={{display:"flex", gap:4, marginBottom:12}}>
        {[["opt","Optimizer"],["cfg","Configuration"],["summary","Summary"]].map(function(item){
          return <button key={item[0]} style={Object.assign({},btnStyle(tab===item[0]),{padding:"6px 18px",fontSize:13})} onClick={function(){setTab(item[0]);}}>{item[1]}</button>;
        })}
      </div>

      {tab==="summary" ? <SummaryTab profiles={profiles} prices={prices}/> : tab==="cfg" ? (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>

          <div>
            <div style={panelStyle}>
              <div style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1, marginBottom:12}}>SLOT CONFIGURATION</div>
              <SlotPicker label="Structure slots" value={sSlots} onChange={function(v){upd({structureSlots:v});}}/>
              <SlotPicker label="Outfit slots"    value={oSlots} onChange={function(v){upd({outfitSlots:v});}}/>
              <div style={{borderTop:"1px solid "+BORDER, margin:"10px 0"}}/>
              <div style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1, marginBottom:10}}>CRAFTING SLOTS</div>
              <SlotPicker label="Crafting slots" value={craftSlots} max={4} onChange={function(v){upd({craftSlots:v});}}/>
              <div style={{fontSize:10, color:DIM, marginTop:4}}>
                {craftSlots} slot{craftSlots>1?"s":""} x 10 crafts = <span style={{color:TEXT}}>{totalCrafts} crafts per queue fill</span>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={{fontSize:10, color:GOLD, fontWeight:"bold", letterSpacing:1, marginBottom:12}}>MARKET PRICES</div>
              <PriceInput label="Abidos (per unit)"  value={prices.abidosPrice}      onChange={function(v){setPrice("abidosPrice",v);}}/>
              <div style={{borderTop:"1px solid "+BORDER, margin:"8px 0"}}/>
              <div style={{fontSize:10, color:DIM, marginBottom:6}}>Stack of 100:</div>
              <PriceInput label="Timber"            value={prices.timberPrice}       onChange={function(v){setPrice("timberPrice",v);}}/>
              <PriceInput label="Tender Timber"     value={prices.tenderPrice}       onChange={function(v){setPrice("tenderPrice",v);}}/>
              <PriceInput label="Abidos Timber"     value={prices.abidosTimberPrice} onChange={function(v){setPrice("abidosTimberPrice",v);}}/>
              <div style={{borderTop:"1px solid "+BORDER, marginTop:10, paddingTop:10}}>
                <div style={{fontSize:10, color:DIM, marginBottom:6}}>Shopping list ({totalCrafts} crafts):</div>
                {[
                  {label:"Abidos Timber", stacks:stacksAbidos, units:needAbidos, price:prices.abidosTimberPrice},
                  {label:"Tender Timber", stacks:stacksTender, units:needTender, price:prices.tenderPrice},
                  {label:"Timber",        stacks:stacksTimber, units:needTimber, price:prices.timberPrice},
                ].map(function(item){
                  return (
                    <div key={item.label} style={{display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4}}>
                      <span style={{color:DIM}}>{item.label}</span>
                      <span style={{color:TEXT}}>
                        {item.stacks} stack{item.stacks!==1?"s":""} ({item.units})
                        <span style={{color:GOLD, marginLeft:6}}>{(item.stacks*item.price).toLocaleString()}g</span>
                      </span>
                    </div>
                  );
                })}
                <div style={{display:"flex", justifyContent:"space-between", fontSize:11, marginTop:6, paddingTop:6, borderTop:"1px solid "+BORDER}}>
                  <span style={{color:DIM, fontWeight:"bold"}}>Total</span>
                  <span style={{color:GOLD, fontWeight:"bold"}}>{shoppingGold.toLocaleString()}g</span>
                </div>
              </div>
              <div style={{borderTop:"1px solid "+BORDER, marginTop:10, paddingTop:10}}>
                <div style={{fontSize:10, color:DIM, marginBottom:6}}>Profit per craft (innates + pets + #1 combo):</div>
                {rowJ("Material cost", matCost.toFixed(0)+"g")}
                {optimalProfit && rowJ("Profit/craft", optimalProfit.ppc.toFixed(0)+"g", optimalProfit.ppc>=0?"#60c060":"#e06060")}
                {optimalProfit && <React.Fragment>
                  <div style={{borderTop:"1px solid "+BORDER, marginTop:6, paddingTop:6}}>
                    <div style={{fontSize:10, color:DIM, marginBottom:4}}>Daily estimate:</div>
                    {rowJ("Crafts/day", optimalProfit.dailyCrafts.toFixed(1)+"  ("+(optimalProfit.slotLimited?"slot-limited":"energy-limited")+")")}
                    {rowJ("Daily profit", optimalProfit.daily.toFixed(0)+"g", optimalProfit.daily>=0?"#60c060":"#e06060")}
                  </div>
                </React.Fragment>}
              </div>
            </div>

            <div style={panelStyle}>
              <div style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1, marginBottom:12}}>INNATE BONUSES</div>
              {INNATE_STATS.map(function(stat){
                return <StatCounter key={stat} stat={stat} value={p.innate[stat]||0} onChange={function(v){setIn(stat,v);}}/>;
              })}
            </div>

            <div style={panelStyle}>
              <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:4}}>PET BONUSES</div>
              <div style={{fontSize:10, color:DIM, marginBottom:12}}>Legendary pets provide [Special] bonuses in 0.5% increments</div>
              {PET_STATS.map(function(stat){
                return <StatCounter key={stat} stat={stat} value={p.innate[stat]||0} onChange={function(v){setIn(stat,v);}}/>;
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:12}}>AVAILABLE STRUCTURES</div>
            {STRUCTURES.map(function(s){
              var on = p.structs.indexOf(s.id)>=0;
              return (
                <div key={s.id} onClick={function(){togS(s.id);}}
                  style={{display:"flex", gap:8, alignItems:"flex-start", marginBottom:10, cursor:"pointer"}}>
                  <Checkbox checked={on} onChange={function(){togS(s.id);}} color="#2d6aad"/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:12, color:on?TEXT:"#3a5060", fontWeight:on?"600":"normal"}}>{s.name}</div>
                    <div style={{fontSize:10, color:"#3a5060"}}>{s.acq}</div>
                    <div style={{fontSize:10, color:"#4a6878", wordBreak:"break-word"}}>
                      {Object.keys(s.bonuses).map(function(k){ return (STATS[k]?STATS[k].label:k)+" "+fmtBonus(k,s.bonuses[k]); }).join(" / ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={panelStyle}>
            <div style={{fontSize:10, color:"#cf9a5b", fontWeight:"bold", letterSpacing:1, marginBottom:12}}>AVAILABLE OUTFITS</div>
            {OUTFITS.map(function(o){
              var on = p.outfits.indexOf(o.id)>=0;
              return (
                <div key={o.id} onClick={function(){togO(o.id);}}
                  style={{display:"flex", gap:8, alignItems:"flex-start", marginBottom:10, cursor:"pointer"}}>
                  <Checkbox checked={on} onChange={function(){togO(o.id);}} color="#ad6a2d"/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:12, color:on?TEXT:"#3a5060", fontWeight:on?"600":"normal"}}>{o.name}</div>
                    <div style={{fontSize:10, color:"#4a6878", wordBreak:"break-word"}}>
                      {Object.keys(o.bonuses).map(function(k){ return (STATS[k]?STATS[k].label:k)+" "+fmtBonus(k,o.bonuses[k]); }).join(" / ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        <div>
          {cappedInnate.length > 0 && (
            <div style={Object.assign({},panelStyle,{background:"#18120a", borderColor:"#5a4010", padding:10, marginBottom:10})}>
              <div style={{fontSize:11, color:"#e0a040", marginBottom:5}}>Innate stats at cap - bonuses wasted:</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                {cappedInnate.map(function(k){
                  return <span key={k} style={{background:"#2a1a08", border:"1px solid #6a4010", color:"#c08030", borderRadius:4, padding:"2px 8px", fontSize:11}}>
                    {STATS[k]?STATS[k].label:k} (={CAPS[k]}%)
                  </span>;
                })}
              </div>
            </div>
          )}
          <div style={Object.assign({},panelStyle,{padding:"8px 14px", marginBottom:10, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center"})}>
            <span style={{fontSize:11, color:DIM}}>Structure slots: <span style={{color:GOLD, fontWeight:"bold"}}>{sSlots}</span></span>
            <span style={{fontSize:11, color:DIM}}>Outfit slots: <span style={{color:GOLD, fontWeight:"bold"}}>{oSlots}</span></span>
            <span style={{fontSize:11, color:DIM}}>Abidos: <span style={{color:TEXT}}>{prices.abidosPrice}g</span></span>
            {optimalProfit && <span style={{fontSize:11, color:DIM}}>Daily profit: <span style={{color:optimalProfit.daily>=0?"#60c060":"#e06060", fontWeight:"bold"}}>{Math.round(optimalProfit.daily).toLocaleString()}g</span> <span style={{color:"#3a5a6a"}}>({optimalProfit.slotLimited ? "slot-limited" : "energy-limited"})</span></span>}
            <span style={{fontSize:11, color:DIM}}>Weights - cost: <span style={{color:TEXT}}>{W.specialCost.toFixed(0)}</span> / energy: <span style={{color:TEXT}}>{fullSlots?W.specialEnergy.toFixed(0):"off"}</span> / GSC: <span style={{color:TEXT}}>{W.specialGSC.toFixed(1)}</span></span>
          </div>
          {results.length===0
            ? <div style={Object.assign({},panelStyle,{textAlign:"center", color:"#e06060", padding:30})}>Enable more items in Configuration.</div>
            : results.map(function(r,i){ return <ResultCard key={i} r={r} rank={i} innate={p.innate}/>; })
          }
        </div>
      )}
    </div>
  );
}