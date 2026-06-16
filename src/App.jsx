import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, LineChart, BarChart,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";

const API_KEY = "XXQUC0AKT8UAFQFJ";

const PERIODS = [
  { label: "1週",   av: "TIME_SERIES_DAILY", outputsize: "compact", days: 7   },
  { label: "1ヶ月", av: "TIME_SERIES_DAILY", outputsize: "compact", days: 30  },
  { label: "3ヶ月", av: "TIME_SERIES_DAILY", outputsize: "compact", days: 90  },
  { label: "6ヶ月", av: "TIME_SERIES_DAILY", outputsize: "full",    days: 180 },
  { label: "1年",   av: "TIME_SERIES_DAILY", outputsize: "full",    days: 365 },
];

const PRESETS = [
  { label: "トヨタ",     symbol: "7203.T", market: "JP", name: "トヨタ自動車" },
  { label: "ソニー",     symbol: "6758.T", market: "JP", name: "ソニーグループ" },
  { label: "任天堂",     symbol: "7974.T", market: "JP", name: "任天堂" },
  { label: "三菱UFJ",   symbol: "8306.T", market: "JP", name: "三菱UFJフィナンシャル" },
  { label: "Apple",     symbol: "AAPL",   market: "US", name: "Apple Inc." },
  { label: "NVIDIA",    symbol: "NVDA",   market: "US", name: "NVIDIA Corporation" },
  { label: "Tesla",     symbol: "TSLA",   market: "US", name: "Tesla, Inc." },
  { label: "Microsoft", symbol: "MSFT",   market: "US", name: "Microsoft Corporation" },
];

const PANELS = [
  { key: "macd",  label: "MACD",             color: "#3b82f6" },
  { key: "bb",    label: "ボリンジャー",      color: "#8b5cf6" },
  { key: "vol",   label: "出来高",            color: "#10b981" },
  { key: "stoch", label: "ストキャスティクス", color: "#f97316" },
  { key: "rsi",   label: "RSI",               color: "#06b6d4" },
];

// ── テクニカル計算 ──────────────────────────────────────
function calcMA(data, n) {
  return data.map((d, i) => ({
    ...d,
    [`ma${n}`]: i < n-1 ? null : parseFloat((data.slice(i-n+1,i+1).reduce((s,x)=>s+x.close,0)/n).toFixed(2)),
  }));
}
function calcBB(data, n=20) {
  return data.map((d,i) => {
    if (i < n-1) return {...d, bbUpper:null, bbLower:null, bbMid:null};
    const sl = data.slice(i-n+1,i+1).map(x=>x.close);
    const mean = sl.reduce((s,v)=>s+v,0)/n;
    const std  = Math.sqrt(sl.reduce((s,v)=>s+(v-mean)**2,0)/n);
    return {...d, bbUpper:parseFloat((mean+2*std).toFixed(2)), bbLower:parseFloat((mean-2*std).toFixed(2)), bbMid:parseFloat(mean.toFixed(2))};
  });
}
function calcMACD(data, fast=12, slow=26, sig=9) {
  function ema(arr, n) {
    const k=2/(n+1); let e=arr[0];
    return arr.map((v,i)=>{ if(i===0)return e; e=v*k+e*(1-k); return e; });
  }
  const closes=data.map(d=>d.close);
  const ef=ema(closes,fast), es=ema(closes,slow);
  const ml=ef.map((v,i)=>v-es[i]);
  const sg=ema(ml,sig);
  return data.map((d,i)=>({
    ...d,
    macd:     i<slow-1   ? null : parseFloat(ml[i].toFixed(3)),
    macdSig:  i<slow+sig-2? null : parseFloat(sg[i].toFixed(3)),
    macdHist: i<slow+sig-2? null : parseFloat((ml[i]-sg[i]).toFixed(3)),
  }));
}
function calcRSI(data, n=14) {
  return data.map((d,i) => {
    if (i<n) return {...d, rsi:null};
    let g=0,l=0;
    for(let j=i-n+1;j<=i;j++){const diff=data[j].close-data[j-1].close; if(diff>0)g+=diff; else l-=diff;}
    const rs=l===0?100:g/l;
    return {...d, rsi:parseFloat((100-100/(1+rs)).toFixed(1))};
  });
}
function calcStoch(data, k=14, d=3) {
  return data.map((d2,i) => {
    if(i<k-1) return {...d2, stochK:null, stochD:null};
    const sl=data.slice(i-k+1,i+1);
    const hh=Math.max(...sl.map(x=>x.high)), ll=Math.min(...sl.map(x=>x.low));
    const kVal=hh===ll?50:parseFloat(((d2.close-ll)/(hh-ll)*100).toFixed(1));
    const dSlice=[];
    for(let j=Math.max(k-1,i-d+1);j<=i;j++){
      const s2=data.slice(j-k+1,j+1);
      const h2=Math.max(...s2.map(x=>x.high)),l2=Math.min(...s2.map(x=>x.low));
      dSlice.push(h2===l2?50:(data[j].close-l2)/(h2-l2)*100);
    }
    const dVal=dSlice.length?parseFloat((dSlice.reduce((s,v)=>s+v,0)/dSlice.length).toFixed(1)):null;
    return {...d2, stochK:kVal, stochD:dVal};
  });
}
function applyIndicators(data) {
  let d=calcMA(calcMA(data,5),25);
  d=calcBB(d); d=calcMACD(d); d=calcRSI(d); d=calcStoch(d);
  return d;
}

