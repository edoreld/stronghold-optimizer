import { useState, useMemo, useEffect } from "react";

// ── Data ─────────────────────────────────────────────────────────────
const STRUCTURES = [
  { id:"ansm",    name:"ANSM-L",                 acq:"Limited Event",       bonuses:{specialCost:4, specialGSC:2} },
  { id:"acrobat", name:"Acrobat's Waiting Room",  acq:"Shop (F4)",           bonuses:{specialCost:4, specialTime:2} },
  { id:"sheep",   name:"Glass Sheep",             acq:"Specialty Item",      bonuses:{specialCost:3, specialTime:1} },
  { id:"cards",   name:"Card-Flipping Game",      acq:"Pet Cookie Shop",     bonuses:{generalCost:2} },
  { id:"divine",  name:"Divine Protection",       acq:"42 Masterpieces",     bonuses:{generalCost:1, specialEnergy:2} },
  { id:"night",   name:"Night of Great Journey",  acq:"Limited/Shop",        bonuses:{generalGSC:2, generalTime:1} },
  { id:"luterra", name:"Luterra King Statue",     acq:"90% E.Luterra Tome",  bonuses:{specialGSC:1, specialEnergy:3} },
  { id:"cannon",  name:"The Cannon (SMT-01)",     acq:"Founders/Rare",       bonuses:{specialEnergy:5} },
];

const OUTFITS = [
  { id:"payla",   name:"Payla – Vern Ball",          bonuses:{specialCost:2, specialGSC:4} },
  { id:"thirain", name:"Thirain – Irresistible Heir", bonuses:{generalCost:1, generalTime:2} },
  { id:"nia",     name:"Nia – Basic Outfit",          bonuses:{specialCost:1} },
  { id:"nineveh", name:"Nineveh – Cute Maid",         bonuses:{generalGSC:2} },
];

const CAPS = {
  specialCost:10, generalCost:30,
  specialGSC:10,  specialTime:10,
  specialEnergy:10, generalEnergy:10,
  generalGSC:30,  generalTime:30,
};

const STATS = {
  specialCost:  {label:"[Sp] Crafting Cost",   color:"#f0a500", pri:1},
  generalCost:  {label:"Crafting Cost",         color:"#d4c060", pri:2},
  specialEnergy:{label:"[Sp] Action Energy",    color:"#5ba4cf", pri:3},
  specialTime:  {label:"[Sp] Crafting Time",    color:"#60c890", pri:4},
  generalEnergy:{label:"Action Energy",         color:"#4890bf", pri:5},
  generalTime:  {label:"Crafting Time",         color:"#50b070", pri:6},
  specialGSC:   {label:"[Sp] Great Success",    color:"#c080e0", pri:7},
  generalGSC:   {label:"Great Success",         color:"#9060c0", pri:8},
};

// Profit weight per 1% effective gain
const W = {
  specialCost:100, specialEnergy:35, generalCost:22,
  generalEnergy:14, specialTime:8,   generalTime:4,
  specialGSC:4,     generalGSC:3,
};

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

function scoreCombo(structs, outfits, innate) {
  const tot = calcTotals(structs, outfits, innate);
  const e = effOf(tot), ei = effOf(innate);
  return Object.entries(W).reduce((s,[k,w])=>s+((e[k]||0)-(ei[k]||0))*w, 0);
}

function optimize(availS, availO, innate, n=3) {
  const sk = Math.min(3, availS.length), ok = Math.min(3, availO.length);
  if (sk === 0 || ok === 0) return [];
  const sc = combos(availS, sk), oc = combos(availO, ok);
  const all = [];
  for (const s of sc) for (const o of oc)
    all.push({structs:s, outfits:o, score:scoreCombo(s,o,innate)});
  return all.sort((a,b)=>b.score-a.score).slice(0,n).map(r=>({
    ...r, tot:calcTotals(r.structs, r.outfits, innate)
  }));
}

// ── Style constants ───────────────────────────────────────────────────
const BG="#0a1520", PANEL="#111d2b", BORDER="#1e3050", TEXT="#c8d4e0", DIM="#5a7a90", GOLD="#f0a500";

const btnStyle = (active, danger=false) => ({
  background: danger ? "#2a0d0d" : active ? "#1e4070" : "#0d1825",
  color: danger ? "#e06060" : active ? "#c8e4ff" : DIM,
  border: `1px solid ${danger ? "#6a2020" : active ? "#2d6aad" : BORDER}`,
  borderRadius:5, padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:"inherit",
});

