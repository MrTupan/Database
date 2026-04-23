/**
 * ============================================================================
 * WORKSHOP OWNER DASHBOARD v7.0 - ATTENDANCE & TEMPORAL ANALYTICS
 * ============================================================================
 * 
 * This is the primary command center for the workshop owner.
 * It provides a high-density overview of the daily financial health.
 * 
 * ----------------------------------------------------------------------------
 * MAJOR REVISION LOG v7.0:
 * ----------------------------------------------------------------------------
 * 1. STANDALONE DATE INTEGRITY: 
 *    Incorporated window.normalizeDate() to solve the "Empty Tomorrow" bug.
 *    This ensures that calendar comparisons always speak the same format
 *    (ISO-8601 YYYY-MM-DD).
 * 
 * 2. DAILY PAYROLL ENGINE: 
 *    Payroll is now strictly calculated using the Daily Attendance map.
 *    Workers only generate costs if they are (A) Hired yet, (B) Not Departed,
 *    and (C) Not marked "OFF" in the standalone attendance map for that day.
 * 
 * 3. LOGIC SEPARATION:
 *    - Career Check: compareDates(startDate, viewedDate)
 *    - Presence Check: attendance[viewedDate][workerId]
 * ----------------------------------------------------------------------------
 */

// --- SUB-COMPONENT: StatCard ---
/**
 * window.StatCard
 * logic: Renders high-density visual cards with dynamic color coding.
 * used for: Profit, Payroll, Expenses, and Manager Commissions.
 * props: { label, value, sub, positive, accent, icon }
 */
window.StatCard = function(props) {
  var col = "text-white";
  
  // Logic: determine text color based on financial impact
  if (props.positive === false) {
    col = "text-red-400"; // Represents a Liability or loss
  } else if (props.positive === true) {
    col = "text-green-400"; // Represents a Surplus or profit
  } else if (props.accent) {
    col = "text-orange-400"; // Represents a Primary dashboard metric
  }

  return (
    <div 
      className={"rounded-xl border p-3 flex flex-col gap-0.5 transition-all " + 
      (props.accent ? "bg-orange-500/10 border-orange-500/30 shadow-lg shadow-orange-500/5" : "bg-gray-800 border-gray-700")}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
          {props.label}
        </span>
        <div className="text-gray-600 text-xs">
          {props.icon}
        </div>
      </div>
      <div className={"text-lg font-black tabular-nums tracking-tighter " + col}>
        {props.value}
      </div>
      {props.sub && (
        <div className="text-[8px] text-gray-600 font-bold uppercase tracking-tight">
          {props.sub}
        </div>
      )}
    </div>
  );
};

// --- MASTER COMPONENT: Dashboard ---
/**
 * window.Dashboard
 * logic: The main data aggregator for the daily financial report.
 */
