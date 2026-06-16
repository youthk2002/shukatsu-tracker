import { useState, useEffect } from "react";

const STATUS_OPTIONS = ["未着手", "ES作成中", "ES提出済", "書類選考中", "面接準備中", "一次面接", "二次面接", "最終面接", "内定", "不合格", "辞退"];

const STATUS_COLORS = {
  "未着手": "#94a3b8", "ES作成中": "#f59e0b", "ES提出済": "#3b82f6",
  "書類選考中": "#8b5cf6", "面接準備中": "#06b6d4", "一次面接": "#10b981",
  "二次面接": "#059669", "最終面接": "#0d9488", "内定": "#16a34a",
  "不合格": "#ef4444", "辞退": "#6b7280",
};

const PHASES = [
  { key: "summer", label: "夏インターン", color: "#f97316" },
  { key: "winter", label: "冬インターン", color: "#0ea5e9" },
  { key: "honsen", label: "本選考",       color: "#8b5cf6" },
];

const EMPTY_PHASE = { esDeadline: "", briefingDate: "", status: "未着手", memo: "" };
const EMPTY_FORM  = { company: "", summer: {...EMPTY_PHASE}, winter: {...EMPTY_PHASE}, honsen: {...EMPTY_PHASE} };

const WEEKDAYS = ["日","月","火","水","木","金","土"];