const panelStyle = {background:PANEL, border:`1px solid ${BORDER}`, borderRadius:8, padding:14, marginBottom:12};

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

function StatBar({stat, rawTotal=0, innateVal=0}) {
  const cap = CAPS[stat]||100;
  const meta = STATS[stat]||{label:stat, color:"#888"};
  const effTotal = Math.min(rawTotal, cap);
  const effInnate = Math.min(innateVal, cap);
  const equipGain = Math.max(0, effTotal - effInnate);
  const waste = rawTotal - effTotal;
  const pctInnate = (effInnate/cap)*100;
  const pctEquip = (equipGain/cap)*100;
  const atCap = effTotal >= cap;

  return (
    <div style={{marginBottom:6}}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:DIM, marginBottom:2}}>
        <span>{meta.label}</span>
        <span style={{color: waste>0?"#e06060": atCap?GOLD:TEXT}}>
          -{effTotal}% / {cap}%{waste>0?` ⚠ ${waste}% wasted`:""}
        </span>
      </div>
      <div style={{height:5, background:"#0a1420", borderRadius:3, display:"flex", overflow:"hidden"}}>
        {pctInnate>0 && <div style={{height:"100%", width:`${pctInnate}%`, background:"#2a4060"}}/>}
        {pctEquip>0 && <div style={{height:"100%", width:`${pctEquip}%`, background: waste>0?`${meta.color}70`:meta.color}}/>}
      </div>
    </div>
  );
}

