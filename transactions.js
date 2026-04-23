// ============================================================================
// COMPONENT: REVENUE ENTRY & TRANSACTIONS (MODULAR JS)
// ============================================================================
// WORKSHOP REVENUE MANAGEMENT SYSTEM v4.8 - MASTER PROFIT ENGINE
// ============================================================================
// 
// This module handles the recording of all daily income across 7 departments.
// It features a high-precision margin engine specifically for Oil Sales.
//
// HIGH-PRECISION MARGIN LOGIC FOR OIL SALES:
// 1. BRAND SYNC: Pulls 'buyingPrice' (Our Cost) and 'sellingPrice' (Client Rate).
// 2. CALCULATION:
//    - Standard: Gross Sales = Liters * Selling Price.
//    - Discounted: Gross Sales = Agreed Price (Manual entry).
//    - Profit: Gross Sales - (Liters * Buying Price).
// 3. DASHBOARD INTEGRATION: 
//    - The primary 'amount' saved is the REAL PROFIT (Net Margin).
//    - This ensures the Owner Dashboard profit reflects actual earnings.
// 4. PARTNER VIEW INTEGRATION:
//    - The 'grossRevenue' (Actual Total Collected) is saved separately.
// 
// SYSTEM STANDARDS:
// - Timezone: Asia/Kabul (UTC +4:30) via utils.js todayDate function.
// - Precision: Number() casting prevents float math errors in AFN currency.
// - UI: Ultra-compact design for mobile Android AIDE environment.
// ============================================================================

