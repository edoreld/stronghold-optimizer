import { useState, useMemo, useEffect } from "react";

const STRUCTURES = [
  { id:"ansm",         name:"ANSM-L",                       acq:"Limited Event",     bonuses:{specialCost:4, specialGSC:2} },
  { id:"acrobat",      name:"Acrobat's Waiting Room",        acq:"Shop (F4)",         bonuses:{specialCost:4, specialTime:2} },
  { id:"sheep",        name:"Glass Sheep",                   acq:"Specialty Item",    bonuses:{specialCost:3, specialTime:1} },
  { id:"cards",        name:"Card-Flipping Game",            acq:"Pet Cookie Shop",   bonuses:{generalCost:2} },
  { id:"divine",       name:"Divine Protection",             acq:"42 Masterpieces",   bonuses:{generalCost:1, specialEnergy:2} },
  { id:"night",        name:"Night of Great Journey",        acq:"Limited/Shop",      bonuses:{generalGSC:2, generalTime:1} },
  { id:"luterra",      name:"Luterra King Statue",           acq:"90% E.Luterra Tome",bonuses:{specialGSC:1, specialEnergy:3} },
  { id:"worldtree",    name:"World Tree Leaves",             acq:"World Tree Leaves", bonuses:{generalTime:2, generalGSC:1} },
  { id:"acrobatweapon",name:"Acrobat's Weapon Display Rack", acq:"Shop/Event",        bonuses:{specialEnergy:4, specialGSC:2} },
];

const OUTFITS = [
  { id:"payla",   name:"Payla – Vern Ball",           bonuses:{specialCost:2, specialGSC:4} },
  { id:"thirain", name:"Thirain – Irresistible Heir",  bonuses:{generalCost:1, generalTime:2} },
  { id:"nia",     name:"Nia – Basic Outfit",           bonuses:{specialCost:1} },
  { id:"nineveh", name:"Nineveh – Cute Maid",          bonuses:{generalGSC:2, generalTime:1} },
];

const CAPS = {
  specialCost:10, generalCost:30,
  specialGSC:10,  specialTime:10,
  specialEnergy:10, generalEnergy:10,
  generalGSC:30,  generalTime:30,
};

const STATS = {
  specialEnergy:{label:"[Special] Crafting Action Energy Consumption",color:"#5ba4cf",pri:1,positive:false},
  specialGSC:   {label:"[Special] Crafting Great Success Chance",     color:"#c080e0",pri:2,positive:true},
  specialCost:  {label:"[Special] Crafting Cost",                     color:"#f0a500",pri:3,positive:false},
  specialTime:  {label:"[Special] Crafting Time",                     color:"#60c890",pri:4,positive:false},
  generalGSC:   {label:"Crafting Great Success Chance",               color:"#9060c0",pri:5,positive:true},
  generalTime:  {label:"Crafting Time",                               color:"#50b070",pri:6,positive:false},
  generalCost:  {label:"Crafting Cost",                               color:"#d4c060",pri:7,positive:false},
  generalEnergy:{label:"Crafting Action Energy",                      color:"#4890bf",pri:8,positive:false},
};

const fmtBonus = (k, v) => `${STATS[k]?.positive ? "+" : "-"}${v}%`;

// ── Dynamic weight computation ────────────────────────────────────────
// Constants derived from user's setup
const BASE_FEE    = 400;   // gold fee before all reductions (332 / 0.83)
const BASE_ENERGY = 288;   // energy/craft before all reductions (275 / 0.955)
const DAILY_ENERGY = 17503; // regen + weekly chests
const ABIDOS_PER_CRAFT = 10;
const BASE_GSC = 0.05;