function ResultCard({r, rank, innate}) {
  const activeStats = Object.keys(STATS).filter(s=>(r.tot[s]||0)>0||(innate[s]||0)>0)
    .sort((a,b)=>(STATS[a]?.pri||9)-(STATS[b]?.pri||9));
  const totalWaste = Object.entries(r.tot).reduce((s,[k,v])=>s+Math.max(0,v-(CAPS[k]??v)),0);
  const spCostEff = Math.min(r.tot.specialCost||0, 10);
  const capHit = spCostEff === 10;

  const badges = [];
  if (rank===0) badges.push({txt:"★ OPTIMAL", col:GOLD});
  if (!capHit) badges.push({txt:`⚠ [Sp] Cost ${spCostEff}%/10%`, col:"#e06060"});
  if (totalWaste>0) badges.push({txt:`⚠ ${totalWaste}% wasted`, col:"#e09040"});
  if (capHit && totalWaste===0) badges.push({txt:"✓ No waste", col:"#60c060"});

  return (
    <div style={{
      background:rank===0?"#121d12":PANEL,
      border:`1px solid ${rank===0?"#2a5a2a":BORDER}`,
      borderRadius:8, padding:14, marginBottom:10,
    }}>
      <div style={{display:"flex", alignItems:"center", gap:7, marginBottom:11, flexWrap:"wrap"}}>
        <span style={{
          background:rank===0?"#205a20":"#1a3a5a", color:"#fff",
          borderRadius:4, padding:"2px 9px", fontSize:11, fontWeight:"bold",
        }}>#{rank+1}</span>
        {badges.map((b,i)=>(
          <span key={i} style={{fontSize:11, color:b.col}}>{b.txt}</span>
        ))}
        <span style={{marginLeft:"auto", fontSize:11, color:DIM}}>score {r.score.toFixed(0)}</span>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:11}}>
        <div>
          <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>STRUCTURES</div>
          {r.structs.map(s=>(
            <div key={s.id} style={{marginBottom:4}}>
              <span style={{fontSize:12, color:TEXT}}>• {s.name}</span>
              <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                {Object.entries(s.bonuses).map(([k,v])=>`${STATS[k]?.label||k} -${v}%`).join("  ·  ")}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:10, color:"#cf9a5b", fontWeight:"bold", letterSpacing:1, marginBottom:5}}>OUTFITS</div>
          {r.outfits.map(o=>(
            <div key={o.id} style={{marginBottom:4}}>
              <span style={{fontSize:12, color:TEXT}}>• {o.name}</span>
              <div style={{fontSize:10, color:"#3a5a6a", marginLeft:8}}>
                {Object.entries(o.bonuses).map(([k,v])=>`${STATS[k]?.label||k} -${v}%`).join("  ·  ")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{borderTop:`1px solid ${BORDER}`, paddingTop:8}}>
        {activeStats.map(s=>(
          <StatBar key={s} stat={s} rawTotal={r.tot[s]||0} innateVal={innate[s]||0}/>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
const DEF_INNATE = {specialTime:6, specialEnergy:3, generalGSC:3, generalTime:6, generalCost:4};
const DEF_STRUCTS = ["acrobat","cards","luterra","divine","night"];
const DEF_OUTFITS = ["payla","thirain","nia","nineveh"];
const LS_KEY = "stronghold-optimizer-profiles";
const LS_IDX = "stronghold-optimizer-idx";

function loadProfiles() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.length) return p; }
  } catch {}
  return [{id:1, name:"Main", innate:{...DEF_INNATE}, structs:[...DEF_STRUCTS], outfits:[...DEF_OUTFITS]}];
}

function loadIdx(profiles) {
  try { const i = parseInt(localStorage.getItem(LS_IDX)||"0"); return Math.min(i, profiles.length-1); } catch {}
  return 0;
}

export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [idx, setIdx] = useState(() => loadIdx(loadProfiles()));
  const [tab, setTab] = useState("opt");
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(profiles)); } catch {}
  }, [profiles]);
  useEffect(() => {
    try { localStorage.setItem(LS_IDX, String(idx)); } catch {}
  }, [idx]);

  const p = profiles[idx];
  const upd = ch => setProfiles(prev=>prev.map((x,i)=>i===idx?{...x,...ch}:x));
  const togS = id => upd({structs:p.structs.includes(id)?p.structs.filter(x=>x!==id):[...p.structs,id]});
  const togO = id => upd({outfits:p.outfits.includes(id)?p.outfits.filter(x=>x!==id):[...p.outfits,id]});
  const setIn = (k,v) => upd({innate:{...p.innate,[k]:Math.max(0,parseInt(v)||0)}});

  const addProf = () => {
    if (!newName.trim()) return;
    const np = {id:Date.now(), name:newName.trim(), innate:{...DEF_INNATE}, structs:[...DEF_STRUCTS], outfits:[...DEF_OUTFITS]};
    setProfiles(prev=>[...prev,np]);
    setIdx(profiles.length);
    setNewName("");
  };

  const delProf = () => {
    if (profiles.length<=1) return;
    const ni = Math.max(0,idx-1);
    setProfiles(prev=>prev.filter((_,i)=>i!==idx));
    setIdx(ni);
  };

  const renameProf = () => {
    if (!nameInput.trim()) { setEditingName(false); return; }
    upd({name:nameInput.trim()});
    setEditingName(false);
  };

  const availS = STRUCTURES.filter(s=>p.structs.includes(s.id));
  const availO = OUTFITS.filter(o=>p.outfits.includes(o.id));

  const results = useMemo(()=>optimize(availS, availO, p.innate),
    // eslint-disable-next-line
    [availS.map(s=>s.id).join(), availO.map(o=>o.id).join(), JSON.stringify(p.innate)]);

  const cappedInnate = Object.entries(p.innate).filter(([k,v])=>CAPS[k]&&v>=CAPS[k]);

  return (
    <div style={{background:BG, color:TEXT, minHeight:"100vh", fontFamily:"'Segoe UI',sans-serif", padding:12, fontSize:13}}>

      {/* Header */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:18, fontWeight:"bold", color:GOLD}}>⚒ Stronghold Optimizer</div>
        <div style={{fontSize:11, color:DIM}}>Abidos Fusion Material profit maximizer — Lost Ark T4</div>
      </div>

      {/* Profile bar */}
      <div style={{...panelStyle, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", padding:10}}>
        <span style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1}}>PROFILE</span>
        {profiles.map((pf,i)=>(
          <button key={pf.id} style={btnStyle(i===idx)} onClick={()=>setIdx(i)}>{pf.name}</button>
        ))}
        <input value={newName} onChange={e=>setNewName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addProf()} placeholder="New profile…"
          style={{background:"#0d1825", border:`1px solid ${BORDER}`, color:TEXT, borderRadius:4,
            padding:"4px 8px", fontSize:11, width:120, fontFamily:"inherit"}}/>
        <button style={btnStyle(false)} onClick={addProf}>+ Add</button>
        {profiles.length>1&&<button style={btnStyle(false,true)} onClick={delProf}>✕ Delete</button>}
        {editingName
          ? <>
              <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")renameProf();if(e.key==="Escape")setEditingName(false);}}
                style={{background:"#0d1825", border:`1px solid #2d6aad`, color:TEXT, borderRadius:4,
                  padding:"4px 8px", fontSize:11, width:120, fontFamily:"inherit"}} autoFocus/>
              <button style={btnStyle(true)} onClick={renameProf}>✓</button>
            </>
          : <button style={btnStyle(false)} onClick={()=>{setNameInput(p.name);setEditingName(true);}}>✎ Rename</button>
        }
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:4, marginBottom:12}}>
        {[["opt","⚡ Optimizer"],["cfg","⚙ Configuration"]].map(([id,lbl])=>(
          <button key={id} style={{...btnStyle(tab===id), padding:"6px 18px", fontSize:13}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab==="cfg" ? (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
          {/* Innate bonuses */}
          <div style={panelStyle}>
            <div style={{fontSize:10, color:DIM, fontWeight:"bold", letterSpacing:1, marginBottom:12}}>INNATE / PET BONUSES</div>
            {Object.keys(STATS).map(stat=>{
              const cap=CAPS[stat], v=p.innate[stat]||0, capped=cap&&v>=cap;
              return (
                <div key={stat} style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                  <span style={{fontSize:11, color:capped?"#e08050":DIM}}>
                    {STATS[stat].label}{capped?" ⚠":""}
                  </span>
                  <div style={{display:"flex", alignItems:"center", gap:4}}>
                    <button onClick={()=>setIn(stat,v-1)} style={{...btnStyle(false), padding:"1px 6px", fontSize:13}}>−</button>
                    <span style={{width:28, textAlign:"center", fontSize:13, color:capped?"#e08050":TEXT}}>{v}%</span>
                    <button onClick={()=>setIn(stat,v+1)} style={{...btnStyle(false), padding:"1px 6px", fontSize:13}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structures */}
          <div style={panelStyle}>
            <div style={{fontSize:10, color:"#5ba4cf", fontWeight:"bold", letterSpacing:1, marginBottom:12}}>AVAILABLE STRUCTURES</div>
            {STRUCTURES.map(s=>{
              const on=p.structs.includes(s.id);
              return (
                <div key={s.id} onClick={()=>togS(s.id)}
                  style={{display:"flex", gap:8, alignItems:"flex-start", marginBottom:10, cursor:"pointer"}}>
                  <Checkbox checked={on} onChange={()=>togS(s.id)} color="#2d6aad"/>
                  <div>
                    <div style={{fontSize:12, color:on?TEXT:"#3a5060", fontWeight:on?"600":"normal"}}>{s.name}</div>
                    <div style={{fontSize:10, color:"#3a5060"}}>{s.acq}</div>
                    <div style={{fontSize:10, color:"#4a6878"}}>
                      {Object.entries(s.bonuses).map(([k,v])=>`${STATS[k]?.label||k} -${v}%`).join(" · ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outfits */}
          <div style={panelStyle}>
            <div style={{fontSize:10, color:"#cf9a5b", fontWeight:"bold", letterSpacing:1, marginBottom:12}}>AVAILABLE OUTFITS</div>
            {OUTFITS.map(o=>{
              const on=p.outfits.includes(o.id);
              return (
                <div key={o.id} onClick={()=>togO(o.id)}
                  style={{display:"flex", gap:8, alignItems:"flex-start", marginBottom:10, cursor:"pointer"}}>
                  <Checkbox checked={on} onChange={()=>togO(o.id)} color="#ad6a2d"/>
                  <div>
                    <div style={{fontSize:12, color:on?TEXT:"#3a5060", fontWeight:on?"600":"normal"}}>{o.name}</div>
                    <div style={{fontSize:10, color:"#4a6878"}}>
                      {Object.entries(o.bonuses).map(([k,v])=>`${STATS[k]?.label||k} -${v}%`).join(" · ")}
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
            <div style={{...panelStyle, background:"#18120a", borderColor:"#5a4010", padding:10, marginBottom:10}}>
              <div style={{fontSize:11, color:"#e0a040", marginBottom:5}}>
                ⚠ Innate stats already at cap — equipment bonuses to these are fully wasted:
              </div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                {cappedInnate.map(([k,v])=>(
                  <span key={k} style={{
                    background:"#2a1a08", border:"1px solid #6a4010",
                    color:"#c08030", borderRadius:4, padding:"2px 8px", fontSize:11,
                  }}>
                    {STATS[k]?.label} (-{Math.min(v,CAPS[k])}% = cap)
                  </span>
                ))}
              </div>
            </div>
          )}

          {results.length===0
            ? <div style={{...panelStyle, textAlign:"center", color:"#e06060", padding:30}}>
                Enable more items in Configuration to generate recommendations.
              </div>
            : results.map((r,i)=><ResultCard key={i} r={r} rank={i} innate={p.innate}/>)
          }
        </div>
      )}
    </div>
  );
}