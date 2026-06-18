import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, ChevronLeft, ChevronRight, X, Trash2, Settings2, Pencil, LogOut } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// ---------- Storage helpers (Firestore; one document per user) ----------
function userDocRef(uid) {
  return doc(db, "ledgers", uid);
}

async function loadData(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    if (snap.exists()) return snap.data();
  } catch (e) {
    console.error("読み込みに失敗しました", e);
  }
  return null;
}

async function saveData(uid, data) {
  try {
    await setDoc(userDocRef(uid), data);
  } catch (e) {
    console.error("保存に失敗しました", e);
  }
}

// ---------- Category kinds ----------
// "parlor": 店舗名・機種名・投資・回収を記録 (パチンコ/スロット系)
// "race": 開催場・レース番号・レース名・投資・回収を記録 (競馬/競艇/競輪等)
// "simple": 収支のみ手入力
const DEFAULT_CATEGORIES = [
  { id: "pachinko", name: "パチンコ", color: "#9a6b3f", kind: "parlor" },
  { id: "slot", name: "スロット", color: "#5b7a8f", kind: "parlor" },
  { id: "keiba", name: "競馬", color: "#7a8c4f", kind: "race" },
  { id: "keitei", name: "競艇", color: "#4f7a8c", kind: "race" },
  { id: "keirin", name: "競輪", color: "#a4763f", kind: "race" },
  { id: "other", name: "その他", color: "#7f7368", kind: "simple" },
];

const PALETTE = [
  "#9a6b3f", "#5b7a8f", "#7a8c4f", "#4f7a8c", "#a4763f",
  "#7f7368", "#8c5b6f", "#5b8c6f", "#8c7a4f", "#6f6f9a",
];

const KIND_LABELS = {
  parlor: "店舗・機種で記録",
  race: "開催場・レースで記録",
  simple: "収支のみ記録",
};