function computeWeights(prices, innate, fullSlots) {
  const { abidosPrice, timberPrice, tenderPrice, abidosTimberPrice } = prices;

  const materialCost = (33/100 * abidosTimberPrice)
                     + (45/100 * tenderPrice)
                     + (86/100 * timberPrice);

  const innateEnergyRed = (innate.specialEnergy || 0) / 100;
  const innateCostRed   = (innate.generalCost   || 0) / 100;

  const baselineEnergy  = BASE_ENERGY * (1 - innateEnergyRed);
  const baselineFee     = BASE_FEE    * (1 - innateCostRed);
  const dailyCrafts     = DAILY_ENERGY / baselineEnergy;
  const profitPerCraft  = ABIDOS_PER_CRAFT * abidosPrice - materialCost - baselineFee;

  // 1% cost reduction → saves BASE_FEE × 0.01 per craft (materials unaffected)
  const costWeight  = BASE_FEE * 0.01 * dailyCrafts;

  // 1% energy reduction → extra crafts/day × profit/craft
  const extraCrafts  = DAILY_ENERGY / (baselineEnergy * 0.99) - dailyCrafts;
  const energyWeight = fullSlots ? Math.max(0, extraCrafts * profitPerCraft) : 0;

  // 1% GSC (multiplicative from 5% base) → extra expected Abidos/craft
  const gscWeight = BASE_GSC * 0.01 * ABIDOS_PER_CRAFT * abidosPrice * dailyCrafts;

  // Time: small constant (hard to model without knowing queue behaviour precisely)
  const timeWeight = 2;

  return {
    specialCost:   Math.max(1, costWeight),
    generalCost:   Math.max(1, costWeight),
    specialEnergy: Math.max(0, energyWeight),
    generalEnergy: 0,
    specialTime:   timeWeight,
    generalTime:   timeWeight,
    specialGSC:    Math.max(1, gscWeight),
    generalGSC:    Math.max(1, gscWeight),
  };
}

// ── Algorithm ─────────────────────────────────────────────────────────
function combos(arr, k) {
  if (k <= 0) return [[]];
  if (arr.length === 0) return [];
  const [h, ...t] = arr;
  return [...combos(t, k-1).map(c=>[h,...c]), ...combos(t, k)];
}

function calcTotals(structs, outfits, innate) {
  const t = {...innate};
  for (const it of [...structs, ...outfits])
    for (const [k,v] of Object.entries(it.bonuses))
      t[k] = (t[k]||0) + v;
  return t;
}

function effOf(tot) {
  const e = {};
  for (const [k,v] of Object.entries(tot)) e[k] = Math.min(v, CAPS[k]??v);
  return e;
}

function scoreCombo(structs, outfits, innate, sSlots, oSlots, prices) {
  const tot = calcTotals(structs, outfits, innate);
  const e = effOf(tot), ei = effOf(innate);
  const fullSlots = sSlots === 3 && oSlots === 3;
  const W = computeWeights(prices, innate, fullSlots);
  return Object.entries(W).reduce((s,[k,w]) => s + ((e[k]||0) - (ei[k]||0)) * w, 0);
}

function optimize(availS, availO, innate, sSlots, oSlots, prices, n=3) {
  const sk = Math.min(sSlots, availS.length), ok = Math.min(oSlots, availO.length);
  if (sk === 0 || ok === 0) return [];
  const sc = combos(availS, sk), oc = combos(availO, ok);
  const all = [];
  for (const s of sc) for (const o of oc)
    all.push({structs:s, outfits:o, score:scoreCombo(s,o,innate,sSlots,oSlots,prices)});
  return all.sort((a,b)=>b.score-a.score).slice(0,n).map(r=>({
    ...r, tot:calcTotals(r.structs, r.outfits, innate)
  }));
}

// ── Styles ────────────────────────────────────────────────────────────
const BG="#0a1520", PANEL="#111d2b", BORDER="#1e3050", TEXT="#c8d4e0", DIM="#5a7a90", GOLD="#f0a500";

const btnStyle = (active, danger=false) => ({
  background: danger?"#2a0d0d":active?"#1e4070":"#0d1825",
  color: danger?"#e06060":active?"#c8e4ff":DIM,
  border:`1px solid ${danger?"#6a2020":active?"#2d6aad":BORDER}`,
  borderRadius:5, padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit",
});