// ── ユーティリティ ──────────────────────────────────────
function formatPrice(v, market) {
  if(v==null) return "―";
  return market==="JP"?`¥${Math.round(v).toLocaleString()}`:`$${v.toFixed(2)}`;
}
function fmtD(str) {
  if(!str) return "";
  const d=new Date(str); return `${d.getMonth()+1}/${d.getDate()}`;
}

const TT = ({active,payload,label,market}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"8px 12px",fontSize:11}}>
      <div style={{color:"#94a3b8",marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>p.value!=null&&(
        <div key={i} style={{color:p.color||"#e2e8f0",fontWeight:600}}>
          {p.name}: {p.value>10&&market?formatPrice(p.value,market):p.value}
        </div>
      ))}
    </div>
  );
};

function Signal({label,value,type}) {
  const c={buy:"#22c55e",sell:"#ef4444",neutral:"#94a3b8"}[type];
  return (
    <div style={{background:c+"22",border:`1px solid ${c}`,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
      <div style={{fontSize:10,color:"#64748b",marginBottom:3}}>{label}</div>
      <div style={{fontSize:11,fontWeight:700,color:c}}>{value}</div>
    </div>
  );
}

// ── メイン ──────────────────────────────────────────────
export default function App() {
  const [selected,  setSelected]  = useState(null);
  const [periodIdx, setPeriodIdx] = useState(2);
  const [rawData,   setRawData]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [showMA5,   setShowMA5]   = useState(true);
  const [showMA25,  setShowMA25]  = useState(true);
  const [showBB,    setShowBB]    = useState(false);
  const [panels,    setPanels]    = useState({macd:true,bb:false,vol:true,stoch:false,rsi:false});
  const [aiComment, setAiComment] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");

  const period = PERIODS[periodIdx];

  // Alpha Vantage からデータ取得
  const fetchStock = useCallback(async (preset) => {
    if(!preset) return;
    setLoading(true); setError(""); setRawData([]); setAiComment(null);
    try {
      const url = `https://www.alphavantage.co/query?function=${period.av}&symbol=${preset.symbol}&outputsize=${period.outputsize}&apikey=${API_KEY}`;
      const res = await fetch(url);
      if(!res.ok) throw new Error("取得失敗");
      const json = await res.json();

      // レート制限チェック
      if(json.Note || json.Information) throw new Error("APIの1分あたりのリクエスト上限（5回）に達しました。1分後に再試行してください。");

      const ts = json["Time Series (Daily)"];
      if(!ts) throw new Error("データが見つかりません。ティッカーシンボルを確認してください。");

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period.days);

      const parsed = Object.entries(ts)
        .map(([date, v]) => ({
          date,
          open:   parseFloat(v["1. open"]),
          high:   parseFloat(v["2. high"]),
          low:    parseFloat(v["3. low"]),
          close:  parseFloat(v["4. close"]),
          volume: parseInt(v["5. volume"]),
        }))
        .filter(d => new Date(d.date) >= cutoff)
        .sort((a,b) => new Date(a.date)-new Date(b.date));

      setRawData(parsed);
    } catch(e) {
      setError(e.message || "データ取得エラー");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { if(selected) fetchStock(selected); }, [selected, periodIdx]);

  const data = applyIndicators(rawData);
  const first=data[0]?.close, last=data[data.length-1]?.close;
  const change=first&&last?((last-first)/first*100):null;
  const isUp=(change??0)>=0;
  const minY=data.length?Math.min(...data.map(d=>d.bbLower??d.low))*0.995:0;
  const maxY=data.length?Math.max(...data.map(d=>d.bbUpper??d.high))*1.005:0;

  const latestRSI=data[data.length-1]?.rsi;
  const latestMACD=data[data.length-1]?.macd;
  const latestSig=data[data.length-1]?.macdSig;
  const latestStochK=data[data.length-1]?.stochK;
  const rsiSig=latestRSI>70?{v:"買われすぎ",t:"sell"}:latestRSI<30?{v:"売られすぎ",t:"buy"}:{v:"中立",t:"neutral"};
  const macdSig=latestMACD>latestSig?{v:"上昇",t:"buy"}:{v:"下降",t:"sell"};
  const stochSig=latestStochK>80?{v:"買われすぎ",t:"sell"}:latestStochK<20?{v:"売られすぎ",t:"buy"}:{v:"中立",t:"neutral"};
  const trendSig=isUp?{v:"上昇",t:"buy"}:{v:"下降",t:"sell"};

  async function fetchAiComment() {
    if(!data.length||!selected) return;
    setAiLoading(true); setAiComment(null);
    const isBig=Math.abs(change??0)>=5;
    const prompt=`株式テクニカル分析をJSON（マークダウン不要）で返してください。
銘柄: ${selected.name} 期間: ${period.label} 騰落率: ${change?.toFixed(2)}%
RSI: ${latestRSI} MACD: ${latestMACD?.toFixed(3)} シグナル: ${latestSig?.toFixed(3)} ストキャスK: ${latestStochK}
${isBig?`大幅${isUp?"上昇":"下落"}の要因も時事的観点から説明してください。`:""}
形式: {"summary":"総合分析150字","signals":["シグナル1","シグナル2","シグナル3"],"reasons":${isBig?'[{"title":"要因","detail":"説明"}]':'[]'},"outlook":"短期見通し50字","disclaimer":"※参考情報・投資助言ではありません"}`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,
          tools:isBig?[{type:"web_search_20250305",name:"web_search"}]:undefined,
          messages:[{role:"user",content:prompt}]}),
      });
      const json=await res.json();
      const text=json.content?.map(b=>b.type==="text"?b.text:"").join("")||"";
      try { setAiComment(JSON.parse(text.replace(/```json|```/g,"").trim())); }
      catch { setAiComment({summary:text,signals:[],reasons:[],outlook:"",disclaimer:"※参考情報"}); }
    } catch { setAiComment({summary:"取得失敗",signals:[],reasons:[],outlook:"",disclaimer:""}); }
    finally { setAiLoading(false); }
  }

  const togglePanel=key=>setPanels(p=>({...p,[key]:!p[key]}));

  function selectPreset(p) { setSelected(p); setAiComment(null); }
  function searchCustom() {
    if(!customSymbol.trim()) return;
    const sym=customSymbol.trim().toUpperCase();
    const market=sym.endsWith(".T")?"JP":"US";
    const preset={label:sym,symbol:sym,market,name:sym};
    setSelected(preset); setAiComment(null);
  }

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#e2e8f0",fontFamily:"'Hiragino Sans','Meiryo',sans-serif"}}>

      {/* ヘッダー */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"14px 20px"}}>
        <div style={{fontSize:17,fontWeight:700,color:"#f1f5f9"}}>📈 株価テクニカル分析</div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>実際の株価データ（Alpha Vantage）/ 投資助言ではありません</div>
      </div>

      {/* 検索 */}
      <div style={{padding:"12px 20px",borderBottom:"1px solid #1e293b"}}>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <input value={customSymbol} onChange={e=>setCustomSymbol(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&searchCustom()}
            placeholder="ティッカー例: AAPL / 7203.T"
            style={{flex:1,background:"#0f172a",border:"1px solid #334155",borderRadius:7,padding:"7px 10px",
              color:"#f1f5f9",fontSize:13,outline:"none"}}/>
          <button onClick={searchCustom}
            style={{background:"#3b82f6",border:"none",borderRadius:7,padding:"7px 16px",
              color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>検索</button>
        </div>
        <div style={{fontSize:10,color:"#64748b",marginBottom:6}}>🇯🇵 日本株</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          {PRESETS.filter(p=>p.market==="JP").map(p=>(
            <button key={p.symbol} onClick={()=>selectPreset(p)}
              style={{background:selected?.symbol===p.symbol?"#3b82f6":"#1e293b",border:"1px solid #334155",
                borderRadius:6,padding:"5px 11px",color:selected?.symbol===p.symbol?"#fff":"#94a3b8",
                fontSize:12,cursor:"pointer",fontWeight:600}}>{p.label}</button>
          ))}
        </div>
        <div style={{fontSize:10,color:"#64748b",marginBottom:6}}>🇺🇸 米国株</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {PRESETS.filter(p=>p.market==="US").map(p=>(
            <button key={p.symbol} onClick={()=>selectPreset(p)}
              style={{background:selected?.symbol===p.symbol?"#3b82f6":"#1e293b",border:"1px solid #334155",
                borderRadius:6,padding:"5px 11px",color:selected?.symbol===p.symbol?"#fff":"#94a3b8",
                fontSize:12,cursor:"pointer",fontWeight:600}}>{p.label}</button>
          ))}
        </div>
      </div>

      {!selected&&!loading&&(
        <div style={{textAlign:"center",color:"#475569",marginTop:60}}>
          <div style={{fontSize:40}}>📈</div>
          <div style={{marginTop:12,fontSize:14}}>銘柄を選んでください</div>
          <div style={{fontSize:11,marginTop:6,color:"#334155"}}>無料枠: 1分あたり5回・1日25回まで</div>
        </div>
      )}

      {loading&&(
        <div style={{textAlign:"center",color:"#64748b",padding:60,fontSize:14}}>
          データ取得中...
        </div>
      )}

      {error&&(
        <div style={{margin:"16px 20px",background:"#450a0a",border:"1px solid #ef4444",borderRadius:10,
          padding:14,color:"#fca5a5",fontSize:13,lineHeight:1.6}}>{error}</div>
      )}

      {data.length>0&&!loading&&(
        <div style={{padding:"14px 20px"}}>

          {/* 価格 */}
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:17,fontWeight:700}}>{selected.name}</span>
              <span style={{fontSize:11,color:"#64748b"}}>{selected.symbol}</span>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,marginTop:4}}>
              <span style={{fontSize:26,fontWeight:700}}>{formatPrice(last,selected.market)}</span>
              {change!==null&&(
                <span style={{fontSize:14,fontWeight:700,color:isUp?"#22c55e":"#ef4444"}}>
                  {isUp?"▲":"▼"} {Math.abs(change).toFixed(2)}%（{period.label}）
                </span>
              )}
            </div>
          </div>

          {/* シグナル */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
            <Signal label="トレンド"   value={trendSig.v}  type={trendSig.t}/>
            <Signal label="MACD"      value={macdSig.v}   type={macdSig.t}/>
            <Signal label="RSI"       value={rsiSig.v}    type={rsiSig.t}/>
            <Signal label="ストキャス" value={stochSig.v}  type={stochSig.t}/>
          </div>

          {/* 期間 */}
          <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
            {PERIODS.map((p,i)=>(
              <button key={p.label} onClick={()=>setPeriodIdx(i)}
                style={{background:periodIdx===i?"#3b82f6":"#1e293b",border:"1px solid #334155",
                  borderRadius:6,padding:"4px 12px",color:periodIdx===i?"#fff":"#94a3b8",
                  fontSize:12,cursor:"pointer",fontWeight:600}}>{p.label}</button>
            ))}
          </div>

          {/* チャートオプション */}
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {[["MA5",showMA5,setShowMA5,"#f59e0b"],["MA25",showMA25,setShowMA25,"#8b5cf6"],["BB",showBB,setShowBB,"#a855f7"]].map(([lb,val,setter,color])=>(
              <button key={lb} onClick={()=>setter(!val)}
                style={{background:val?color+"33":"#1e293b",border:`1px solid ${val?color:"#334155"}`,
                  borderRadius:6,padding:"3px 10px",color:val?color:"#64748b",fontSize:11,cursor:"pointer",fontWeight:700}}>
                {lb}
              </button>
            ))}
          </div>

          {/* メインチャート */}
          <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
            <div style={{fontSize:11,color:"#64748b",marginLeft:8,marginBottom:4}}>価格チャート（終値）</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:10}} interval="preserveStartEnd"/>
                <YAxis domain={[minY,maxY]} tick={{fill:"#64748b",fontSize:10}} width={68}
                  tickFormatter={v=>selected.market==="JP"?`¥${Math.round(v).toLocaleString()}`:`$${v.toFixed(0)}`}/>
                <Tooltip content={<TT market={selected.market}/>}/>
                {showBB&&<>
                  <Area type="monotone" dataKey="bbUpper" stroke="#a855f7" strokeWidth={1} fill="#a855f733" name="BB上限" dot={false}/>
                  <Area type="monotone" dataKey="bbLower" stroke="#a855f7" strokeWidth={1} fill="#0f172a" name="BB下限" dot={false}/>
                  <Line type="monotone" dataKey="bbMid" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 2" dot={false} name="BB中央"/>
                </>}
                <Line type="monotone" dataKey="close" stroke={isUp?"#22c55e":"#ef4444"} strokeWidth={2} dot={false} name="終値"/>
                {showMA5  &&<Line type="monotone" dataKey="ma5"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="MA5"/>}
                {showMA25 &&<Line type="monotone" dataKey="ma25" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="MA25"/>}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* パネル切替 */}
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {PANELS.map(p=>(
              <button key={p.key} onClick={()=>togglePanel(p.key)}
                style={{background:panels[p.key]?p.color+"33":"#1e293b",border:`1px solid ${panels[p.key]?p.color:"#334155"}`,
                  borderRadius:6,padding:"3px 10px",color:panels[p.key]?p.color:"#64748b",fontSize:11,cursor:"pointer",fontWeight:700}}>
                {p.label}
              </button>
            ))}
          </div>

          {/* MACDパネル */}
          {panels.macd&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#3b82f6",marginLeft:8,marginBottom:4,fontWeight:700}}>MACD (12,26,9)</div>
              <ResponsiveContainer width="100%" height={110}>
                <ComposedChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:9}} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#64748b",fontSize:9}} width={36}/>
                  <Tooltip content={<TT/>}/>
                  <ReferenceLine y={0} stroke="#475569"/>
                  <Bar dataKey="macdHist" name="ヒストグラム">
                    {data.map((d,i)=><cell key={i} fill={(d.macdHist??0)>=0?"#22c55e":"#ef4444"}/>)}
                  </Bar>
                  <Line type="monotone" dataKey="macd"    stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MACD"/>
                  <Line type="monotone" dataKey="macdSig" stroke="#ef4444" strokeWidth={1.5} dot={false} name="シグナル"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* BBパネル */}
          {panels.bb&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#8b5cf6",marginLeft:8,marginBottom:4,fontWeight:700}}>ボリンジャーバンド（±2σ）</div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:9}} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#64748b",fontSize:9}} width={68}
                    tickFormatter={v=>selected.market==="JP"?`¥${Math.round(v).toLocaleString()}`:`$${v.toFixed(0)}`}/>
                  <Tooltip content={<TT market={selected.market}/>}/>
                  <Area type="monotone" dataKey="bbUpper" stroke="#a855f7" fill="#a855f722" strokeWidth={1.5} name="上限"/>
                  <Area type="monotone" dataKey="bbLower" stroke="#a855f7" fill="#0f172a" strokeWidth={1.5} name="下限"/>
                  <Line type="monotone" dataKey="close" stroke="#e2e8f0" strokeWidth={1} dot={false} name="終値"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 出来高パネル */}
          {panels.vol&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#10b981",marginLeft:8,marginBottom:4,fontWeight:700}}>出来高</div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:9}} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#64748b",fontSize:9}} width={40} tickFormatter={v=>`${(v/1000000).toFixed(0)}M`}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="volume" name="出来高" fill="#10b981" opacity={0.7}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ストキャスパネル */}
          {panels.stoch&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#f97316",marginLeft:8,marginBottom:4,fontWeight:700}}>ストキャスティクス (14,3)</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:9}} interval="preserveStartEnd"/>
                  <YAxis domain={[0,100]} tick={{fill:"#64748b",fontSize:9}} width={28}/>
                  <Tooltip content={<TT/>}/>
                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3"/>
                  <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3"/>
                  <Line type="monotone" dataKey="stochK" stroke="#f97316" strokeWidth={1.5} dot={false} name="%K"/>
                  <Line type="monotone" dataKey="stochD" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="%D" strokeDasharray="3 2"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RSIパネル */}
          {panels.rsi&&(
            <div style={{background:"#1e293b",borderRadius:10,padding:"12px 6px 6px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#06b6d4",marginLeft:8,marginBottom:4,fontWeight:700}}>RSI (14)</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={data} margin={{top:4,right:14,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="date" tickFormatter={fmtD} tick={{fill:"#64748b",fontSize:9}} interval="preserveStartEnd"/>
                  <YAxis domain={[0,100]} tick={{fill:"#64748b",fontSize:9}} width={28}/>
                  <Tooltip content={<TT/>}/>
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3"/>
                  <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3"/>
                  <Line type="monotone" dataKey="rsi" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="RSI"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI分析 */}
          <div style={{background:"#1e293b",borderRadius:10,padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>🤖 AI総合分析</span>
              <button onClick={fetchAiComment} disabled={aiLoading}
                style={{background:aiLoading?"#1e293b":"#3b82f6",border:"1px solid #3b82f6",
                  borderRadius:7,padding:"5px 14px",color:aiLoading?"#64748b":"#fff",
                  fontSize:12,cursor:aiLoading?"default":"pointer",fontWeight:700}}>
                {aiLoading?"分析中...":"分析する"}
              </button>
            </div>
            {aiComment?(
              <div>
                <p style={{fontSize:13,color:"#cbd5e1",lineHeight:1.7,margin:"0 0 10px"}}>{aiComment.summary}</p>
                {aiComment.signals?.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:6,fontWeight:700}}>📊 シグナル</div>
                    {aiComment.signals.map((s,i)=>(
                      <div key={i} style={{background:"#0f172a",borderRadius:6,padding:"5px 10px",marginBottom:4,fontSize:12,color:"#94a3b8"}}>• {s}</div>
                    ))}
                  </div>
                )}
                {aiComment.reasons?.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:6,fontWeight:700}}>📰 変動要因</div>
                    {aiComment.reasons.map((r,i)=>(
                      <div key={i} style={{background:"#0f172a",borderRadius:6,padding:"7px 10px",marginBottom:5,borderLeft:"3px solid #3b82f6"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#93c5fd"}}>{r.title}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{r.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
                {aiComment.outlook&&(
                  <div style={{background:"#0f172a",borderRadius:6,padding:"7px 10px",marginBottom:8}}>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:2}}>📅 短期見通し</div>
                    <div style={{fontSize:12,color:"#e2e8f0"}}>{aiComment.outlook}</div>
                  </div>
                )}
                <p style={{fontSize:10,color:"#475569",margin:0}}>{aiComment.disclaimer}</p>
              </div>
            ):(
              <p style={{fontSize:12,color:"#475569",margin:0}}>「分析する」を押すとAIが総合分析します。</p>
            )}
            <div style={{marginTop:10,padding:"6px 10px",background:"#0f172a",borderRadius:6,fontSize:10,color:"#475569"}}>
              ⚠️ 参考情報のみ。実際の投資判断はご自身の責任で行ってください。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