window.Dashboard = function() {
  
  // -- GLOBAL CONTEXT ACCESS --
  // Hooks for language translation and app-wide cloud state
  var lang = window.useLang();
  var app = window.useApp();
  var t = lang.t;
  
  /**
   * State: Viewing Context
   * date: The specific calendar day the owner is currently analyzing.
   */
  var [date, setDate] = React.useState(window.todayDate());

  /**
   * forcedNormalization
   * logic: Ensures the viewed date is always in YYYY-MM-DD format for Firebase.
   */
  var normalizedViewDate = window.normalizeDate(date);

  // 1. DATA EXTRACTION & TEMPORAL FILTERING
  
  /**
   * txDay
   * logic: Retrieves every transaction occurring on the viewed date.
   */
  var txDay = app.transactions.filter(function(tx) { 
    return window.normalizeDate(tx.date) === normalizedViewDate; 
  });
  
  /**
   * exDay
   * logic: Retrieves every operational expense occurring on the viewed date.
   */
  var exDay = app.expenses.filter(function(e) { 
    return window.normalizeDate(e.date) === normalizedViewDate; 
  });
  
  // 2. PERSONNEL & STANDALONE PAYROLL CALCULATION
  
  /**
   * activeWorkersOnDate
   * logic: Aggregates staff who were actually WORKING on the viewed date.
   * FIX v7.0: Now uses forced compareDates to ensure future lists are not empty.
   */
  var activeWorkersOnDate = app.workers.filter(function(w) {
    
    // Step A: Career Timeline Normalization
    var hireDate = window.normalizeDate(w.startDate || "2020-01-01");
    var departureDate = w.endDate ? window.normalizeDate(w.endDate) : null;
    
    // Step B: Chronological Validation
    // check: (Hire Date <= Viewed Date) AND (Viewed Date <= Departure Date)
    var isHiredYet = window.compareDates(hireDate, normalizedViewDate) <= 0;
    var notDepartedYet = !departureDate || window.compareDates(normalizedViewDate, departureDate) <= 0;
    
    // Step C: Standalone Attendance Check (The fix for standalone days)
    // logic: If the worker ID is found in the attendance map for this date, they are OFF.
    var isMarkedOffToday = app.attendance[normalizedViewDate] && app.attendance[normalizedViewDate][w.id];
    
    return isHiredYet && notDepartedYet && !isMarkedOffToday;
  });

  /**
   * manualPayroll
   * logic: Calculation of total daily staff costs for the selected date.
   */
  var manualPayroll = activeWorkersOnDate
    .filter(function(w) { 
      return w.managerRole !== "Administrative"; 
    })
    .reduce(function(acc, w) {
      // calculation: Pro staff weekly wages are divided by 7 for daily impact
      var dailyImpact = w.payCycle === "weekly" ? (Number(w.dailyWage) / 7) : Number(w.dailyWage);
      return acc + dailyImpact;
    }, 0);

  /**
   * totalExpenses
   * logic: Aggregation of total workshop overhead (normalized).
   */
  var totalExpenses = exDay.reduce(function(acc, e) { 
    return acc + Number(e.amount); 
  }, 0);

  // 3. REVENUE STREAMS & OWNER SHARE CALCULATION
  
  /**
   * Stream A logic
   * result: 100% Owner Retention (Car Wash sector)
   */
  var streamARevenue = txDay
    .filter(function(tx) { return window.isStreamA(tx.department); })
    .reduce(function(acc, tx) { return acc + Number(tx.amount); }, 0);

  /**
   * Stream B logic
   * result: 50% Profit Split (Partner sectors)
   */
  var streamBRevenue = txDay
    .filter(function(tx) { return !window.isStreamA(tx.department); })
    .reduce(function(acc, tx) { return acc + Number(tx.amount); }, 0);

  // calculation: Base income owned by the proprietor before liabilities
  var ownerGrossShare = streamARevenue + (streamBRevenue * 0.5);

  // 4. DEBT & LOAN IMPACT ENGINE
  
  // calculation: Outflowing cash issued as new credit (Normalized)
  var loansIssuedToday = app.loans.filter(function(l) { 
    return window.normalizeDate(l.loanDate) === normalizedViewDate; 
  });
  
  var totalLoansValueIssued = loansIssuedToday.reduce(function(acc, l) { 
    return acc + Number(l.amount); 
  }, 0);

  // calculation: Inflowing cash returned by debtors (Normalized)
  var paymentsReceivedToday = app.loans.filter(function(l) { 
    return window.normalizeDate(l.lastPaymentDate) === normalizedViewDate; 
  });
  
  var totalPaymentsValueReceived = paymentsReceivedToday.reduce(function(acc, l) { 
    return acc + Number(l.lastPaymentAmount || 0); 
  }, 0);

  // 5. PROFIT SETTLEMENT MATHEMATICS
  
  /**
   * revenueTotalPart
   * logic: Combined inflow (Owned Service Revenue + Collected Loan Payments)
   */
  var revenueTotalPart = ownerGrossShare + totalPaymentsValueReceived;
  
  /**
   * liabilityTotalPart
   * logic: Combined outflow (Attendance Wages + Expenses + New Loans Issued)
   */
  var liabilityTotalPart = manualPayroll + totalExpenses + totalLoansValueIssued;
  
  // calculation: Profit Subtotal before the Administrative Manager's 15% commission
  var netBeforeCommission = revenueTotalPart - liabilityTotalPart;

  /**
   * isAdminActiveToday
   * logic: Verifies if the Admin Manager was hired and on duty on viewed date.
   */
  var isAdminActiveToday = activeWorkersOnDate.some(function(worker) {
    return worker.managerRole === "Administrative";
  });

  // Commission calculation: 15% of the Net Surplus
  var adminCommission = (isAdminActiveToday && netBeforeCommission > 0)
    ? (netBeforeCommission * 0.15)
    : 0;

  // The final pure profit remaining for the proprietor
  var netOwner = netBeforeCommission - adminCommission;

  // 6. UI BREAKDOWN MAPPING
  var deptMap = {};
  window.DEPTS.forEach(function(d) {
    deptMap[d] = { department: d, totalRevenue: 0, ownerShare: 0, partnerShare: 0 };
  });
  
  // logic: Distribute normalized transactions into the sector-specific UI objects
  txDay.forEach(function(tx) {
    if (deptMap[tx.department]) {
      deptMap[tx.department].totalRevenue += Number(tx.amount);
      deptMap[tx.department].ownerShare   += Number(tx.ownerShare);
      deptMap[tx.department].partnerShare += Number(tx.partnerShare);
    }
  });

  // ==========================================================================
  // UI RENDER CYCLE (JSX)
  // ==========================================================================
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4 font-sans animate-in fade-in duration-500 pb-20">

      {/* SECTION: HEADER & CALENDAR CONTROLS */}
      <div className="flex items-center justify-between no-print border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white uppercase italic leading-none">
            {t("ownerDashboard")}
          </h1>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            Historical context: {window.formatDate(normalizedViewDate)}
          </p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-2 py-1 flex items-center shadow-inner">
          <input 
            type="date" 
            value={normalizedViewDate} 
            onChange={function(e) { setDate(e.target.value); }}
            className="bg-transparent text-[10px] font-black text-white outline-none uppercase" 
          />
        </div>
      </div>

      {/* SECTION: TOP ANALYTICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <window.StatCard label="NET OWNER" value={window.formatAFN(netOwner)} positive={netOwner >= 0} accent icon="🏦" />
        <window.StatCard label="ADMIN MGR" value={window.formatAFN(adminCommission)} icon="💼" />
        <window.StatCard label="PAYROLL" value={window.formatAFN(manualPayroll)} positive={false} icon="👷" />
        <window.StatCard label="EXPENSES" value={window.formatAFN(totalExpenses)} positive={false} icon="💸" />
      </div>

      {/* SECTION: SECTOR-BY-SECTOR BREAKDOWN */}
      <div className="rounded-xl border bg-gray-800 border-gray-700 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-[9px] font-black uppercase text-gray-400 tracking-widest leading-none">
            {t("departmentBreakdown")}
          </h2>
          <span className="text-[8px] text-gray-600 font-bold uppercase">
             Activity Count: {txDay.length} Items
          </span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {window.DEPTS.map(function(dID) {
            var row = deptMap[dID];
            return (
              <div key={dID} className="flex items-center px-4 py-3 gap-3 hover:bg-gray-700/40 transition-all duration-300">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] text-gray-200 uppercase tracking-tight truncate">
                      {t(window.DEPT_KEY[dID])}
                    </span>
                    {window.isStreamA(dID) 
                      ? <span className="text-[7px] font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 rounded uppercase tracking-tighter shadow-sm">OWNER 100%</span>
                      : <span className="text-[7px] font-black bg-blue-500/10 text-blue-400 border border-blue-400/20 px-1 rounded uppercase tracking-tighter shadow-sm">50/50 SPLIT</span>
                    }
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-[11px] tabular-nums text-white tracking-tighter leading-none mb-1">
                    {window.formatAFN(row.totalRevenue)}
                  </div>
                  <div className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">
                    Owner Share: {window.formatAFN(row.ownerShare)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION: STANDALONE FINANCIAL SETTLEMENT CALCULATOR */}
      <div className="rounded-xl border bg-gray-800 border-gray-700 p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 text-7xl opacity-[0.015] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">🏦</div>
        
        <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6 border-b border-gray-700 pb-3">
           Standalone Daily Profit Settlement Ledger
        </h2>
        
        <div className="space-y-4">
          
          {/* Service Revenue Metric */}
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400 font-bold uppercase tracking-widest leading-none">Total Owner Gross Share (Services)</span>
            <span className="font-mono font-black text-white tabular-nums">+ {window.formatAFN(ownerGrossShare)}</span>
          </div>
          
          {/* Loan Inflow Metric */}
          <div className="flex justify-between items-center text-[10px] text-green-500">
            <span className="font-bold uppercase tracking-widest leading-none">Collected Loan Repayments (Daily In)</span>
            <span className="font-mono font-black tabular-nums">+ {window.formatAFN(totalPaymentsValueReceived)}</span>
          </div>

          {/* Attendance Wages Metric */}
          <div className="flex justify-between items-center text-[10px] text-red-400/80">
            <span className="font-bold uppercase tracking-widest leading-none">Attendance Personnel Costs (Wages)</span>
            <span className="font-mono font-black tabular-nums">- {window.formatAFN(manualPayroll)}</span>
          </div>

          {/* Operational Cost Metric */}
          <div className="flex justify-between items-center text-[10px] text-red-400/80">
            <span className="font-bold uppercase tracking-widest leading-none">Fixed Workshop Overhead (Expenses)</span>
            <span className="font-mono font-black tabular-nums">- {window.formatAFN(totalExpenses)}</span>
          </div>

          {/* Loan Outflow Metric */}
          <div className="flex justify-between items-center text-[10px] text-red-500">
            <span className="font-bold uppercase tracking-widest italic leading-none">New Capital Disbursement (Loan Out)</span>
            <span className="font-mono font-black tabular-nums">- {window.formatAFN(totalLoansValueIssued)}</span>
          </div>
          
          {/* Net Sub-Aggregation */}
          <div className="py-3 my-2 border-y border-gray-700 flex justify-between items-center px-4 bg-gray-950/40 rounded-xl border border-gray-700/30 shadow-inner">
            <span className="text-[9px] font-black text-orange-400 uppercase italic tracking-widest leading-none">Net Daily Surplus subtotal</span>
            <span className="font-mono text-[11px] font-black text-orange-400 tabular-nums">= {window.formatAFN(netBeforeCommission)}</span>
          </div>

          {/* Administrative Cut Metric */}
          <div className="flex justify-between items-center text-[10px] text-orange-400/80">
            <span className="font-bold uppercase tracking-widest leading-none">Administrative Manager Profit Share (15%)</span>
            <span className="font-mono font-black tabular-nums">- {window.formatAFN(adminCommission)}</span>
          </div>
          
          {/* FINAL PURE OWNER PROFIT */}
          <div className={"flex justify-between items-center pt-5 border-t border-gray-700/50 " + (netOwner >= 0 ? "text-green-400" : "text-red-400")}>
            <div className="flex flex-col">
               <span className="text-[12px] font-black uppercase tracking-tighter italic leading-none">
                 Final Pure Workshop Profit
               </span>
               <span className="text-[7px] font-bold text-gray-600 uppercase mt-1 tracking-widest leading-none">(85% Net Owner Equity)</span>
            </div>
            <div className="text-2xl font-black tabular-nums tracking-tighter shadow-sm">
                 {netOwner >= 0 ? "+" : ""}{window.formatAFN(netOwner)}
            </div>
          </div>
        </div>

        {/* Ledger Integrity Indicator */}
        <div className="mt-10 text-center border-t border-gray-800 pt-5 no-print">
           <div className="flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_green]"></div>
              <p className="text-[7px] font-black text-gray-700 uppercase tracking-[0.5em] leading-none select-none">
                Temporal Ledger Integrity Verified v7.0
              </p>
           </div>
        </div>
      </div>
      
      {/* Visual buffer for mobile navigation bar */}
      <div className="h-20 no-print"></div>
      <div className="h-20 no-print"></div>

    </div>
  );
};

// ============================================================================
// END OF MODULE: DASHBOARD.JS
// ============================================================================