const panelStyle = {background:PANEL, border:`1px solid ${BORDER}`, borderRadius:8, padding:14, marginBottom:12};

const inputStyle = {
  background:"#0d1825", border:`1px solid ${BORDER}`, color:TEXT,
  borderRadius:4, padding:"3px 8px", fontSize:12, fontFamily:"inherit",
  width:90, textAlign:"right",
};

// ── Sub-components ────────────────────────────────────────────────────
function Checkbox({checked, onChange, color="#2d6aad"}) {
  return (
    <div onClick={onChange} style={{
      width:15, height:15, border:`1.5px solid ${checked?color:"#2a4060"}`,
      borderRadius:3, background:checked?color:"transparent",
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    }}>
      {checked && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
    </div>
  );
}

function SlotPicker({label, value, onChange}) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
      <span style={{fontSize:12, color:TEXT}}>{label}</span>
      <div style={{display:"flex", gap:4}}>
        {[1,2,3].map(n=>(
          <button key={n} onClick={()=>onChange(n)} style={{...btnStyle(value===n), padding:"3px 10px", fontSize:12, minWidth:32}}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function PriceInput({label, value, onChange, suffix="g"}) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
      <span style={{fontSize:11, color:DIM}}>{label}</span>
      <div style={{display:"flex", alignItems:"center", gap:4}}>
        <input type="number" min="0" value={value}
          onChange={e=>onChange(Math.max(0, parseInt(e.target.value)||0))}
          style={inputStyle}/>
        <span style={{fontSize:11, color:DIM, width:12}}>{suffix}</span>
      </div>
    </div>
  );
}

function StatBar({stat, rawTotal=0, innateVal=0}) {
  const cap = CAPS[stat]||100;
  const meta = STATS[stat]||{label:stat, color:"#888", positive:false};
  const effTotal = Math.min(rawTotal, cap);
  const effInnate = Math.min(innateVal, cap);
  const equipGain = Math.max(0, effTotal - effInnate);
  const waste = rawTotal - effTotal;
  const pctInnate = (effInnate/cap)*100;
  const pctEquip  = (equipGain/cap)*100;
  const atCap = effTotal >= cap;
  const sign = meta.positive ? "+" : "-";
  return (
    <div style={{marginBottom:6}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:DIM, marginBottom:2}}>
        <span>{meta.label}</span>
        <span style={{color:waste>0?"#e06060":atCap?GOLD:TEXT}}>
          {sign}{effTotal}% / {cap}%{waste>0?` ⚠ ${waste}% wasted`:""}
        </span>
      </div>
      <div style={{height:5, background:"#0a1420", borderRadius:3, display:"flex", overflow:"hidden"}}>
        {pctInnate>0&&<div style={{height:"100%",width:`${pctInnate}%`,background:"#2a4060"}}/>}
        {pctEquip>0 &&<div style={{height:"100%",width:`${pctEquip}%`, background:waste>0?`${meta.color}70`:meta.color}}/>}
      </div>
    </div>
  );
}

function ResultCard({r, rank, innate}) {
  const activeStats = Object.keys(STATS)
    .filter(s=>(r.tot[s]||0)>0||(innate[s]||0)>0)
    .sort((a,b)=>(STATS[a]?.pri||9)-(STATS[b]?.pri||9));
  const totalWaste = Object.entries(r.tot).reduce((s,[k,v])=>s+Math.max(0,v-(CAPS[k]??v)),0);

  const badges = [];
  if (rank===0) badges.push({txt:"★ OPTIMAL", col:GOLD});
  if (totalWaste>0) badges.push({txt:`⚠ ${totalWaste}% wasted`, col:"#e09040"});
  if (totalWaste===0) badges.push({txt:"✓ No waste", col:"#60c060"});

  return (
    <div style={{
      background:rank===0?"#121d12":PANEL,
      border:`1px solid ${rank===0?"#2a5a2a":BORDER}`,
      borderRadius:8, padding:14, marginBottom:10,
    }}>
      <div style={{display:"flex", alignItems:"center", gap:7, marginBottom:11, flexWrap:"wrap"}}>
        <span style={{background:rank===0?"#205a20":"#1a3a5a", color:"#fff", borderRadius:4, padding:"2px 9px", fontSize:11, fontWeight:"bold"}}>#{rank+1}</span>
        {badges.map((b,i)=><span key={i} style={{fontSize:11, color:b.col}}>{b.txt}</span>)}
        <span style={{marginLeft:"auto", fontSize:11, color:DIM}}>score {r.score.toFixed(0)}</span>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:11}}>
        <div>
          <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>STRUCTURES</div>
          {r.structs.map(s=>(
            <div key={s.id} style={{marginBottom:4, textAlign:"left"}}>
              <span style={{fontSize:12, color:TEXT}}>• {s.name}</span>
              <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                {Object.entries(s.bonuses).map(([k,v])=>`${STATS[k]?.label||k} ${fmtBonus(k,v)}`).join("  ·  ")}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:10, color:"#cf9a5b", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>OUTFITS</div>
          {r.outfits.map(o=>(
            <div key={o.id} style={{marginBottom:4, textAlign:"left"}}>
              <span style={{fontSize:12, color:TEXT}}>• {o.name}</span>
              <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                {Object.entries(o.bonuses).map(([k,v])=>`${STATS[k]?.label||k} ${fmtBonus(k,v)}`).join("  ·  ")}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{borderTop:`1px solid ${BORDER}`, paddingTop:8}}>
        {activeStats.map(s=><StatBar key={s} stat={s} rawTotal={r.tot[s]||0} innateVal={innate[s]||0}/>)}
      </div>
    </div>
  );
}

// ── Defaults ──────────────────────────────────────────────────────────
const DEF_INNATE = {specialEnergy:3, specialGSC:0, specialCost:0, specialTime:3, generalGSC:3, generalTime:6, generalCost:4, generalEnergy:0};
const DEF_STRUCTS = ["acrobat","sheep","cards","divine","luterra","worldtree","acrobatweapon"];
const DEF_OUTFITS = ["payla","thirain","nia","nineveh"];
const DEF_PRICES  = {abidosPrice:150, timberPrice:155, tenderPrice:309, abidosTimberPrice:2049};
const DEF_SSLOTS  = 3, DEF_OSLOTS = 3;

const LS_KEY    = "stronghold-optimizer-profiles";
const LS_IDX    = "stronghold-optimizer-idx";
const LS_PRICES = "stronghold-optimizer-prices";

function loadProfiles() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.length) return p.map(x=>({
        structureSlots:DEF_SSLOTS, outfitSlots:DEF_OSLOTS, ...x,
      }));
    }
  } catch {}
  return [{id:1, name:"Main", innate:{...DEF_INNATE}, structs:[...DEF_STRUCTS], outfits:[...DEF_OUTFITS], structureSlots:DEF_SSLOTS, outfitSlots:DEF_OSLOTS}];
}

