import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const DEFAULT_CATEGORIES = [
  { id: "groceries", name: "Groceries", emoji: "🛒", budget: 8000, sort_order: 0 },
  { id: "eating-out", name: "Eating Out", emoji: "🍽️", budget: 3000, sort_order: 1 },
  { id: "transport", name: "Transport", emoji: "🚌", budget: 1500, sort_order: 2 },
  { id: "entertainment", name: "Entertainment", emoji: "🎬", budget: 2000, sort_order: 3 },
  { id: "shopping", name: "Shopping", emoji: "🛍️", budget: 3000, sort_order: 4 },
  { id: "bills", name: "Bills", emoji: "📄", budget: 5000, sort_order: 5 },
  { id: "other", name: "Other", emoji: "📦", budget: 2000, sort_order: 6 },
];

const genId = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

const formatKr = (n) =>
  n.toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " kr";

const formatDateShort = (d) => {
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
};

const barColor = (ratio) => {
  if (ratio >= 1) return { bar: "#e74c3c", bg: "#fde8e8" };
  if (ratio >= 0.8) return { bar: "#e67e22", bg: "#fef3e2" };
  return { bar: "#2d6a4f", bg: "#e8f5e9" };
};

export default function App() {
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [screen, setScreen] = useState("main");
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const [addAmount, setAddAmount] = useState("");
  const [addCat, setAddCat] = useState("");
  const [addMemo, setAddMemo] = useState("");
  const [addDate, setAddDate] = useState(todayStr());

  const [editCats, setEditCats] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📌");

  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState(todayStr());
  const [periodEnd, setPeriodEnd] = useState("");
  const [editingPeriodId, setEditingPeriodId] = useState(null);

  const [historyPeriod, setHistoryPeriod] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("categories").select("*").order("sort_order");
      if (cats && cats.length > 0) {
        setCategories(cats);
      } else {
        const { data: seeded } = await supabase
          .from("categories").upsert(DEFAULT_CATEGORIES).select();
        setCategories(seeded || DEFAULT_CATEGORIES);
      }

      const { data: exps } = await supabase
        .from("expenses").select("*").order("date", { ascending: false });
      setExpenses(exps || []);

      const { data: pds } = await supabase
        .from("periods").select("*").order("start_date", { ascending: false });
      setPeriods(pds || []);

      const t = todayStr();
      const active = (pds || []).find((p) => p.start_date <= t && p.end_date >= t);
      if (active) setActivePeriod(active);

      setLoading(false);
    })();
  }, []);

  const periodExpenses = (period) =>
    expenses.filter((e) => e.date >= period.start_date && e.date <= period.end_date);

  const catSpent = (catId, period) =>
    periodExpenses(period)
      .filter((e) => e.category_id === catId)
      .reduce((s, e) => s + e.amount, 0);

  const getCatName = (id) => {
    const c = categories.find((c) => c.id === id);
    return c ? `${c.emoji} ${c.name}` : id;
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(addAmount);
    if (!amt || !addCat) return;
    const exp = {
      id: genId(), amount: amt, category_id: addCat,
      memo: addMemo.trim(), date: addDate,
    };
    const { data } = await supabase.from("expenses").insert(exp).select();
    if (data) setExpenses([data[0], ...expenses]);
    setAddAmount(""); setAddMemo(""); setAddDate(todayStr());
    setScreen("main");
  };

  const handleDeleteExpense = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    const amt = parseFloat(editingExpense.amount);
    if (!amt || !editingExpense.category_id) return;
    const updates = {
      amount: amt, category_id: editingExpense.category_id,
      memo: editingExpense.memo, date: editingExpense.date,
    };
    await supabase.from("expenses").update(updates).eq("id", editingExpense.id);
    setExpenses(expenses.map((e) => e.id === editingExpense.id ? { ...e, ...updates } : e));
    setEditingExpense(null);
  };

  const handleSaveCategories = async () => {
    const valid = editCats.filter((c) => c.name.trim()).map((c, i) => ({ ...c, sort_order: i }));
    const removedIds = categories.filter((c) => !valid.find((v) => v.id === c.id)).map((c) => c.id);
    if (removedIds.length) await supabase.from("categories").delete().in("id", removedIds);
    await supabase.from("categories").upsert(valid);
    setCategories(valid);
    setScreen("main");
  };

  const handleAddCategory = () => {
    if (!newCatName.trim() || !newCatBudget) return;
    setEditCats([...editCats, {
      id: genId(), name: newCatName.trim(), budget: parseFloat(newCatBudget),
      emoji: newCatEmoji || "📌", sort_order: editCats.length,
    }]);
    setNewCatName(""); setNewCatBudget(""); setNewCatEmoji("📌");
  };

  const handleCreatePeriod = async () => {
    if (!periodName.trim() || !periodStart || !periodEnd) return;
    if (periodEnd <= periodStart) return;

    if (editingPeriodId) {
      const updates = { name: periodName.trim(), start_date: periodStart, end_date: periodEnd };
      await supabase.from("periods").update(updates).eq("id", editingPeriodId);
      const updated = periods.map((p) => p.id === editingPeriodId ? { ...p, ...updates } : p);
      setPeriods(updated);
      if (activePeriod?.id === editingPeriodId) setActivePeriod({ ...activePeriod, ...updates });
    } else {
      const p = {
        id: genId(), name: periodName.trim(),
        start_date: periodStart, end_date: periodEnd,
      };
      const { data } = await supabase.from("periods").insert(p).select();
      if (data) {
        setPeriods([data[0], ...periods]);
        setActivePeriod(data[0]);
      }
    }
    setPeriodName(""); setPeriodStart(todayStr()); setPeriodEnd("");
    setEditingPeriodId(null);
    setScreen("main");
  };

  const handleDeletePeriod = async (id) => {
    await supabase.from("periods").delete().eq("id", id);
    setPeriods(periods.filter((p) => p.id !== id));
    if (activePeriod?.id === id) setActivePeriod(null);
  };

  const openEditPeriod = (period) => {
    setPeriodName(period.name);
    setPeriodStart(period.start_date);
    setPeriodEnd(period.end_date);
    setEditingPeriodId(period.id);
    setScreen("newPeriod");
  };

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = activePeriod
    ? categories.reduce((s, c) => s + catSpent(c.id, activePeriod), 0) : 0;

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <p style={{ color: "#6b7280", marginTop: 16, fontFamily: F }}>Loading...</p>
      </div>
    );
  }

  // ═══ MAIN ═══
  if (screen === "main") {
    if (!activePeriod) {
      return (
        <div style={S.app}>
          <div style={S.header}>
            <h1 style={S.title}>Budget Tracker</h1>
            <div style={{ position: "relative" }}>
              <button style={S.iconBtn} onClick={() => setShowMenu(!showMenu)}>⚙️</button>
              {showMenu && (
                <>
                  <div style={S.menuBackdrop} onClick={() => setShowMenu(false)} />
                  <div style={S.menu}>
                    <button style={S.menuItem} onClick={() => { setShowMenu(false); setEditCats([...categories]); setScreen("editCats"); }}>
                      ✏️ Edit Categories
                    </button>
                    <button style={S.menuItem} onClick={() => { setShowMenu(false); setHistoryPeriod(null); setSearchQ(""); setScreen("history"); }}>
                      📅 Past Records
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>📋</div>
            <p style={S.emptyTitle}>No active budget period</p>
            <p style={S.emptyDesc}>Create a new budget period to start tracking.</p>
            <button style={{ ...S.primaryBtn, maxWidth: 280, margin: "20px auto 0" }}
              onClick={() => {
                setPeriodName(""); setPeriodStart(todayStr()); setPeriodEnd("");
                setEditingPeriodId(null); setScreen("newPeriod");
              }}>
              + New Period
            </button>
            {periods.length > 0 && (
              <div style={{ marginTop: 32, width: "100%", padding: "0 20px" }}>
                <p style={{ ...S.label, textAlign: "center", marginBottom: 12 }}>Or select an existing period</p>
                {periods.slice(0, 5).map((p) => (
                  <button key={p.id} style={{ ...S.monthCard, marginBottom: 8 }}
                    onClick={() => setActivePeriod(p)}>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <span style={S.monthName}>{p.name}</span>
                      <span style={S.periodDates}>{formatDateShort(p.start_date)} – {formatDateShort(p.end_date)}</span>
                    </div>
                    <span style={{ color: "#9ca3af" }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={S.app}>
        <div style={S.header}>
          <div style={{ flex: 1 }}>
            <h1 style={S.title}>{activePeriod.name}</h1>
            <p style={S.subtitle}>
              {formatDateShort(activePeriod.start_date)} – {formatDateShort(activePeriod.end_date)}
              {" · "}{formatKr(totalSpent)} / {formatKr(totalBudget)}
            </p>
          </div>
          <div style={{ position: "relative" }}>
            <button style={S.iconBtn} onClick={() => setShowMenu(!showMenu)}>⚙️</button>
            {showMenu && (
              <>
                <div style={S.menuBackdrop} onClick={() => setShowMenu(false)} />
                <div style={S.menu}>
                  <button style={S.menuItem} onClick={() => { setShowMenu(false); openEditPeriod(activePeriod); }}>
                    ✏️ Edit Period
                  </button>
                  <button style={S.menuItem} onClick={() => {
                    setShowMenu(false); setPeriodName(""); setPeriodStart(todayStr()); setPeriodEnd("");
                    setEditingPeriodId(null); setScreen("newPeriod");
                  }}>
                    📋 New Period
                  </button>
                  <button style={S.menuItem} onClick={() => { setShowMenu(false); setEditCats([...categories]); setScreen("editCats"); }}>
                    🏷️ Edit Categories
                  </button>
                  <div style={S.menuDivider} />
                  <button style={S.menuItem} onClick={() => { setShowMenu(false); setHistoryPeriod(null); setSearchQ(""); setScreen("history"); }}>
                    📅 Past Records
                  </button>
                  <button style={S.menuItem} onClick={() => { setShowMenu(false); setActivePeriod(null); }}>
                    🔄 Switch Period
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={S.overallBar}>
          <div style={{
            ...S.overallFill,
            width: `${Math.min((totalSpent / (totalBudget || 1)) * 100, 100)}%`,
            background: barColor(totalSpent / (totalBudget || 1)).bar,
          }} />
        </div>

        <div style={S.catList}>
          {categories.map((cat) => {
            const spent = catSpent(cat.id, activePeriod);
            const ratio = cat.budget > 0 ? spent / cat.budget : 0;
            const colors = barColor(ratio);
            return (
              <div key={cat.id} style={S.catCard}>
                <div style={S.catHeader}>
                  <span style={S.catName}>{cat.emoji} {cat.name}</span>
                  <span style={{ ...S.catAmount, color: colors.bar }}>
                    {formatKr(spent)}
                    <span style={S.catBudget}> / {formatKr(cat.budget)}</span>
                  </span>
                </div>
                <div style={{ ...S.barBg, background: colors.bg }}>
                  <div style={{
                    ...S.barFill, width: `${Math.min(ratio * 100, 100)}%`, background: colors.bar,
                  }} />
                </div>
                {ratio >= 1 && <p style={S.overBudget}>Over budget by {formatKr(spent - cat.budget)}</p>}
              </div>
            );
          })}
        </div>

        <button style={S.fab}
          onClick={() => { setAddCat(categories[0]?.id || ""); setAddDate(todayStr()); setScreen("add"); }}>+</button>
      </div>
    );
  }

  // ═══ ADD EXPENSE ═══
  if (screen === "add") {
    return (
      <div style={S.app}>
        <div style={S.screenHeader}>
          <button style={S.backBtn} onClick={() => setScreen("main")}>← Back</button>
          <h2 style={S.screenTitle}>Add Expense</h2>
          <div style={{ width: 60 }} />
        </div>
        <div style={S.form}>
          <label style={S.label}>Amount (kr)</label>
          <input style={S.input} type="number" inputMode="decimal" placeholder="0"
            value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
          <label style={S.label}>Category</label>
          <select style={S.select} value={addCat} onChange={(e) => setAddCat(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <label style={S.label}>Date</label>
          <input style={S.input} type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
          <label style={S.label}>Memo (optional)</label>
          <input style={S.input} type="text" placeholder="e.g. Rema 1000"
            value={addMemo} onChange={(e) => setAddMemo(e.target.value)} />
          <button style={{ ...S.primaryBtn, opacity: addAmount && addCat ? 1 : 0.4 }}
            onClick={handleAddExpense} disabled={!addAmount || !addCat}>Add Expense</button>
        </div>
      </div>
    );
  }

  // ═══ NEW/EDIT PERIOD ═══
  if (screen === "newPeriod") {
    const isEdit = !!editingPeriodId;
    return (
      <div style={S.app}>
        <div style={S.screenHeader}>
          <button style={S.backBtn} onClick={() => { setEditingPeriodId(null); setScreen("main"); }}>← Back</button>
          <h2 style={S.screenTitle}>{isEdit ? "Edit Period" : "New Period"}</h2>
          <div style={{ width: 60 }} />
        </div>
        <div style={S.form}>
          <label style={S.label}>Period Name</label>
          <input style={S.input} type="text" placeholder="e.g. March Budget"
            value={periodName} onChange={(e) => setPeriodName(e.target.value)} autoFocus />
          <label style={S.label}>Start Date</label>
          <input style={S.input} type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <label style={S.label}>End Date</label>
          <input style={S.input} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          {periodEnd && periodEnd <= periodStart && (
            <p style={S.overBudget}>End date must be after start date</p>
          )}
          <button
            style={{ ...S.primaryBtn, opacity: periodName && periodStart && periodEnd && periodEnd > periodStart ? 1 : 0.4 }}
            onClick={handleCreatePeriod}
            disabled={!periodName || !periodStart || !periodEnd || periodEnd <= periodStart}>
            {isEdit ? "Save Changes" : "Create Period"}
          </button>
          {isEdit && (
            <button style={{ ...S.dangerBtn, marginTop: 12 }}
              onClick={() => { handleDeletePeriod(editingPeriodId); setEditingPeriodId(null); setScreen("main"); }}>
              Delete Period
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══ EDIT CATEGORIES ═══
  if (screen === "editCats") {
    return (
      <div style={S.app}>
        <div style={S.screenHeader}>
          <button style={S.backBtn} onClick={() => setScreen("main")}>Cancel</button>
          <h2 style={S.screenTitle}>Categories</h2>
          <button style={S.saveBtn} onClick={handleSaveCategories}>Save</button>
        </div>
        <div style={S.catEditList}>
          {editCats.map((cat, i) => (
            <div key={cat.id} style={S.catEditRow}>
              <input style={S.emojiInput} value={cat.emoji}
                onChange={(e) => { const c = [...editCats]; c[i] = { ...c[i], emoji: e.target.value }; setEditCats(c); }} />
              <input style={{ ...S.input, flex: 1, marginBottom: 0 }} value={cat.name}
                onChange={(e) => { const c = [...editCats]; c[i] = { ...c[i], name: e.target.value }; setEditCats(c); }} />
              <input style={{ ...S.input, width: 90, marginBottom: 0, textAlign: "right" }}
                type="number" value={cat.budget}
                onChange={(e) => { const c = [...editCats]; c[i] = { ...c[i], budget: parseFloat(e.target.value) || 0 }; setEditCats(c); }} />
              <button style={S.deleteBtn} onClick={() => setEditCats(editCats.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <div style={S.addCatRow}>
          <input style={S.emojiInput} value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} />
          <input style={{ ...S.input, flex: 1, marginBottom: 0 }} placeholder="Name"
            value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          <input style={{ ...S.input, width: 90, marginBottom: 0, textAlign: "right" }}
            type="number" placeholder="Budget" value={newCatBudget} onChange={(e) => setNewCatBudget(e.target.value)} />
          <button style={{ ...S.addCatBtn, opacity: newCatName && newCatBudget ? 1 : 0.4 }}
            onClick={handleAddCategory} disabled={!newCatName || !newCatBudget}>+</button>
        </div>
      </div>
    );
  }

  // ═══ HISTORY ═══
  if (screen === "history") {
    const sortedPeriods = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const filtered = historyPeriod
      ? periodExpenses(historyPeriod).filter((e) =>
          !searchQ ||
          getCatName(e.category_id).toLowerCase().includes(searchQ.toLowerCase()) ||
          (e.memo || "").toLowerCase().includes(searchQ.toLowerCase()) ||
          String(e.amount).includes(searchQ)
        )
      : [];

    return (
      <div style={S.app}>
        <div style={S.screenHeader}>
          <button style={S.backBtn} onClick={() => {
            if (historyPeriod) { setHistoryPeriod(null); setSearchQ(""); setEditingExpense(null); }
            else setScreen("main");
          }}>← Back</button>
          <h2 style={S.screenTitle}>{historyPeriod ? historyPeriod.name : "Past Records"}</h2>
          <div style={{ width: 60 }} />
        </div>

        {!historyPeriod ? (
          <div style={S.monthList}>
            {sortedPeriods.length === 0 && <p style={S.empty}>No records yet</p>}
            {sortedPeriods.map((p) => {
              const total = periodExpenses(p).reduce((s, e) => s + e.amount, 0);
              const count = periodExpenses(p).length;
              return (
                <button key={p.id} style={S.monthCard} onClick={() => setHistoryPeriod(p)}>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <span style={S.monthName}>{p.name}</span>
                    <span style={S.periodDates}>{formatDateShort(p.start_date)} – {formatDateShort(p.end_date)}</span>
                  </div>
                  <span style={S.monthMeta}>{count} items · {formatKr(total)}</span>
                  <span style={{ color: "#9ca3af" }}>→</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <p style={S.historySubtitle}>
              {formatDateShort(historyPeriod.start_date)} – {formatDateShort(historyPeriod.end_date)}
            </p>
            <input style={{ ...S.input, margin: "0 20px 12px" }} type="text"
              placeholder="🔍 Search..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
            <div style={S.expenseList}>
              {filtered.length === 0 && <p style={S.empty}>No matching records</p>}
              {filtered.sort((a, b) => b.date.localeCompare(a.date)).map((exp) => (
                <div key={exp.id} style={S.expenseCard}>
                  {editingExpense?.id === exp.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input style={{ ...S.input, marginBottom: 0, flex: 1 }} type="number"
                          value={editingExpense.amount}
                          onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })} />
                        <select style={{ ...S.select, marginBottom: 0, flex: 1 }}
                          value={editingExpense.category_id}
                          onChange={(e) => setEditingExpense({ ...editingExpense, category_id: e.target.value })}>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                        </select>
                      </div>
                      <input style={{ ...S.input, marginBottom: 0 }} value={editingExpense.memo}
                        onChange={(e) => setEditingExpense({ ...editingExpense, memo: e.target.value })} placeholder="Memo" />
                      <input style={{ ...S.input, marginBottom: 0 }} type="date" value={editingExpense.date}
                        onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...S.primaryBtn, flex: 1, marginTop: 0 }} onClick={handleUpdateExpense}>Save</button>
                        <button style={{ ...S.secondaryBtn, flex: 1 }} onClick={() => setEditingExpense(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={S.expenseLeft}>
                        <span style={S.expenseCat}>{getCatName(exp.category_id)}</span>
                        {exp.memo && <span style={S.expenseMemo}>{exp.memo}</span>}
                        <span style={S.expenseDate}>{exp.date}</span>
                      </div>
                      <div style={S.expenseRight}>
                        <span style={S.expenseAmt}>{formatKr(exp.amount)}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={S.tinyBtn} onClick={() => setEditingExpense({ ...exp })}>✏️</button>
                          <button style={S.tinyBtn} onClick={() => handleDeleteExpense(exp.id)}>🗑️</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {filtered.length > 0 && (
              <div style={S.historyTotal}>
                Total: {formatKr(filtered.reduce((s, e) => s + e.amount, 0))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

const F = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const S = {
  app: { fontFamily: F, maxWidth: 480, margin: "0 auto", minHeight: "100vh", position: "relative", paddingBottom: 100, color: "#1a1a1a" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" },
  spinner: { width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#2d6a4f", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 20px 16px" },
  title: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.5px", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", margin: "4px 0 0", lineHeight: 1.4 },
  iconBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 8, borderRadius: 8 },
  menuBackdrop: { position: "fixed", inset: 0, zIndex: 90 },
  menu: { position: "absolute", right: 0, top: 44, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: 6, zIndex: 100, minWidth: 180, border: "1px solid #f0f0f0" },
  menuItem: { display: "block", width: "100%", padding: "10px 14px", border: "none", background: "none", textAlign: "left", fontSize: 14, fontFamily: F, cursor: "pointer", borderRadius: 8, color: "#374151" },
  menuDivider: { height: 1, background: "#f3f4f6", margin: "4px 8px" },
  overallBar: { margin: "0 20px 20px", height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  overallFill: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  catList: { padding: "0 20px", display: "flex", flexDirection: "column", gap: 14 },
  catCard: { padding: "14px 16px", background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0" },
  catHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  catName: { fontSize: 15, fontWeight: 600, color: "#374151" },
  catAmount: { fontSize: 14, fontWeight: 700 },
  catBudget: { fontWeight: 400, color: "#9ca3af" },
  barBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.5s ease" },
  overBudget: { fontSize: 12, color: "#e74c3c", margin: "6px 0 0", fontWeight: 500 },
  fab: { position: "fixed", bottom: 28, right: 28, width: 56, height: 56, borderRadius: 28, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 28, fontWeight: 300, cursor: "pointer", boxShadow: "0 4px 20px rgba(45,106,79,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  screenHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 16px", borderBottom: "1px solid #f3f4f6" },
  screenTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#111827" },
  backBtn: { background: "none", border: "none", fontSize: 14, color: "#2d6a4f", fontWeight: 600, cursor: "pointer", fontFamily: F, padding: "4px 0", width: 60, textAlign: "left" },
  saveBtn: { background: "none", border: "none", fontSize: 14, color: "#2d6a4f", fontWeight: 700, cursor: "pointer", fontFamily: F, padding: "4px 0", width: 60, textAlign: "right" },
  form: { padding: "24px 20px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" },
  input: { display: "block", width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #e5e7eb", borderRadius: 10, marginBottom: 18, fontFamily: F, outline: "none", boxSizing: "border-box", background: "#fafafa", color: "#111827", WebkitAppearance: "none" },
  select: { display: "block", width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #e5e7eb", borderRadius: 10, marginBottom: 18, fontFamily: F, outline: "none", boxSizing: "border-box", background: "#fafafa", color: "#111827" },
  primaryBtn: { display: "block", width: "100%", padding: "14px", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: F, marginTop: 8 },
  secondaryBtn: { display: "block", padding: "14px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: F },
  dangerBtn: { display: "block", width: "100%", padding: "14px", background: "#fff", color: "#e74c3c", border: "1.5px solid #fde8e8", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: F },
  catEditList: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 },
  catEditRow: { display: "flex", gap: 8, alignItems: "center" },
  emojiInput: { width: 44, height: 44, textAlign: "center", fontSize: 20, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fafafa", outline: "none" },
  deleteBtn: { background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#9ca3af", padding: "0 4px" },
  addCatRow: { display: "flex", gap: 8, alignItems: "center", padding: "0 20px", marginTop: 8 },
  addCatBtn: { width: 44, height: 44, borderRadius: 10, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 22, cursor: "pointer", flexShrink: 0 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px 20px", textAlign: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 },
  emptyDesc: { fontSize: 14, color: "#6b7280", margin: "8px 0 0", lineHeight: 1.5 },
  monthList: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 },
  monthCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, cursor: "pointer", fontFamily: F, textAlign: "left", width: "100%", gap: 8 },
  monthName: { fontSize: 15, fontWeight: 600, color: "#111827", display: "block" },
  periodDates: { fontSize: 12, color: "#9ca3af", display: "block", marginTop: 2 },
  monthMeta: { fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" },
  historySubtitle: { fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "12px 20px 8px" },
  expenseList: { padding: "0 20px", display: "flex", flexDirection: "column", gap: 8 },
  expenseCard: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 14px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12 },
  expenseLeft: { display: "flex", flexDirection: "column", gap: 2 },
  expenseCat: { fontSize: 14, fontWeight: 600, color: "#374151" },
  expenseMemo: { fontSize: 13, color: "#6b7280" },
  expenseDate: { fontSize: 12, color: "#9ca3af" },
  expenseRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  expenseAmt: { fontSize: 15, fontWeight: 700, color: "#111827" },
  tinyBtn: { background: "none", border: "none", fontSize: 13, cursor: "pointer", padding: "2px 4px" },
  historyTotal: { textAlign: "center", padding: "16px 20px", fontSize: 15, fontWeight: 700, color: "#2d6a4f" },
  empty: { textAlign: "center", color: "#9ca3af", padding: "40px 20px", fontSize: 14 },
};