function formatDate(d) {
  if (!d) return "―";
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}
function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(d) - today) / 86400000);
}
function toYMD(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}-${String(dateObj.getDate()).padStart(2,"0")}`;
}

function DeadlineBadge({ dateStr, label }) {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  let bg="#e2e8f0", color="#475569";
  if (days<0)       {bg="#fee2e2";color="#b91c1c";}
  else if (days<=3) {bg="#fef3c7";color="#b45309";}
  else if (days<=7) {bg="#fef9c3";color="#854d0e";}
  return (
    <span style={{background:bg,color,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,marginRight:4}}>
      {label} {formatDate(dateStr)}
      <span style={{marginLeft:4,fontWeight:400}}>
        {days<0?`(${Math.abs(days)}日超過)`:days===0?"(今日)":`(あと${days}日)`}
      </span>
    </span>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div style={{marginBottom:6}}>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>{label}</div>
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        <input type="date" value={value} onChange={e=>onChange(e.target.value)}
          style={{flex:1,border:"1px solid #e2e8f0",borderRadius:7,padding:"6px 8px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        {value && <button onClick={()=>onChange("")}
          style={{background:"#fee2e2",border:"none",borderRadius:6,padding:"5px 9px",cursor:"pointer",color:"#b91c1c",fontWeight:700,fontSize:12}}>✕</button>}
      </div>
    </div>
  );
}

function PhaseForm({ phaseKey, phaseLabel, phaseColor, data, onChange }) {
  const [open, setOpen] = useState(false);
  const hasData = data.esDeadline || data.briefingDate || data.status !== "未着手" || data.memo;
  return (
    <div style={{border:`1.5px solid ${open?phaseColor:"#e2e8f0"}`,borderRadius:10,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:"100%",background:open?phaseColor+"11":"#f8fafc",border:"none",padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:10,height:10,borderRadius:"50%",background:hasData?phaseColor:"#cbd5e1",display:"inline-block"}}/>
          <span style={{fontWeight:700,fontSize:13,color:open?phaseColor:"#475569"}}>{phaseLabel}</span>
          {!open && hasData && (
            <span style={{fontSize:11,color:"#94a3b8"}}>
              {data.esDeadline&&`ES ${formatDate(data.esDeadline)}`}
              {data.esDeadline&&data.briefingDate&&" · "}
              {data.briefingDate&&`説明会 ${formatDate(data.briefingDate)}`}
              {" · "+data.status}
            </span>
          )}
        </div>
        <span style={{color:"#94a3b8",fontSize:12}}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{padding:"12px 14px",background:"#fff"}}>
          <DateField label="ES締切日" value={data.esDeadline} onChange={v=>onChange({...data,esDeadline:v})}/>
          <DateField label="説明会日程" value={data.briefingDate} onChange={v=>onChange({...data,briefingDate:v})}/>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>選考ステータス</div>
            <select value={data.status} onChange={e=>onChange({...data,status:e.target.value})}
              style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:7,padding:"6px 8px",fontSize:13,background:"#fff",outline:"none"}}>
              {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>メモ</div>
            <textarea value={data.memo} onChange={e=>onChange({...data,memo:e.target.value})} placeholder="備考など"
              style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:7,padding:"6px 8px",fontSize:13,resize:"vertical",height:56,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── カレンダービュー ──────────────────────────────────────
function CalendarView({ entries, onEdit }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // その月のイベントをday→[{company,phase,type,color}]に変換
  const eventMap = {};
  entries.forEach(entry => {
    PHASES.forEach(p => {
      const d = entry[p.key];
      if (!d) return;
      [{key:"esDeadline",label:"ES締切"},{key:"briefingDate",label:"説明会"}].forEach(({key,label}) => {
        const ds = d[key];
        if (!ds) return;
        const dt = new Date(ds);
        if (dt.getFullYear()===year && dt.getMonth()===month) {
          const day = dt.getDate();
          if (!eventMap[day]) eventMap[day]=[];
          eventMap[day].push({company:entry.company, phase:p.label, label, color:p.color, entry});
        }
      });
    });
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);

  const prevMonth=()=>{ if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMonth=()=>{ if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const isToday=(d)=> d && today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;

  return (
    <div style={{padding:"16px 24px"}}>
      {/* 月ナビ */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <button onClick={prevMonth} style={navBtn}>＜</button>
        <span style={{fontWeight:700,fontSize:17,color:"#1e293b"}}>{year}年 {month+1}月</span>
        <button onClick={nextMonth} style={navBtn}>＞</button>
      </div>

      {/* 曜日ヘッダー */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
        {WEEKDAYS.map((w,i)=>(
          <div key={w} style={{textAlign:"center",fontSize:12,fontWeight:700,padding:"4px 0",
            color:i===0?"#ef4444":i===6?"#3b82f6":"#94a3b8"}}>
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((day,idx)=>{
          const events = day ? (eventMap[day]||[]) : [];
          const dow = idx%7;
          return (
            <div key={idx} style={{
              minHeight:72, background: day?(isToday(day)?"#eff6ff":"#fff"):"#f8fafc",
              borderRadius:8, padding:"4px 5px",
              border: isToday(day)?"1.5px solid #3b82f6":"1px solid #e2e8f0",
            }}>
              {day && (
                <>
                  <div style={{fontSize:12,fontWeight:isToday(day)?700:400,
                    color:dow===0?"#ef4444":dow===6?"#3b82f6":isToday(day)?"#3b82f6":"#475569",
                    marginBottom:3}}>
                    {day}
                  </div>
                  {events.slice(0,3).map((ev,i)=>(
                    <div key={i} onClick={()=>onEdit(ev.entry)}
                      title={`${ev.company} [${ev.phase}] ${ev.label}`}
                      style={{background:ev.color+"22",color:ev.color,borderRadius:4,
                        fontSize:10,fontWeight:600,padding:"1px 4px",marginBottom:2,
                        cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                      {ev.label==="ES締切"?"📋":"📅"} {ev.company}
                    </div>
                  ))}
                  {events.length>3 && (
                    <div style={{fontSize:10,color:"#94a3b8"}}>+{events.length-3}件</div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 凡例 */}
      <div style={{marginTop:14,display:"flex",gap:16,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#64748b"}}>📋 ES締切　📅 説明会</span>
        {PHASES.map(p=>(
          <span key={p.key} style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:10,height:10,borderRadius:3,background:p.color,display:"inline-block"}}/>
            <span style={{color:"#64748b"}}>{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const navBtn = {background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:15,color:"#475569",fontWeight:700};

// ── メイン ────────────────────────────────────────────────
export default function App() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPhase, setFilterPhase] = useState("すべて");
  const [filterStatus, setFilterStatus] = useState("すべて");
  const [sortKey, setSortKey] = useState("esDeadline");
  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"

  useEffect(()=>{
    try { const s=localStorage.getItem("shukatsu-tracker-v2"); if(s) setEntries(JSON.parse(s)); } catch{}
  },[]);
  useEffect(()=>{
    try { localStorage.setItem("shukatsu-tracker-v2", JSON.stringify(entries)); } catch{}
  },[entries]);

  function handleSubmit() {
    if (!form.company.trim()) return;
    if (editId!==null) {
      setEntries(entries.map(e=>e.id===editId?{...form,id:editId}:e));
      setEditId(null);
    } else {
      setEntries([...entries,{...form,id:Date.now()}]);
    }
    setForm(EMPTY_FORM); setShowForm(false);
  }
  function handleEdit(entry) {
    setForm({company:entry.company,summer:entry.summer||{...EMPTY_PHASE},winter:entry.winter||{...EMPTY_PHASE},honsen:entry.honsen||{...EMPTY_PHASE}});
    setEditId(entry.id); setShowForm(true);
  }
  function handleDelete(id) {
    if(window.confirm("削除しますか？")) setEntries(entries.filter(e=>e.id!==id));
  }
  function handleCancel() { setForm(EMPTY_FORM); setEditId(null); setShowForm(false); }

  function getNextDeadline(entry) {
    const dates=PHASES.map(p=>entry[p.key]?.esDeadline).filter(Boolean);
    return dates.length ? dates.sort()[0] : null;
  }

  const filtered = entries.filter(e=>{
    const ms=e.company.includes(search);
    const mp=filterPhase==="すべて"||PHASES.some(p=>p.label===filterPhase&&(e[p.key]?.esDeadline||e[p.key]?.briefingDate||e[p.key]?.status!=="未着手"));
    const mst=filterStatus==="すべて"||PHASES.some(p=>e[p.key]?.status===filterStatus);
    return ms&&mp&&mst;
  }).sort((a,b)=>{
    if(sortKey==="esDeadline"){const da=getNextDeadline(a),db=getNextDeadline(b);if(!da)return 1;if(!db)return -1;return new Date(da)-new Date(db);}
    return a.company.localeCompare(b.company,"ja");
  });

  const urgentCount=entries.filter(e=>PHASES.some(p=>{const d=daysUntil(e[p.key]?.esDeadline);return d!==null&&d>=0&&d<=7;})).length;

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Hiragino Sans','Meiryo',sans-serif"}}>
      {/* ヘッダー */}
      <div style={{background:"#1e293b",padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{color:"#fff",fontSize:20,fontWeight:700}}>就活トラッカー</div>
          <div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>
            {entries.length}社登録中
            {urgentCount>0&&<span style={{color:"#fbbf24",marginLeft:8}}>⚠️ {urgentCount}社が締切7日以内</span>}
          </div>
        </div>
        <button onClick={()=>{setShowForm(true);setEditId(null);setForm(EMPTY_FORM);}}
          style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          ＋ 企業を追加
        </button>
      </div>

      {/* フォームモーダル */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"24px 0"}}>
          <div style={{background:"#fff",borderRadius:14,padding:24,width:"min(500px,95vw)",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:16,color:"#1e293b"}}>
              {editId!==null?"企業情報を編集":"企業を追加"}
            </div>
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>企業名 *</label>
              <input style={inputStyle} value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="例：旭化成"/>
            </div>
            {PHASES.map(p=>(
              <PhaseForm key={p.key} phaseKey={p.key} phaseLabel={p.label} phaseColor={p.color}
                data={form[p.key]} onChange={v=>setForm({...form,[p.key]:v})}/>
            ))}
            <div style={{display:"flex",gap:10,marginTop:10}}>
              <button onClick={handleSubmit} style={{flex:1,background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"11px 0",fontWeight:700,cursor:"pointer",fontSize:15}}>
                {editId!==null?"更新":"追加"}
              </button>
              <button onClick={handleCancel} style={{flex:1,background:"#f1f5f9",color:"#475569",border:"none",borderRadius:8,padding:"11px 0",fontWeight:600,cursor:"pointer",fontSize:15}}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィルター & ビュー切替 */}
      <div style={{padding:"12px 24px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid #e2e8f0",background:"#fff"}}>
        {/* ビュー切替 */}
        <div style={{display:"flex",background:"#f1f5f9",borderRadius:8,padding:3,marginRight:4}}>
          {[["list","☰ リスト"],["calendar","📅 カレンダー"]].map(([mode,label])=>(
            <button key={mode} onClick={()=>setViewMode(mode)}
              style={{background:viewMode===mode?"#fff":"transparent",border:"none",borderRadius:6,
                padding:"5px 13px",cursor:"pointer",fontSize:12,fontWeight:700,
                color:viewMode===mode?"#1e293b":"#94a3b8",boxShadow:viewMode===mode?"0 1px 3px rgba(0,0,0,0.1)":"none",transition:"all .15s"}}>
              {label}
            </button>
          ))}
        </div>

        {viewMode==="list" && <>
          <input style={{border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 12px",fontSize:13,width:150,outline:"none"}}
            placeholder="🔍 企業名で検索" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={filterStyle} value={filterPhase} onChange={e=>setFilterPhase(e.target.value)}>
            <option>すべて</option>
            {PHASES.map(p=><option key={p.key}>{p.label}</option>)}
          </select>
          <select style={filterStyle} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option>すべて</option>
            {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select style={filterStyle} value={sortKey} onChange={e=>setSortKey(e.target.value)}>
            <option value="esDeadline">ES締切順</option>
            <option value="company">企業名順</option>
          </select>
          <span style={{color:"#94a3b8",fontSize:12,marginLeft:"auto"}}>{filtered.length}件</span>
        </>}
      </div>

      {/* コンテンツ */}
      {viewMode==="calendar" ? (
        <CalendarView entries={entries} onEdit={handleEdit}/>
      ) : (
        <div style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:10}}>
          {filtered.length===0 && (
            <div style={{textAlign:"center",color:"#94a3b8",marginTop:60,fontSize:15}}>
              {entries.length===0?"「＋ 企業を追加」から登録してみましょう":"該当する企業が見つかりません"}
            </div>
          )}
          {filtered.map(entry=>(
            <div key={entry.id} style={{background:"#fff",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                <span style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{entry.company}</span>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>handleEdit(entry)} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"5px 13px",cursor:"pointer",fontSize:13,color:"#475569",fontWeight:600}}>編集</button>
                  <button onClick={()=>handleDelete(entry.id)} style={{background:"#fee2e2",border:"none",borderRadius:7,padding:"5px 13px",cursor:"pointer",fontSize:13,color:"#b91c1c",fontWeight:600}}>削除</button>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {PHASES.map(p=>{
                  const d=entry[p.key];
                  const hasAny=d&&(d.esDeadline||d.briefingDate||d.status!=="未着手"||d.memo);
                  if(!hasAny) return null;
                  return (
                    <div key={p.key} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",borderLeft:`3px solid ${p.color}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <span style={{fontSize:12,fontWeight:700,color:p.color}}>{p.label}</span>
                        <span style={{background:(STATUS_COLORS[d.status]||"#94a3b8")+"22",color:STATUS_COLORS[d.status]||"#94a3b8",borderRadius:5,padding:"1px 8px",fontSize:11,fontWeight:600}}>
                          {d.status}
                        </span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        <DeadlineBadge dateStr={d.esDeadline} label="ES締切"/>
                        <DeadlineBadge dateStr={d.briefingDate} label="説明会"/>
                      </div>
                      {d.memo&&<div style={{marginTop:5,color:"#64748b",fontSize:12}}>📝 {d.memo}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle = {display:"block",fontSize:13,fontWeight:600,color:"#475569",marginBottom:4};
const inputStyle  = {width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 11px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
const filterStyle = {border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 10px",fontSize:13,background:"#fff",cursor:"pointer"};