function loadPrices() {
  try {
    const raw = localStorage.getItem(LS_PRICES);
    if (raw) return {...DEF_PRICES, ...JSON.parse(raw)};
  } catch {}
  return {...DEF_PRICES};
}

function loadIdx(profiles) {
  try { const i = parseInt(localStorage.getItem(LS_IDX)||"0"); return Math.min(i,profiles.length-1); } catch {}
  return 0;
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [idx, setIdx]           = useState(()=>loadIdx(loadProfiles()));
  const [prices, setPrices]     = useState(loadPrices);
  const [tab, setTab]           = useState("opt");
  const [newName, setNewName]   = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState("");

  useEffect(()=>{ try{localStorage.setItem(LS_KEY,JSON.stringify(profiles));}catch{} },[profiles]);
  useEffect(()=>{ try{localStorage.setItem(LS_IDX,String(idx));}catch{} },[idx]);
  useEffect(()=>{ try{localStorage.setItem(LS_PRICES,JSON.stringify(prices));}catch{} },[prices]);

  const p   = profiles[idx];
  const upd = ch => setProfiles(prev=>prev.map((x,i)=>i===idx?{...x,...ch}:x));
  const togS = id => upd({structs:p.structs.includes(id)?p.structs.filter(x=>x!==id):[...p.structs,id]});
  const togO = id => upd({outfits:p.outfits.includes(id)?p.outfits.filter(x=>x!==id):[...p.outfits,id]});
  const setIn    = (k,v) => upd({innate:{...p.innate,[k]:Math.max(0,parseInt(v)||0)}});
  const setPrice = (k,v) => setPrices(prev=>({...prev,[k]:v}));

  const addProf = () => {
    if (!newName.trim()) return;
            setProfiles(prev=>[...prev,{id:Date.now(),name:newName.trim(),innate:{...DEF_INNATE},structs:[...DEF_STRUCTS],outfits:[...DEF_OUTFITS],structureSlots:DEF_SSLOTS,outfitSlots:DEF_OSLOTS}]);
    setIdx(profiles.length);
    setNewName("");
  };
  const delProf = () => {
    if (profiles.length<=1) return;
    setProfiles(prev=>prev.filter((_,i)=>i!==idx));
    setIdx(Math.max(0,idx-1));
  };
  const renameProf = () => { if(nameInput.trim()) upd({name:nameInput.trim()}); setEditingName(false); };

  const availS  = STRUCTURES.filter(s=>p.structs.includes(s.id));
  const availO  = OUTFITS.filter(o=>p.outfits.includes(o.id));
  const sSlots  = p.structureSlots ?? DEF_SSLOTS;
  const oSlots  = p.outfitSlots    ?? DEF_OSLOTS;
  const fullSlots = sSlots===3 && oSlots===3;
  const W = computeWeights(prices, p.innate, fullSlots);

  const results = useMemo(()=>optimize(availS,availO,p.innate,sSlots,oSlots,prices),
    // eslint-disable-next-line
    [availS.map(s=>s.id).join(),availO.map(o=>o.id).join(),JSON.stringify(p.innate),sSlots,oSlots,JSON.stringify(prices)]);

  const cappedInnate = Object.entries(p.innate).filter(([k,v])=>CAPS[k]&&v>=CAPS[k]);

  const materialCost = (33/100*prices.abidosTimberPrice)+(45/100*prices.tenderPrice)+(86/100*prices.timberPrice);
  const profitPerCraft = 10*prices.abidosPrice - materialCost - BASE_FEE*(1-(p.innate.generalCost||0)/100);

  return (
    <div style={{background:BG,color:TEXT,minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",padding:12,fontSize:13}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:18,fontWeight:"bold",color:GOLD}}>⚒ Stronghold Optimizer</div>
        <div style={{fontSize:11,color:DIM}}>Abidos Fusion Material profit maximizer — Lost Ark T4</div>
      </div>

      {/* Profile bar */}
      <div style={{...panelStyle,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",padding:10}}>
        <span style={{fontSize:10,color:DIM,fontWeight:"bold",letterSpacing:1}}>PROFILE</span>
        {profiles.map((pf,i)=><button key={pf.id} style={btnStyle(i===idx)} onClick={()=>setIdx(i)}>{pf.name}</button>)}
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProf()} placeholder="New profile…"
          style={{background:"#0d1825",border:`1px solid ${BORDER}`,color:TEXT,borderRadius:4,padding:"4px 8px",fontSize:11,width:120,fontFamily:"inherit"}}/>
        <button style={btnStyle(false)} onClick={addProf}>+ Add</button>
        {profiles.length>1&&<button style={btnStyle(false,true)} onClick={delProf}>✕ Delete</button>}
        {editingName
          ? <><input value={nameInput} onChange={e=>setNameInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")renameProf();if(e.key==="Escape")setEditingName(false);}}
              style={{background:"#0d1825",border:`1px solid #2d6aad`,color:TEXT,borderRadius:4,padding:"4px 8px",fontSize:11,width:120,fontFamily:"inherit"}} autoFocus/>
              <button style={btnStyle(true)} onClick={renameProf}>✓</button></>
          : <button style={btnStyle(false)} onClick={()=>{setNameInput(p.name);setEditingName(true);}}>✎ Rename</button>}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        {[["opt","⚡ Optimizer"],["cfg","⚙ Configuration"]].map(([id,lbl])=>(
          <button key={id} style={{...btnStyle(tab===id),padding:"6px 18px",fontSize:13}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab==="cfg" ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {/* Left col */}
          <div>
            <div style={panelStyle}>
              <div style={{fontSize:10,color:DIM,fontWeight:"bold",letterSpacing:1,marginBottom:12}}>SLOT CONFIGURATION</div>
              <SlotPicker label="Structure slots" value={sSlots} onChange={v=>upd({structureSlots:v})}/>
              <SlotPicker label="Outfit slots"    value={oSlots} onChange={v=>upd({outfitSlots:v})}/>
            </div>

            <div style={panelStyle}>
              <div style={{fontSize:10,color:GOLD,fontWeight:"bold",letterSpacing:1,marginBottom:12}}>MARKET PRICES</div>
              <PriceInput label="Abidos (per unit)"       value={prices.abidosPrice}       onChange={v=>setPrice("abidosPrice",v)}/>
              <div style={{borderTop:`1px solid ${BORDER}`,margin:"8px 0"}}/>
              <div style={{fontSize:10,color:DIM,marginBottom:6}}>Stack of 100:</div>
              <PriceInput label="Timber"                  value={prices.timberPrice}        onChange={v=>setPrice("timberPrice",v)}/>
              <PriceInput label="Tender Timber"           value={prices.tenderPrice}        onChange={v=>setPrice("tenderPrice",v)}/>
              <PriceInput label="Abidos Timber"           value={prices.abidosTimberPrice}  onChange={v=>setPrice("abidosTimberPrice",v)}/>
              <div style={{borderTop:`1px solid ${BORDER}`,marginTop:10,paddingTop:10}}>
                <div style={{fontSize:10,color:DIM,marginBottom:4}}>Derived per craft:</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                  <span style={{color:DIM}}>Material cost</span>
                  <span style={{color:TEXT}}>{materialCost.toFixed(0)}g</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:3}}>
                  <span style={{color:DIM}}>Profit (at innate only)</span>
                  <span style={{color:profitPerCraft>0?"#60c060":"#e06060"}}>{profitPerCraft.toFixed(0)}g</span>
                </div>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={{fontSize:10,color:DIM,fontWeight:"bold",letterSpacing:1,marginBottom:12}}>INNATE / PET BONUSES</div>
              {Object.keys(STATS).map(stat=>{
                const cap=CAPS[stat],v=p.innate[stat]||0,capped=cap&&v>=cap;
                return (
                  <div key={stat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:11,color:capped?"#e08050":DIM}}>{STATS[stat].label}{capped?" ⚠":""}</span>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                      <button onClick={()=>setIn(stat,v-1)} style={{...btnStyle(false),padding:"1px 6px",fontSize:13}}>−</button>
                      <span style={{width:28,textAlign:"center",fontSize:13,color:capped?"#e08050":TEXT}}>{v}%</span>
                      <button onClick={()=>setIn(stat,v+1)} style={{...btnStyle(false),padding:"1px 6px",fontSize:13}}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Structures */}
          <div style={panelStyle}>
            <div style={{fontSize:10,color:"#5ba4cf",fontWeight:"bold",letterSpacing:1,marginBottom:12}}>AVAILABLE STRUCTURES</div>
            {STRUCTURES.map(s=>{
              const on=p.structs.includes(s.id);
              return (
                <div key={s.id} onClick={()=>togS(s.id)} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:10,cursor:"pointer",textAlign:"left"}}>
                  <Checkbox checked={on} onChange={()=>togS(s.id)} color="#2d6aad"/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:12,color:on?TEXT:"#3a5060",fontWeight:on?"600":"normal"}}>{s.name}</div>
                    <div style={{fontSize:10,color:"#3a5060"}}>{s.acq}</div>
                    <div style={{fontSize:10,color:"#4a6878",wordBreak:"break-word"}}>
                      {Object.entries(s.bonuses).map(([k,v])=>`${STATS[k]?.label||k} ${fmtBonus(k,v)}`).join(" · ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outfits */}
          <div style={panelStyle}>
            <div style={{fontSize:10,color:"#cf9a5b",fontWeight:"bold",letterSpacing:1,marginBottom:12}}>AVAILABLE OUTFITS</div>
            {OUTFITS.map(o=>{
              const on=p.outfits.includes(o.id);
              return (
                <div key={o.id} onClick={()=>togO(o.id)} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:10,cursor:"pointer",textAlign:"left"}}>
                  <Checkbox checked={on} onChange={()=>togO(o.id)} color="#ad6a2d"/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:12,color:on?TEXT:"#3a5060",fontWeight:on?"600":"normal"}}>{o.name}</div>
                    <div style={{fontSize:10,color:"#4a6878",wordBreak:"break-word"}}>
                      {Object.entries(o.bonuses).map(([k,v])=>`${STATS[k]?.label||k} ${fmtBonus(k,v)}`).join(" · ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {cappedInnate.length>0&&(
            <div style={{...panelStyle,background:"#18120a",borderColor:"#5a4010",padding:10,marginBottom:10}}>
              <div style={{fontSize:11,color:"#e0a040",marginBottom:5}}>⚠ Innate stats already at cap — equipment bonuses to these are fully wasted:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cappedInnate.map(([k,v])=>(
                  <span key={k} style={{background:"#2a1a08",border:"1px solid #6a4010",color:"#c08030",borderRadius:4,padding:"2px 8px",fontSize:11}}>
                    {STATS[k]?.label} ({fmtBonus(k,Math.min(v,CAPS[k]))} = cap)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary bar */}
          <div style={{...panelStyle,padding:"8px 14px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:DIM}}>Structure slots: <span style={{color:GOLD,fontWeight:"bold"}}>{sSlots}</span></span>
            <span style={{fontSize:11,color:DIM}}>Outfit slots: <span style={{color:GOLD,fontWeight:"bold"}}>{oSlots}</span></span>
            <span style={{fontSize:11,color:DIM}}>Abidos price: <span style={{color:TEXT}}>{prices.abidosPrice}g</span></span>
            <span style={{fontSize:11,color:DIM}}>Profit/craft: <span style={{color:profitPerCraft>0?"#60c060":"#e06060"}}>{profitPerCraft.toFixed(0)}g</span></span>
            <span style={{fontSize:11,color:DIM}}>
              Weights — cost: <span style={{color:TEXT}}>{W.specialCost.toFixed(0)}</span>
              {" · "}energy: <span style={{color:TEXT}}>{fullSlots?W.specialEnergy.toFixed(0):"off (not 3×3)"}</span>
              {" · "}GSC: <span style={{color:TEXT}}>{W.specialGSC.toFixed(1)}</span>
            </span>
          </div>

          {results.length===0
            ? <div style={{...panelStyle,textAlign:"center",color:"#e06060",padding:30}}>Enable more items in Configuration to generate recommendations.</div>
            : results.map((r,i)=><ResultCard key={i} r={r} rank={i} innate={p.innate}/>)
          }
        </div>
      )}
    </div>
  );
}