function pad2(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function formatYen(n) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}¥${Math.abs(n).toLocaleString("ja-JP")}`;
}
function monthLabel(y, m) {
  return `${y}年${m + 1}月`;
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function recordTotal(rec) {
  // simple kind stores amount directly; parlor/race store invest & payout
  if (rec.amount !== undefined) return rec.amount;
  const invest = Number(rec.invest) || 0;
  const payout = Number(rec.payout) || 0;
  return payout - invest;
}
function dayTotal(records) {
  if (!records || !records.length) return 0;
  return records.reduce((sum, r) => sum + recordTotal(r), 0);
}

// ---------- Main App ----------
export default function GambleLedger({ user, onSignOut, signingOut }) {
  const currentUid = user.uid;
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeCat, setActiveCat] = useState(DEFAULT_CATEGORIES[0].id);
  // entries: { catId: { "YYYY-MM-DD": [record, record, ...] } }
  const [entries, setEntries] = useState({});
  // history suggestions: { catId: { venues: [...], models: [...], places: [...] } }
  const [history, setHistory] = useState({});
  const [viewDate, setViewDate] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState("parlor");
  const [saveState, setSaveState] = useState("idle");
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [draft, setDraft] = useState(null); // current form draft for a record

  // Load once
  useEffect(() => {
    (async () => {
      const data = await loadData(currentUid);
      if (data) {
        if (data.categories && data.categories.length) setCategories(data.categories);
        if (data.entries) setEntries(data.entries);
        if (data.history) setHistory(data.history);
        if (data.activeCat) setActiveCat(data.activeCat);
      }
      setLoaded(true);
    })();
  }, [currentUid]);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      await saveData(currentUid, { categories, entries, history, activeCat });
      setSaveState("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [categories, entries, history, activeCat, loaded, currentUid]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const catEntries = entries[activeCat] || {};
  const activeCategory = categories.find((c) => c.id === activeCat) || categories[0];
  const activeKind = activeCategory?.kind || "simple";

  const monthTotal = useMemo(() => {
    let sum = 0;
    Object.entries(catEntries).forEach(([key, records]) => {
      const [y, m] = key.split("-").map(Number);
      if (y === year && m - 1 === month) sum += dayTotal(records);
    });
    return sum;
  }, [catEntries, year, month]);

  const allCatsMonthTotal = useMemo(() => {
    let sum = 0;
    categories.forEach((c) => {
      const e = entries[c.id] || {};
      Object.entries(e).forEach(([key, records]) => {
        const [y, m] = key.split("-").map(Number);
        if (y === year && m - 1 === month) sum += dayTotal(records);
      });
    });
    return sum;
  }, [entries, categories, year, month]);

  const goPrevMonth = useCallback(() => setViewDate(new Date(year, month - 1, 1)), [year, month]);
  const goNextMonth = useCallback(() => setViewDate(new Date(year, month + 1, 1)), [year, month]);

  function emptyDraftFor(kind) {
    if (kind === "parlor") return { id: uid(), venue: "", model: "", invest: "", payout: "" };
    if (kind === "race") return { id: uid(), place: "", raceNo: "", raceName: "", invest: "", payout: "" };
    return { id: uid(), amount: "" };
  }

  function openDay(key) {
    setSelectedDay(key);
    setEditingRecordId(null);
    setDraft(null);
  }

  function closeDay() {
    setSelectedDay(null);
    setEditingRecordId(null);
    setDraft(null);
  }

  function startNewRecord() {
    setEditingRecordId("__new__");
    setDraft(emptyDraftFor(activeKind));
  }

  function startEditRecord(rec) {
    setEditingRecordId(rec.id);
    setDraft({ ...rec });
  }

  function cancelRecordEdit() {
    setEditingRecordId(null);
    setDraft(null);
  }

  function updateHistory(catId, kind, d) {
    setHistory((prev) => {
      const h = { ...(prev[catId] || { venues: [], models: [], places: [] }) };
      if (kind === "parlor") {
        if (d.venue && !h.venues.includes(d.venue)) h.venues = [d.venue, ...h.venues].slice(0, 30);
        if (d.model && !h.models.includes(d.model)) h.models = [d.model, ...h.models].slice(0, 30);
      } else if (kind === "race") {
        if (d.place && !h.places.includes(d.place)) h.places = [d.place, ...h.places].slice(0, 30);
      }
      return { ...prev, [catId]: h };
    });
  }

  function saveRecord() {
    if (!draft || !selectedDay) return;
    const clean = { ...draft };
    if (activeKind === "simple") {
      const num = Number(clean.amount);
      if (clean.amount === "" || Number.isNaN(num)) return;
      clean.amount = num;
    } else {
      clean.invest = clean.invest === "" ? 0 : Number(clean.invest) || 0;
      clean.payout = clean.payout === "" ? 0 : Number(clean.payout) || 0;
    }
    setEntries((prev) => {
      const catMap = { ...(prev[activeCat] || {}) };
      const dayRecords = [...(catMap[selectedDay] || [])];
      const idx = dayRecords.findIndex((r) => r.id === clean.id);
      if (idx >= 0) dayRecords[idx] = clean;
      else dayRecords.push(clean);
      catMap[selectedDay] = dayRecords;
      return { ...prev, [activeCat]: catMap };
    });
    updateHistory(activeCat, activeKind, clean);
    setEditingRecordId(null);
    setDraft(null);
  }

  function deleteRecord(id) {
    setEntries((prev) => {
      const catMap = { ...(prev[activeCat] || {}) };
      const dayRecords = (catMap[selectedDay] || []).filter((r) => r.id !== id);
      if (dayRecords.length) catMap[selectedDay] = dayRecords;
      else delete catMap[selectedDay];
      return { ...prev, [activeCat]: catMap };
    });
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const id = `cat-${Date.now()}`;
    const usedColors = categories.map((c) => c.color);
    const color = PALETTE.find((p) => !usedColors.includes(p)) || PALETTE[categories.length % PALETTE.length];
    setCategories((prev) => [...prev, { id, name, color, kind: newCatKind }]);
    setNewCatName("");
    setActiveCat(id);
  }

  function removeCategory(id) {
    if (categories.length <= 1) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setEntries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeCat === id) {
      const remaining = categories.filter((c) => c.id !== id);
      setActiveCat(remaining[0]?.id);
    }
  }

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weekDayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const today = todayKey();
  const selectedDayRecords = selectedDay ? (catEntries[selectedDay] || []) : [];
  const catHistory = history[activeCat] || { venues: [], models: [], places: [] };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3efe7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP', sans-serif", color: "#5c4d3a" }}>
        読み込み中…
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{fontImports}</style>

      <div style={styles.header}>
        <div style={styles.headerTop}>
          <span style={styles.brandMark}>帳</span>
          <span style={styles.brandName}>ギャンブル収支帖</span>
          <button onClick={() => setShowCatManager(true)} style={styles.settingsBtn} aria-label="種類を管理">
            <Settings2 size={18} strokeWidth={2} />
          </button>
          <button onClick={onSignOut} disabled={signingOut} style={styles.settingsBtn} aria-label="ログアウト">
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>

        <div style={styles.monthNav}>
          <button onClick={goPrevMonth} style={styles.navBtn} aria-label="前の月"><ChevronLeft size={20} /></button>
          <div style={styles.monthLabel}>{monthLabel(year, month)}</div>
          <button onClick={goNextMonth} style={styles.navBtn} aria-label="次の月"><ChevronRight size={20} /></button>
        </div>

        <div style={styles.totalBlock}>
          <div style={styles.totalLabel}>{activeCategory?.name}の今月収支</div>
          <div style={{ ...styles.totalValue, color: monthTotal > 0 ? "#3f6b4a" : monthTotal < 0 ? "#9a3f3f" : "#5c4d3a" }}>
            {formatYen(monthTotal)}
          </div>
          <div style={styles.allCatTotal}>
            全種類合計: <span style={{ color: allCatsMonthTotal > 0 ? "#3f6b4a" : allCatsMonthTotal < 0 ? "#9a3f3f" : "#5c4d3a", fontWeight: 600 }}>
              {formatYen(allCatsMonthTotal)}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.tabRow}>
        {categories.map((c) => {
          const isActive = c.id === activeCat;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              style={{ ...styles.tab, background: isActive ? c.color : "#fff", color: isActive ? "#fdfaf5" : "#5c4d3a", borderColor: c.color }}
            >
              {c.name}
            </button>
          );
        })}
        <button onClick={() => setShowCatManager(true)} style={styles.tabAdd} aria-label="種類を追加"><Plus size={16} /></button>
      </div>

      <div style={styles.calendarCard}>
        <div style={styles.weekRow}>
          {weekDayLabels.map((w, i) => (
            <div key={w} style={{ ...styles.weekCell, color: i === 0 ? "#9a3f3f" : i === 6 ? "#3f6b8c" : "#7f7368" }}>{w}</div>
          ))}
        </div>
        <div style={styles.grid}>
          {cells.map((d, idx) => {
            if (d === null) return <div key={idx} style={styles.emptyCell} />;
            const key = dateKey(year, month, d);
            const records = catEntries[key];
            const total = records ? dayTotal(records) : undefined;
            const isToday = key === today;
            return (
              <button
                key={idx}
                onClick={() => openDay(key)}
                style={{ ...styles.dayCell, outline: isToday ? `2px solid ${activeCategory?.color}` : "none", outlineOffset: isToday ? "-2px" : "0" }}
              >
                <span style={styles.dayNum}>{d}</span>
                {total !== undefined && (
                  <span style={{ ...styles.dayAmount, color: total > 0 ? "#3f6b4a" : total < 0 ? "#9a3f3f" : "#7f7368" }}>
                    {formatYen(total)}
                  </span>
                )}
                {records && records.length > 1 && <span style={styles.dayCount}>×{records.length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.saveIndicator}>
        {saveState === "saving" ? "保存中…" : "保存済み"}
        <div style={styles.userEmail}>{user.email} でログイン中</div>
      </div>

      {/* Day modal: list of records + add/edit form */}
      {selectedDay && (
        <div style={styles.overlay} onClick={closeDay}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalDate}>{selectedDay.replace(/-/g, "/")}</span>
              <button onClick={closeDay} style={styles.iconBtn} aria-label="閉じる"><X size={18} /></button>
            </div>
            <div style={styles.modalCatTag}>
              <span style={{ ...styles.dot, background: activeCategory?.color }} />
              {activeCategory?.name}
            </div>

            {!editingRecordId && (
              <>
                <div style={styles.dayTotalRow}>
                  <span>この日の合計</span>
                  <span style={{ fontWeight: 700, color: dayTotal(selectedDayRecords) > 0 ? "#3f6b4a" : dayTotal(selectedDayRecords) < 0 ? "#9a3f3f" : "#5c4d3a" }}>
                    {formatYen(dayTotal(selectedDayRecords))}
                  </span>
                </div>

                <div style={styles.recordList}>
                  {selectedDayRecords.length === 0 && (
                    <div style={styles.emptyState}>まだ記録がありません</div>
                  )}
                  {selectedDayRecords.map((rec) => (
                    <div key={rec.id} style={styles.recordCard}>
                      <div style={styles.recordCardMain}>
                        {activeKind === "parlor" && (
                          <>
                            <div style={styles.recordTitle}>{rec.venue || "店舗未入力"}</div>
                            <div style={styles.recordSub}>{rec.model || "機種未入力"}</div>
                          </>
                        )}
                        {activeKind === "race" && (
                          <>
                            <div style={styles.recordTitle}>{rec.place || "開催場未入力"}</div>
                            <div style={styles.recordSub}>
                              {rec.raceNo ? `${rec.raceNo}R　` : ""}{rec.raceName || ""}
                            </div>
                          </>
                        )}
                        {activeKind === "simple" && (
                          <div style={styles.recordTitle}>記録</div>
                        )}
                        {activeKind !== "simple" && (
                          <div style={styles.recordNums}>
                            投資 ¥{(Number(rec.invest) || 0).toLocaleString("ja-JP")} ／ 回収 ¥{(Number(rec.payout) || 0).toLocaleString("ja-JP")}
                          </div>
                        )}
                      </div>
                      <div style={styles.recordRight}>
                        <span style={{ ...styles.recordAmount, color: recordTotal(rec) > 0 ? "#3f6b4a" : recordTotal(rec) < 0 ? "#9a3f3f" : "#7f7368" }}>
                          {formatYen(recordTotal(rec))}
                        </span>
                        <div style={styles.recordBtnRow}>
                          <button onClick={() => startEditRecord(rec)} style={styles.iconBtnSmall} aria-label="編集"><Pencil size={14} /></button>
                          <button onClick={() => deleteRecord(rec.id)} style={styles.iconBtnSmall} aria-label="削除"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={startNewRecord} style={{ ...styles.addRecordBtn, borderColor: activeCategory?.color, color: activeCategory?.color }}>
                  <Plus size={16} style={{ marginRight: 6 }} />
                  記録を追加
                </button>
              </>
            )}

            {editingRecordId && draft && (
              <RecordForm
                kind={activeKind}
                draft={draft}
                setDraft={setDraft}
                history={catHistory}
                onCancel={cancelRecordEdit}
                onSave={saveRecord}
                color={activeCategory?.color}
              />
            )}
          </div>
        </div>
      )}

      {/* Category manager modal */}
      {showCatManager && (
        <div style={styles.overlay} onClick={() => setShowCatManager(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalDate}>ギャンブルの種類</span>
              <button onClick={() => setShowCatManager(false)} style={styles.iconBtn} aria-label="閉じる"><X size={18} /></button>
            </div>
            <div style={styles.catList}>
              {categories.map((c) => (
                <div key={c.id} style={styles.catRow}>
                  <span style={{ ...styles.dot, background: c.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.catRowName}>{c.name}</div>
                    <div style={styles.catRowKind}>{KIND_LABELS[c.kind] || KIND_LABELS.simple}</div>
                  </div>
                  <button onClick={() => removeCategory(c.id)} style={styles.catRemoveBtn} disabled={categories.length <= 1} aria-label={`${c.name}を削除`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <label style={styles.modalLabel}>新しい種類を追加</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="例: カジノ"
              style={{ ...styles.input, marginBottom: 10 }}
            />
            <div style={styles.kindPicker}>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setNewCatKind(k)}
                  style={{
                    ...styles.kindOption,
                    background: newCatKind === k ? "#3a3027" : "#f0e9da",
                    color: newCatKind === k ? "#fdfaf5" : "#5c4d3a",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={addCategory} style={styles.addCatBtnFull}>追加</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Record form (add / edit) ----------
function RecordForm({ kind, draft, setDraft, history, onCancel, onSave, color }) {
  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));
  const computedTotal = kind === "simple"
    ? Number(draft.amount) || 0
    : (Number(draft.payout) || 0) - (Number(draft.invest) || 0);

  return (
    <div>
      {kind === "parlor" && (
        <>
          <label style={styles.modalLabel}>店舗名</label>
          <input
            list="venue-suggestions"
            type="text"
            value={draft.venue}
            onChange={set("venue")}
            placeholder="例: マルハン渋谷店"
            style={styles.input}
          />
          <datalist id="venue-suggestions">
            {history.venues.map((v) => <option key={v} value={v} />)}
          </datalist>

          <label style={{ ...styles.modalLabel, marginTop: 14 }}>機種名</label>
          <input
            list="model-suggestions"
            type="text"
            value={draft.model}
            onChange={set("model")}
            placeholder="例: Lパチスロ北斗の拳"
            style={styles.input}
          />
          <datalist id="model-suggestions">
            {history.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </>
      )}

      {kind === "race" && (
        <>
          <label style={styles.modalLabel}>開催場</label>
          <input
            list="place-suggestions"
            type="text"
            value={draft.place}
            onChange={set("place")}
            placeholder="例: 中山競馬場"
            style={styles.input}
          />
          <datalist id="place-suggestions">
            {history.places.map((p) => <option key={p} value={p} />)}
          </datalist>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ width: 90 }}>
              <label style={styles.modalLabel}>レース番号</label>
              <input
                type="number"
                inputMode="numeric"
                value={draft.raceNo}
                onChange={set("raceNo")}
                placeholder="11"
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.modalLabel}>レース名</label>
              <input
                type="text"
                value={draft.raceName}
                onChange={set("raceName")}
                placeholder="例: 東京優駿"
                style={styles.input}
              />
            </div>
          </div>
        </>
      )}

      {kind !== "simple" ? (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={styles.modalLabel}>投資額（円）</label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.invest}
              onChange={set("invest")}
              placeholder="0"
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.modalLabel}>回収額（円）</label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.payout}
              onChange={set("payout")}
              placeholder="0"
              style={styles.input}
            />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <label style={styles.modalLabel}>収支（円）</label>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={draft.amount}
            onChange={set("amount")}
            placeholder="例: -3000 / 5000"
            style={styles.input}
          />
          <div style={styles.modalHint}>負けはマイナス、勝ちはプラスで入力</div>
        </div>
      )}

      {kind !== "simple" && (
        <div style={styles.computedRow}>
          <span>この記録の収支</span>
          <span style={{ fontWeight: 700, color: computedTotal > 0 ? "#3f6b4a" : computedTotal < 0 ? "#9a3f3f" : "#5c4d3a" }}>
            {formatYen(computedTotal)}
          </span>
        </div>
      )}

      <div style={styles.modalActions}>
        <button onClick={onCancel} style={styles.cancelBtn}>キャンセル</button>
        <button onClick={onSave} style={{ ...styles.saveBtn, background: color }}>保存</button>
      </div>
    </div>
  );
}

// ---------- Styles ----------
const fontImports = `
@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap');
`;

const styles = {
  app: { minHeight: "100vh", background: "#f3efe7", fontFamily: "'Noto Sans JP', sans-serif", color: "#3a3027", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" },
  header: { background: "linear-gradient(180deg, #2f2a23 0%, #463c30 100%)", color: "#f3efe7", padding: "20px 18px 22px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  headerTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  brandMark: { fontFamily: "'Shippori Mincho', serif", fontSize: 20, fontWeight: 700, background: "#c9a86a", color: "#2f2a23", width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  brandName: { fontFamily: "'Shippori Mincho', serif", fontSize: 17, fontWeight: 700, letterSpacing: "0.02em", flex: 1 },
  settingsBtn: { background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 8, color: "#f3efe7", display: "flex", alignItems: "center", cursor: "pointer", marginLeft: 4 },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 10 },
  navBtn: { background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#f3efe7", cursor: "pointer" },
  monthLabel: { fontFamily: "'Shippori Mincho', serif", fontSize: 18, fontWeight: 700, minWidth: 110, textAlign: "center" },
  totalBlock: { textAlign: "center", marginTop: 6 },
  totalLabel: { fontSize: 12, color: "#c9bfaf", opacity: 0.75, marginBottom: 2 },
  totalValue: { fontFamily: "'Shippori Mincho', serif", fontSize: 36, fontWeight: 700, letterSpacing: "0.01em" },
  allCatTotal: { fontSize: 12, color: "#d8cfc0", marginTop: 4 },
  tabRow: { display: "flex", gap: 8, padding: "16px 16px 0", overflowX: "auto", flexWrap: "wrap" },
  tab: { padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  tabAdd: { width: 32, height: 32, borderRadius: "50%", border: "1.5px dashed #b8ab94", background: "transparent", color: "#7f7368", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  calendarCard: { background: "#fdfaf5", margin: "14px 16px 0", borderRadius: 16, padding: "14px 10px 10px", boxShadow: "0 1px 3px rgba(60,50,30,0.08)" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 },
  weekCell: { textAlign: "center", fontSize: 11, fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  emptyCell: { aspectRatio: "1 / 1" },
  dayCell: { aspectRatio: "1 / 1", border: "none", background: "#f6f2ea", borderRadius: 9, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 2, minWidth: 0, position: "relative" },
  dayNum: { fontSize: 12, color: "#7f7368", fontWeight: 600 },
  dayAmount: { fontSize: 9.5, fontWeight: 700, marginTop: 2, lineHeight: 1, textAlign: "center" },
  dayCount: { position: "absolute", top: 2, right: 3, fontSize: 8, color: "#b8ab94", fontWeight: 700 },
  saveIndicator: { textAlign: "center", fontSize: 11, color: "#a89c87", marginTop: 14 },
  userEmail: { fontSize: 10.5, color: "#c2b8a6", marginTop: 4 },
  overlay: { position: "fixed", inset: 0, background: "rgba(40,33,24,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  modal: { background: "#fdfaf5", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "18px 20px 28px", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", boxSizing: "border-box" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalDate: { fontFamily: "'Shippori Mincho', serif", fontSize: 16, fontWeight: 700, color: "#3a3027" },
  iconBtn: { background: "transparent", border: "none", color: "#7f7368", cursor: "pointer", padding: 4 },
  iconBtnSmall: { background: "#f0e9da", border: "none", color: "#7f7368", cursor: "pointer", padding: 6, borderRadius: 7, display: "flex", alignItems: "center" },
  modalCatTag: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5c4d3a", background: "#f0e9da", padding: "4px 10px", borderRadius: 14, marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  dayTotalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5c4d3a", background: "#f0e9da", borderRadius: 10, padding: "10px 14px", marginBottom: 14 },
  recordList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, maxHeight: 280, overflowY: "auto" },
  emptyState: { textAlign: "center", fontSize: 13, color: "#a89c87", padding: "18px 0" },
  recordCard: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", border: "1px solid #ece4d4", borderRadius: 12, padding: "10px 12px" },
  recordCardMain: { flex: 1, minWidth: 0 },
  recordTitle: { fontSize: 13.5, fontWeight: 700, color: "#3a3027" },
  recordSub: { fontSize: 12, color: "#7f7368", marginTop: 2 },
  recordNums: { fontSize: 11, color: "#a89c87", marginTop: 4 },
  recordRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 10 },
  recordAmount: { fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" },
  recordBtnRow: { display: "flex", gap: 6 },
  addRecordBtn: { width: "100%", background: "transparent", border: "1.5px dashed", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  modalLabel: { fontSize: 12, color: "#7f7368", fontWeight: 600, display: "block", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", border: "1.5px solid #d8cfc0", background: "#fff", borderRadius: 10, padding: "12px 14px", fontSize: 16, color: "#3a3027", outline: "none" },
  modalHint: { fontSize: 11, color: "#a89c87", marginTop: 6 },
  computedRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5c4d3a", background: "#f0e9da", borderRadius: 10, padding: "10px 14px", marginTop: 16 },
  modalActions: { display: "flex", gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, background: "#f0e9da", color: "#5c4d3a", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtn: { flex: 2, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, color: "#fdfaf5", cursor: "pointer" },
  catList: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 18, maxHeight: 260, overflowY: "auto" },
  catRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid #ece4d4" },
  catRowName: { fontSize: 14, fontWeight: 600, color: "#3a3027" },
  catRowKind: { fontSize: 11, color: "#a89c87", marginTop: 1 },
  catRemoveBtn: { background: "transparent", border: "none", color: "#a89c87", cursor: "pointer", padding: 4 },
  kindPicker: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  kindOption: { border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" },
  addCatBtnFull: { width: "100%", border: "none", background: "#3a3027", color: "#fdfaf5", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" },
};
