/* --- COMPONENT: WORKSHOP EXPENSES --- */
// Handles logging of overhead costs like fuel, electricity, or repairs
window.Expenses = function({ role }) {
  const { t } = window.useLang();
  const { expenses, addExpense, delExpense } = window.useApp();
  
  // Local state for the entry form
  const [date, setDate] = React.useState(window.todayDate());
  const [desc, setDesc] = React.useState("");
  const [amt,  setAmt]  = React.useState("");
  
  // Role-based permission check
  const isEditor = role === "editor";

  // Filter expenses from cloud data for the selected date
  const exDay = expenses.filter(function(e) { 
    return e.date === date; 
  });
  
  // Calculate total expense amount for the selected day
  const totalDailyExpense = exDay.reduce(function(acc, e) { 
    return acc + Number(e.amount); 
  }, 0);

  // Handle saving a new expense to the cloud
  function handleSubmit(e) {
    e.preventDefault();
    if (!desc || !amt || parseFloat(amt) <= 0) return;
    
    addExpense({
      date: date,
      description: desc,
      amount: parseFloat(amt)
    });
    
    // Clear inputs after success
    setDesc("");
    setAmt("");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans animate-in fade-in duration-500">
      
      {/* HEADER & DATE PICKER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{t("workshopExpensesTitle")}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t("logDailyOverhead")}</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
          <span className="ps-2 text-xs font-bold text-gray-500">📅</span>
          <input 
            type="date" 
            value={date} 
            onChange={function(e) { setDate(e.target.value); }}
            className="bg-transparent text-sm text-white focus:outline-none px-2 py-1" 
          />
        </div>
      </div>

      {/* EXPENSE ENTRY FORM (Visible only to Editor) */}
      {isEditor ? (
        <div className="rounded-2xl border bg-gray-800 border-gray-700 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-4xl">💸</div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-6">
            {t("addExpense")}
          </h2>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Description Input */}
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-1">{t("description")}</label>
              <input 
                type="text" 
                required 
                placeholder={t("generatorFuel")} 
                value={desc}
                onChange={function(e) { setDesc(e.target.value); }}
                className="w-full rounded-xl border border-gray-600 bg-gray-900 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
              />
            </div>

            {/* Amount Input */}
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-1">{t("amountAFN")}</label>
              <input 
                type="number" 
                min="0" 
                step="1" 
                placeholder="0" 
                required 
                value={amt}
                onChange={function(e) { setAmt(e.target.value); }}
                className="w-full rounded-xl border border-gray-600 bg-gray-900 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button 
                type="submit" 
                disabled={!desc || !amt}
                className="w-full bg-orange-500 text-gray-900 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-orange-400 active:scale-95 transition disabled:opacity-50 shadow-lg shadow-orange-500/20"
              >
                + {t("add")}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* MONITOR MESSAGE */
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 flex items-center gap-3">
          <span className="text-xl">📊</span>
          <p className="text-sm text-orange-400/80 font-medium italic">
             Viewing overhead costs. Switching to Editor mode allows logging new workshop expenses.
          </p>
        </div>
      )}

      {/* EXPENSES HISTORY LIST */}
      <div className="rounded-2xl border bg-gray-800 border-gray-700 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
            {t("expensesLabel")} — {window.formatDate(date)}
          </h2>
          {totalDailyExpense > 0 && (
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-gray-500 uppercase">{t("total")}:</span>
               <span className="font-black text-sm tabular-nums text-red-400 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                 {window.formatAFN(totalDailyExpense)}
               </span>
            </div>
          )}
        </div>

        {exDay.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="text-4xl mb-4 opacity-20">📂</div>
            <p className="text-sm italic">{t("noExpensesForDate")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {exDay.map(function(e) {
              return (
                <div key={e.id} className="flex items-center px-5 py-4 gap-4 hover:bg-gray-700/40 transition-colors">
                  <div className="flex-1 min-w-0 font-bold text-sm text-gray-200">
                    {e.description}
                  </div>
                  
                  <div className="text-right">
                    <div className="font-black text-sm tabular-nums text-red-400">
                      {window.formatAFN(e.amount)}
                    </div>
                  </div>

                  {/* Delete button (Editor only) */}
                  {isEditor && (
                    <button 
                      onClick={function() { if(confirm("Remove this expense?")) delExpense(e.id); }}
                      className="p-2 rounded-lg bg-red-500/5 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-90"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SUMMARY NOTE */}
      <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 flex items-start gap-3">
         <span className="text-gray-500 mt-0.5">ℹ️</span>
         <p className="text-[11px] text-gray-500 leading-relaxed uppercase tracking-wider font-bold">
           All logged expenses are deducted 100% from the Owner's net profit calculation on the dashboard. 
           These figures do not affect Partner revenue shares.
         </p>
      </div>

    </div>
  );
};