window.Transactions = function({ role }) {
  
  // -- GLOBAL DATA ACCESS --
  // Translation hook for multi-language UI (English, Dari, Pashto)
  const { t } = window.useLang();
  
  // Accessing master cloud state and database write functions from context
  const { 
    transactions, 
    addTransaction, 
    delTransaction, 
    oilInventory 
  } = window.useApp();
  
  // -- COMPONENT UI STATE --
  
  // The date of the transaction (defaults to current date in Kabul)
  const [date, setDate] = React.useState(window.todayDate());
  
  // The selected workshop department (defaults to Car Wash)
  const [dept, setDept] = React.useState("car_wash");
  
  // The amount field (Calculated Profit for Oil / Total Revenue for others)
  const [amt,  setAmt]  = React.useState("");
  
  // Optional text description for the specific service provided
  const [desc, setDesc] = React.useState("");
  
  // -- OIL INVENTORY LOGIC STATE --
  
  // Selected oil brand unique identifier from the inventory list
  const [oilID, setOilID] = React.useState("");
  
  // Numeric volume of oil sold in liters
  const [liters, setLiters] = React.useState("");

  // Manual agreed price for custom discounts (The "Total" the client pays)
  const [agreedPrice, setAgreedPrice] = React.useState("");
  
  // Flag to lock the amount field if the user manually edits the profit
  const [isManualAmt, setIsManualAmt] = React.useState(false);
  
  // Helper state to show the user the Gross (Total) value during data entry
  const [grossDisplayValue, setGrossDisplayValue] = React.useState(0);
  
  // Security Level check: Editor vs Monitor
  const isEditor = role === "editor";

  // --- AUTOMATED MARGIN CALCULATION ENGINE ---
  // This logic runs automatically to provide real-time feedback in the UI
  React.useEffect(function() {
    // Only execute if in Oil Sales mode and brand/liters are selected
    if (dept === "oil_sales" && oilID && liters && !isManualAmt) {
      
      const brandData = oilInventory.find(function(b) { 
        return b.id === oilID; 
      });
      
      if (brandData) {
        let revenueTotal;
        
        // Logic: Use manual agreed price if provided, otherwise use standard rate
        if (agreedPrice && parseFloat(agreedPrice) > 0) {
          revenueTotal = parseFloat(agreedPrice);
        } else {
          revenueTotal = Number(brandData.sellingPrice) * parseFloat(liters);
        }

        const costTotal = Number(brandData.buyingPrice) * parseFloat(liters);
        const profitTotal = revenueTotal - costTotal;
        
        // Update the visual fields
        setAmt(profitTotal.toString());
        setGrossDisplayValue(revenueTotal);
      }
    }
  }, [oilID, liters, agreedPrice, dept, oilInventory, isManualAmt]);

  // --- DATA FILTERING & AGGREGATION ---
  // Filter transactions to show only those belonging to the selected date
  const txDay = transactions.filter(function(tx) { 
    return tx.date === date; 
  });
  
  // Aggregation logic to calculate the total daily profit for the list header
  const dailyTotalRevenue = txDay.reduce(function(acc, tx) { 
    return acc + Number(tx.amount); 
  }, 0);

  // --- CLOUD WRITE HANDLER ---
  // Validates and packages the data before sending to Firebase
  function handleFormSubmit(e) {
    // Prevent default form browser behavior
    e.preventDefault();
    
    // Strict Validation: Amount must be provided
    if (!amt) return;
    
    // Logic Variables for Database Entry
    let finalGrossToSave = 0; 
    let snapshotCostPrice = 0;

    // --- CRITICAL RE-CALCULATION BLOCK ---
    // We do not rely on state here. We re-calculate purely from raw inputs.
    if (dept === "oil_sales" && oilID) {
      const activeBrand = oilInventory.find(function(b) { return b.id === oilID; });
      if (activeBrand) {
          // 1. Get the cost snapshot
          snapshotCostPrice = Number(activeBrand.buyingPrice);
          
          // 2. Determine TOTAL SALES (GROSS)
          const manualPrice = parseFloat(agreedPrice);
          const qty = parseFloat(liters);
          const standardPricePerLiter = Number(activeBrand.sellingPrice);

          if (manualPrice > 0) {
              // RULE: If agreed price was typed, TOTAL SALES = just agreed price
              finalGrossToSave = manualPrice;
          } else {
              // RULE: If empty, TOTAL SALES = selling price * liters
              finalGrossToSave = standardPricePerLiter * qty;
          }
      }
    } else {
      // For standard services, Gross and Profit are identical
      finalGrossToSave = parseFloat(amt);
    }

    // Prepare the final JSON payload for the database
    const transactionPayload = {
      id: Date.now().toString(), 
      date: date,
      department: dept,
      amount: parseFloat(amt), // THE PURE PROFIT
      description: desc,
      oilBrandID: dept === "oil_sales" ? oilID : "none",
      oilLiters: dept === "oil_sales" ? parseFloat(liters) : 0,
      // CRITICAL: This is the field that was showing 0 in your Log
      grossRevenue: finalGrossToSave, 
      oilBuyPriceAtSale: snapshotCostPrice,
      timestamp: new Date().toISOString()
    };

    // Push record to the cloud via the useApp context
    // IMPORTANT: Make sure contexts.js accepts 'grossRevenue' inside addTransaction!
    addTransaction(transactionPayload);
    
    // Reset UI state for the next entry
    setAmt("");
    setDesc("");
    setLiters("");
    setAgreedPrice("");
    setGrossDisplayValue(0);
    setIsManualAmt(false);
  }

  // Handle manual changes to the profit field directly
  function handleManualAmountChange(e) {
    setAmt(e.target.value);
    if (dept === "oil_sales") {
      setIsManualAmt(true);
    }
  }

  // ==========================================================================
  // UI RENDERING - ULTRA-COMPACT WORKSHOP DESIGN
  // ==========================================================================
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4 font-sans animate-in fade-in duration-500 pb-20">
      
      {/* 1. TOP HEADER & DATE CONTROLS */}
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div className="border-l-2 border-orange-500 pl-3">
          <h1 className="text-lg font-black text-white uppercase italic leading-none">
            {t("revenueEntry")}
          </h1>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            {t("recordDailyRevenue")}
          </p>
        </div>
        
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-2 py-1 flex items-center shadow-inner">
          <span className="text-[10px] mr-1">📅</span>
          <input 
            type="date" 
            value={date} 
            onChange={function(e) { setDate(e.target.value); }}
            className="bg-transparent text-[10px] font-black text-white outline-none uppercase" 
          />
        </div>
      </div>

      {/* 2. DYNAMIC ENTRY FORM */}
      {isEditor ? (
        <div className="rounded-xl border bg-gray-800 border-gray-700 p-4 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl pointer-events-none">➕</div>
          
          <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 border-b border-gray-700 pb-2">
            {t("recordTransaction")}
          </h2>
          
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            
            <div className="md:col-span-1">
              <label className="block text-[9px] font-black uppercase text-gray-500 mb-1 ml-1">Sector</label>
              <select 
                value={dept} 
                onChange={function(e) { setDept(e.target.value); setIsManualAmt(false); }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none appearance-none cursor-pointer font-bold"
              >
                {window.DEPTS.map(function(id) {
                  return <option key={id} value={id}>{t(window.DEPT_KEY[id])}</option>;
                })}
              </select>
            </div>

            {dept === "oil_sales" ? (
              <React.Fragment>
                <div className="md:col-span-1 animate-in zoom-in duration-200">
                  <label className="block text-[9px] font-black uppercase text-orange-500 mb-1 ml-1">Brand</label>
                  <select 
                    required 
                    value={oilID} 
                    onChange={function(e) { setOilID(e.target.value); setIsManualAmt(false); }}
                    className="w-full rounded-lg border border-orange-500/30 bg-gray-900 px-3 py-2 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none appearance-none cursor-pointer font-bold shadow-inner"
                  >
                    <option value="">Select Stock...</option>
                    {oilInventory.map(function(brand) {
                      return <option key={brand.id} value={brand.id}>{brand.name}</option>;
                    })}
                  </select>
                </div>
                
                <div className="md:col-span-1 animate-in zoom-in duration-200">
                  <label className="block text-[9px] font-black uppercase text-orange-500 mb-1 ml-1">Volume (L)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    placeholder="0.0" 
                    required 
                    value={liters}
                    onChange={function(e) { setLiters(e.target.value); setIsManualAmt(false); }}
                    className="w-full rounded-lg border border-orange-500/30 bg-gray-900 px-3 py-2 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all font-black shadow-inner" 
                  />
                </div>

                <div className="md:col-span-1 animate-in zoom-in duration-200">
                  <label className="block text-[9px] font-black uppercase text-blue-400 mb-1 ml-1">Agreed Price (Optional)</label>
                  <input 
                    type="number" 
                    placeholder="Discounted Total" 
                    value={agreedPrice}
                    onChange={function(e) { setAgreedPrice(e.target.value); setIsManualAmt(false); }}
                    className="w-full rounded-lg border border-blue-500/30 bg-gray-900 px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all font-black shadow-inner" 
                  />
                </div>
              </React.Fragment>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-gray-500 mb-1 ml-1 uppercase tracking-tighter">
                  {t("descriptionOptional")}
                </label>
                <input 
                  type="text" 
                  placeholder={t("oilChange")} 
                  value={desc}
                  onChange={function(e) { setDesc(e.target.value); }}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all shadow-inner" 
                />
              </div>
            )}

            <div className="md:col-span-1">
              <label className="block text-[9px] font-black text-gray-500 mb-1 ml-1 uppercase">
                {dept === 'oil_sales' ? 'Workshop Profit' : 'Final AFN'}
              </label>
              <input 
                type="number" 
                required 
                value={amt}
                onChange={handleManualAmountChange}
                className={"w-full rounded-lg border px-3 py-2 text-xs text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all font-black tabular-nums " + 
                  (dept === "oil_sales" ? "bg-gray-800 border-green-500/40 text-green-400" : "bg-gray-900 border-gray-600")} 
              />
            </div>

            <div className="md:col-span-4 flex items-end pt-2">
              <button 
                type="submit" 
                disabled={!amt}
                className="w-full bg-orange-500 text-gray-900 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-400 active:scale-95 transition-all shadow-lg shadow-orange-500/10 disabled:opacity-20"
              >
                {t("add")} TRANSACTION TO DATABASE
              </button>
            </div>
          </form>

          {/* DYNAMIC PREVIEW BOX */}
          {dept === "oil_sales" && liters > 0 && (
            <div className="mt-4 p-3 bg-gray-950/50 rounded-xl border border-gray-700 flex justify-between items-center animate-in fade-in duration-500">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Gross Sales Collection</span>
                <span className="text-[12px] font-black text-white tabular-nums">{window.formatAFN(grossDisplayValue)}</span>
              </div>
              <div className="w-px h-6 bg-gray-700 mx-4"></div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Net Workshop Profit</span>
                <span className="text-[12px] font-black text-green-400 tabular-nums">{window.formatAFN(amt)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 px-1 opacity-70">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-lg"></div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">
              {window.isStreamA(dept) 
                ? t("streamANote") 
                : t("splitNote") + (amt ? " (" + window.formatAFN(parseFloat(amt || 0) * 0.5) + " " + t("splitEach") + ")" : "")
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4 shadow-lg border-dashed">
          <div className="text-3xl grayscale opacity-50">👁️</div>
          <p className="text-[10px] text-blue-300 font-bold italic opacity-70 uppercase tracking-widest leading-loose">
             Registry Audit Active. Switching to modifier mode is required for creating or erasing historical transaction records.
          </p>
        </div>
      )}

      {/* 3. MASTER TRANSACTION LOG DATA TABLE */}
      <div className="rounded-xl border bg-gray-800 border-gray-700 overflow-hidden shadow-2xl">
        
        <div className="px-5 py-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
             Log: {window.formatDate(date)}
          </h2>
          <div className="flex items-center gap-2">
             <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Range Total (Profit):</span>
             <span className="font-black text-sm tabular-nums text-white bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-800 shadow-inner">
               {window.formatAFN(dailyTotalRevenue)}
             </span>
          </div>
        </div>

        <div className="divide-y divide-gray-700/50">
          {txDay.length === 0 ? (
            <div className="p-16 text-center text-gray-700 border-t border-gray-900/50">
              <div className="text-5xl mb-4 opacity-5">📋</div>
              <p className="italic text-[10px] font-black uppercase tracking-[0.3em] opacity-20">{t("noTransactionsForDate")}</p>
            </div>
          ) : (
            txDay.map(function(item) {
              const brandLink = oilInventory.find(function(b) { 
                return b.id === item.oilBrandID; 
              });
              
              return (
                <div key={item.id} className={"flex items-center px-6 py-4 gap-4 hover:bg-gray-700/40 transition-all duration-300 group " + (item.department === 'oil_sales' ? 'bg-green-500/[0.01]' : '')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="font-black text-[12px] text-gray-100 uppercase tracking-tight group-hover:text-orange-400 transition-colors">
                        {t(window.DEPT_KEY[item.department] || "carWash")}
                      </span>
                      {window.isStreamA(item.department)
                        ? <span className="text-[7px] font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1.5 py-0.5 rounded shadow-sm">{t("streamA")}</span>
                        : <span className="text-[7px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded shadow-sm">{t("split")}</span>
                      }
                    </div>
                    
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-3">
                      {item.department === "oil_sales" && item.oilBrandID !== "none" ? (
                        <span className="text-orange-500/70 italic bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                          {brandLink ? brandLink.name : 'Legacy Line'} | {item.oilLiters}L SOLD | TOTAL SALES: {window.formatAFN(item.grossRevenue)}
                        </span>
                      ) : (
                        item.description ? `NOTE: ${item.description}` : "SERVICE EXECUTION"
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-black text-[13px] tabular-nums text-white tracking-tighter leading-none mb-1">
                      {item.department === "oil_sales" ? "PROFIT: " : ""}{window.formatAFN(item.amount)}
                    </div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                       {item.department === "oil_sales" ? "NET WORKSHOP MARGIN" : ("Owner Cut: " + window.formatAFN(item.amount))} 
                    </div>
                  </div>

                  {isEditor && (
                    <button 
                      onClick={function() { if(confirm("Permanently erase record?")) delTransaction(item.id); }}
                      className="w-10 h-10 flex items-center justify-center rounded-2xl bg-red-500/5 text-gray-600 hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-75 shadow-xl border border-transparent hover:border-red-500/30"
                      title="Delete Record"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="h-24 border-t border-gray-900 mt-20 opacity-30 flex flex-col items-center justify-center gap-2 select-none">
         <p className="text-[8px] font-black uppercase tracking-[1.5em] text-gray-600">DATABASE LEDGER</p>
         <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
      </div>
      
      <div className="h-20 no-print"></div>
    </div>
  );
};

// ============================================================================
// END OF MODULE: TRANSACTIONS.JS
// ============================================================================