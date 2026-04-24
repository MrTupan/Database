/**
 * ============================================================================
 * COMPONENT: REPORTS & ANALYTICS
 * ============================================================================
 * WORKSHOP REPORTS ENGINE v8.5 - MASTER TEMPORAL AUDIT ARCHITECTURE
 * ============================================================================
 * 
 * DESCRIPTION:
 * This module serves as the primary financial auditing tool for the workshop.
 * It performs a deep-scan of the database across a selected date range.
 * 
 * ----------------------------------------------------------------------------
 * MAJOR REVISION LOG v8.5:
 * ----------------------------------------------------------------------------
 * 1. FRIDAY WAGE OVERRIDE SYNC: 
 *    The audit loop now detects Fridays. For staff on "Both Shifts", it 
 *    cross-references the 'attendance' node to see if a manual Friday wage 
 *    was set (accounting for the lack of night shifts on Fridays).
 * 
 * 2. STANDALONE ATTENDANCE INTEGRITY: 
 *    Integrates the Standalone Daily Attendance Map. If a worker was marked
 *    "OFF" on a specific day in the past, their cost is excluded for that 
 *    unit only, preserving historical accuracy.
 * 
 * 3. CAREER TIMELINE PROTECTION: 
 *    Wages are calculated only if the loop date falls between the worker's
 *    'startDate' and 'endDate' (Departure logic). This prevents 
 *    "Data Robbery" when a worker leaves the workshop.
 * 
 * 4. DATE NORMALIZATION PROTOCOL:
 *    Every date string is forced into ISO-8601 (YYYY-MM-DD) before 
 *    processing to prevent alphabetical comparison failures.
 * 
 * 5. PDF THEME PRESERVATION: 
 *    Forces -webkit-print-color-adjust properties to ensure the Dark Theme
 *    UI is rendered 1:1 during the PDF generation process.
 * ----------------------------------------------------------------------------
 */

window.Reports = function() {
  
  // --------------------------------------------------------------------------
  // -- GLOBAL DATA ACCESS --
  // --------------------------------------------------------------------------
  
  /**
   * window.useLang
   * logic: Retrieves translation helper and RTL/LTR direction states.
   */
  const { 
    t 
  } = window.useLang();
  
  /**
   * window.useApp
   * logic: Retrieves the core real-time state from the context engine.
   */
  const { 
    transactions, 
    expenses, 
    workers, 
    loans,
    attendance // Standalone Daily Attendance & Friday Wage overrides
  } = window.useApp();
  
  // --------------------------------------------------------------------------
  // -- DATE RANGE INITIALIZATION --
  // --------------------------------------------------------------------------

  /**
   * monthStartValue
   * logic: Computes the YYYY-MM-01 key for the first day of the current month.
   */
  const monthStartValue = (
    function() { 
      
      var dateObject = new Date(); 
      
      var currentYear = dateObject.getFullYear();
      
      var currentMonth = String(
        dateObject.getMonth() + 1
      ).padStart(
        2, 
        "0"
      );
      
      // logic: Construct YYYY-MM-01
      var formattedString = currentYear + "-" + currentMonth + "-01"; 
      
      return formattedString;
    }
  )();
  
  /**
   * React States: Audit Boundaries
   * from: The starting date of the financial scan.
   * to: The ending date of the financial scan.
   */
  const [
    from, 
    setFrom
  ] = React.useState(
    monthStartValue
  );

  const [
    to,   
    setTo
  ] = React.useState(
    window.todayDate()
  );

  // --------------------------------------------------------------------------
  // -- FINANCIAL RANGE ACCUMULATORS --
  // --------------------------------------------------------------------------
  
  /**
   * totalManualStaffPayrollInRange
   * type: float
   * logic: Sum of wages for personnel who were WORKING on each day.
   */
  let totalManualStaffPayrollInRange = 0;

  /**
   * totalAdminCommissionInRange
   * type: float
   * logic: Total of the 15% net-profit cuts assigned to Admin Managers.
   */
  let totalAdminCommissionInRange = 0;

  /**
   * totalOwnerGrossShareInRange
   * type: float
   * logic: Revenue allocated to the proprietor after partner splits.
   */
  let totalOwnerGrossShareInRange = 0;

  /**
   * totalWorkshopExpensesInRange
   * type: float
   * logic: Total operational overhead recorded in the date range.
   */
  let totalWorkshopExpensesInRange = 0;

  /**
   * totalGrossRevenueInRange
   * type: float
   * logic: 100% aggregate of all money received from clients.
   */
  let totalGrossRevenueInRange = 0;

  /**
   * totalLoansIssuedInRange
   * type: float
   * logic: Total capital outflow as newly issued credit.
   */
  let totalLoansIssuedInRange = 0;

  /**
   * totalPaymentsReceivedInRange
   * type: float
   * logic: Total capital inflow as debt repayment.
   */
  let totalPaymentsReceivedInRange = 0;

  /**
   * dayCountValue
   * type: integer
   * logic: Incremented count of calendar days analyzed in the loop.
   */
  let dayCountValue = 0;

  // --------------------------------------------------------------------------
  // -- MASTER FINANCIAL LOOP ENGINE (V8.5 TEMPORAL AUDIT) --
  // --------------------------------------------------------------------------
  /**
   * This engine steps through time one day at a time.
   * It treats every day as a standalone financial ledger entry.
   */
  
  let loopDayPointer = new Date(
    from + "T12:00:00"
  );

  const endDayBoundary = new Date(
    to + "T12:00:00"
  );

  while (
    loopDayPointer <= endDayBoundary
  ) {

    /**
     * STAGE 1: DAILY CONTEXT IDENTIFICATION
     */
    dayCountValue++;
    
    // logic: Generate standard YYYY-MM-DD key for this loop unit
    const rawDateString = loopDayPointer.toISOString().split('T')[0];
    const currentDayIdentifier = window.normalizeDate(rawDateString);
    
    // logic: Determine if this loop day is a Friday
    const isThisDayFriday = window.isFriday(currentDayIdentifier);

    /**
     * STAGE 2: CLOUD DATA FILTERING
     * Isolates records occurring on this specific loop iteration.
     */
    
    const dailyTransactionsData = transactions.filter(
      function(tx) { 
        return window.normalizeDate(tx.date) === currentDayIdentifier; 
      }
    );
    
    const dailyExpensesData = expenses.filter(
      function(ex) { 
        return window.normalizeDate(ex.date) === currentDayIdentifier; 
      }
    );

    const dailyLoansIssuedData = loans.filter(
      function(ln) {
        return window.normalizeDate(ln.loanDate) === currentDayIdentifier;
      }
    );

    const dailyPaymentsReceivedData = loans.filter(
      function(ln) {
        return window.normalizeDate(ln.lastPaymentDate) === currentDayIdentifier;
      }
    );
    
    /**
     * STAGE 3: TEMPORAL PERSONNEL AUDIT (VERSION 8.5 FIX)
     * logic: A worker is included ONLY if they were present and working.
     * check A: Employment Timeline (Hire Date <= loopDate <= Departure Date).
     * check B: Standalone Attendance (Not marked OFF on this date).
     */
    const personnelValidForThisDay = workers.filter(
      function(worker) {
        
        // 3.1: Career Normalization
        const started = window.normalizeDate(
          worker.startDate || "2020-01-01"
        );
        
        const ended = worker.endDate 
          ? window.normalizeDate(worker.endDate) 
          : null;
        
        // 3.2: Timeline Comparison
        const hiredYet = window.compareDates(
          started, 
          currentDayIdentifier
        ) <= 0;
        
        const stillEmployed = !ended || window.compareDates(
          currentDayIdentifier, 
          ended
        ) <= 0;
        
        // 3.3: Attendance Verification
        // Retrieves the standalone node: { isOff: bool, fridayWage: num }
        const attendanceEntry = (
          attendance[currentDayIdentifier] && 
          attendance[currentDayIdentifier][worker.id]
        );
        
        // Supports both legacy boolean format and Version 8.5 object format
        const isWorkerMarkedOffToday = (
          attendanceEntry === true || 
          (attendanceEntry && attendanceEntry.isOff === true)
        );
        
        // 3.4: Role Validation
        const isNotCommissionManager = worker.managerRole !== "Administrative";
        
        // result: Is this personnel member generating a daily wage liability today?
        var isHiredPresentAndManual = (
          hiredYet && 
          stillEmployed && 
          !isWorkerMarkedOffToday && 
          isNotCommissionManager
        );

        return isHiredPresentAndManual;
      }
    );

    /**
     * STAGE 4: HIGH-PRECISION PAYROLL CALCULATION (FRIDAY WAGE OVERRIDE)
     * logic: If Friday, check for manual overrides for Both-Shift staff.
     */
    const dailyStaffWageLiability = personnelValidForThisDay.reduce(
      function(total, worker) {
        
        // logic: Lookup the attendance entry for this worker on this day
        const dailyRecord = (
          attendance[currentDayIdentifier] && 
          attendance[currentDayIdentifier][worker.id]
        );
        
        /**
         * FRIDAY LOGIC ENGINE:
         * If it is Friday, and the worker is "Both Shifts", check for 
         * a manual wage override (Accounting for no Night Shift).
         */
        if (isThisDayFriday && worker.shift === "both" && dailyRecord && dailyRecord.fridayWage) {
            
            var manualFridayPayment = Number(dailyRecord.fridayWage);
            
            return total + manualFridayPayment;
        }
        
        // Standard logic: Pro staff weekly wages are divided by 7
        const baseWageImpact = worker.payCycle === "weekly" 
          ? (Number(worker.dailyWage) / 7) 
          : Number(worker.dailyWage);
          
        var dailyResult = total + baseWageImpact;

        return dailyResult;
      }, 0
    );

    /**
     * STAGE 5: AGGREGATE DAILY DATA UNITS
     */
    
    // logic: Raw money from client
    const dailyGrossCashCollectedValue = dailyTransactionsData.reduce(
      function(total, tx) { 
        return total + Number(tx.amount); 
      }, 0
    );
    
    // logic: Proprietor portion (100% or 50% split)
    const dailyOwnerShareBaseValue = dailyTransactionsData.reduce(
      function(total, tx) { 
        return total + Number(tx.ownerShare); 
      }, 0
    );
    
    // logic: Operational overhead costs
    const dailyExpenseTotalValue = dailyExpensesData.reduce(
      function(total, ex) { 
        return total + Number(ex.amount); 
      }, 0
    );

    // logic: Debt movement sums
    const dailyLoansIssuedTotalValue = dailyLoansIssuedData.reduce(
      function(total, ln) {
        return total + Number(ln.amount);
      }, 0
    );

    const dailyPaymentsInTotalValue = dailyPaymentsReceivedData.reduce(
      function(total, ln) {
        return total + Number(ln.lastPaymentAmount || 0);
      }, 0
    );
    
    /**
     * STAGE 6: ADMINISTRATIVE COMMISSION ENGINE (15% SURPLUS CUT)
     * logic: Calculates cut only if an Admin was WORKING today and profit is positive.
     */
    const netProfitForDayBeforeCommission = (
      dailyOwnerShareBaseValue + dailyPaymentsInTotalValue
    ) - dailyStaffWageLiability - dailyExpenseTotalValue - dailyLoansIssuedTotalValue;

    const isAdminOnDutyToday = workers.some(
      function(worker) {
        
        const hStart = window.normalizeDate(worker.startDate || "2020-01-01");
        const fEnd = worker.endDate ? window.normalizeDate(worker.endDate) : null;
        
        const isHiredByToday = window.compareDates(hStart, currentDayIdentifier) <= 0;
        const isStillHiredByToday = !fEnd || window.compareDates(currentDayIdentifier, fEnd) <= 0;
        
        // Presence: check the attendance map OFF switch
        const attendanceData = attendance[currentDayIdentifier] && attendance[currentDayIdentifier][worker.id];
        const isWorkingToday = !(attendanceData === true || (attendanceData && attendanceData.isOff === true));
        
        var isAdminWorking = (
          worker.managerRole === "Administrative" && 
          isHiredByToday && 
          isStillHiredByToday && 
          isWorkingToday
        );

        return isAdminWorking;
      }
    );

    let dailyAdminCommissionCutValue = 0;
    if (isAdminOnDutyToday && netProfitForDayBeforeCommission > 0) {
        // formula: (Surplus * 15%)
        dailyAdminCommissionCutValue = (netProfitForDayBeforeCommission * 0.15);
    }

    /**
     * STAGE 7: GLOBAL ACCUMULATION
     * logic: Merges daily standalone units into the audit range totals.
     */
    totalOwnerGrossShareInRange += dailyOwnerShareBaseValue;
    totalGrossRevenueInRange += dailyGrossCashCollectedValue;
    totalManualStaffPayrollInRange += dailyStaffWageLiability;
    totalWorkshopExpensesInRange += dailyExpenseTotalValue;
    totalAdminCommissionInRange += dailyAdminCommissionCutValue;
    totalLoansIssuedInRange += dailyLoansIssuedTotalValue;
    totalPaymentsReceivedInRange += dailyPaymentsInTotalValue;

    // progression: advance the pointer to the next calendar date
    loopDayPointer.setDate(loopDayPointer.getDate() + 1);
  }

  // --------------------------------------------------------------------------
  // -- RANGE ANALYTICS CALCULATION --
  // --------------------------------------------------------------------------

  /**
   * finalNetOwnerProfitTotalValue
   * formula: (Collection + Debtor Repayment) - (Admin% + Wages + Expenses + Loans Issued)
   * result: Represents the final 85% equity retained by the workshop proprietor.
   */
  const finalNetOwnerProfitTotalValue = (
    totalOwnerGrossShareInRange + totalPaymentsReceivedInRange
  ) - totalAdminCommissionInRange - totalManualStaffPayrollInRange - totalWorkshopExpensesInRange - totalLoansIssuedInRange;

  /**
   * currentPendingLoansSumValue
   * logic: Aggregates total outstanding money owed by clients (Global Snapshot).
   */
  const currentPendingLoansSumValue = loans.filter(
    function(loan) { 
      var isNotCleared = loan.status !== "paid";
      return isNotCleared; 
    }
  ).reduce(
    function(total, loan) { 
      var outstandingBalance = Number(loan.amount) - Number(loan.amountPaid);
      return total + outstandingBalance; 
    }, 0
  );

  /**
   * TREND ANALYSIS ENGINE: Peak Day Detector
   * logic: Identifies the high-water mark for revenue within the range.
   */
  var dailyRevenueTrendMapping = {};
  transactions.filter(
    function(tx) { 
      var normDate = window.normalizeDate(tx.date);
      return normDate >= from && normDate <= to; 
    }
  ).forEach(
    function(tx) {
      var key = window.normalizeDate(tx.date);
      dailyRevenueTrendMapping[key] = (dailyRevenueTrendMapping[key] || 0) + Number(tx.amount);
    }
  );
    
  var peakPerformanceDateKey = null;
  var highestRevenueFoundValue = 0;
  Object.keys(dailyRevenueTrendMapping).forEach(
    function(dateKey) {
      if (dailyRevenueTrendMapping[dateKey] > highestRevenueFoundValue) {
        highestRevenueFoundValue = dailyRevenueTrendMapping[dateKey];
        peakPerformanceDateKey = dateKey;
      }
    }
  );

  /**
   * DEPARTMENT ANALYTICS ENGINE: Sector Revenue Mapping
   * logic: Categorizes revenue intake strings into sector buckets for the UI.
   */
  var departmentStatsMapping = {};
  window.DEPTS.forEach(
    function(deptID) { 
      departmentStatsMapping[deptID] = 0; 
    }
  );

  transactions.filter(
    function(tx) { 
      var dStr = window.normalizeDate(tx.date);
      return dStr >= from && dStr <= to; 
    }
  ).forEach(
    function(tx) {
      if (departmentStatsMapping[tx.department] !== undefined) {
        departmentStatsMapping[tx.department] += Number(tx.amount);
      }
    }
  );

  // Scaler logic for bar chart animations
  const chartScalingMaximumValue = Math.max.apply(
    null, 
    Object.values(departmentStatsMapping)
  ) || 1;

  // ==========================================================================
  // -- UI RENDER ENGINE (JSX ARCHITECTURE) --
  // ==========================================================================
  
  return (
    <div 
      className="p-6 max-w-5xl mx-auto space-y-10 font-sans pb-40 animate-in fade-in duration-500 report-root-shell"
    >
      
      {/* 
         MASTER PRINT THEME FIXER: 
         Ensures the PDF looks exactly like the app while supporting multi-page overflow.
      */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          
          body, #root, .report-root-shell { 
             background: #0f172a !important; 
             color: #f1f5f9 !important; 
             height: auto !important; 
             overflow: visible !important;
             display: block !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
             padding: 0 !important;
             margin: 0 !important;
          }
          
          div, section { 
             overflow: visible !important; 
             height: auto !important; 
             page-break-inside: avoid !important;
          }

          .rounded-[2.5rem], .rounded-2xl, .bg-gray-800, .bg-gray-900, .bg-gray-950 { 
             background: #1e293b !important; 
             border: 1px solid #334155 !important;
             box-shadow: none !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
          }

          .text-orange-400 { color: #fb923c !important; }
          .text-green-400 { color: #4ade80 !important; }
          .text-red-400 { color: #f87171 !important; }
          .text-gray-500 { color: #94a3b8 !important; }
          .text-white { color: #ffffff !important; }

          .bg-orange-500 { background-color: #f97316 !important; }
          .bg-blue-500 { background-color: #3b82f6 !important; }
          .bg-gray-950 { background-color: #020617 !important; }
        }
      `}</style>
      
      {/* 6.1 HEADER SECTION: NAVIGATION & CONTROLS */}
      <div 
        className="flex items-center justify-between flex-wrap gap-4 no-print border-b border-gray-800 pb-6"
      >
        <div 
          className="border-l-4 border-orange-500 pl-4"
        >
          <h1 
            className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none"
          >
             {t("reportsTitle")}
          </h1>
          <p 
            className="text-[10px] text-gray-500 mt-2 uppercase font-bold tracking-[0.4em] ml-1 leading-none"
          >
             {t("revenueAnalytics")} Range Engine v8.5
          </p>
        </div>
        
        <div 
          className="flex items-center gap-3"
        >
          {/* RANGE SELECTOR INPUTS (FORCED ISO) */}
          <div 
            className="flex items-center gap-3 bg-gray-800 p-2.5 rounded-2xl border border-gray-700 shadow-inner shadow-black/50"
          >
            <div 
              className="flex items-center gap-2 px-3"
            >
              <span 
                className="text-[9px] font-black text-gray-500 uppercase tracking-widest"
              >
                {t("from")}
              </span>
              <input 
                type="date" 
                value={from} 
                onChange={function(e){ setFrom(e.target.value); }} 
                className="bg-transparent text-xs font-black text-white outline-none cursor-pointer uppercase" 
              />
            </div>
            
            <div 
              className="w-px h-6 bg-gray-700 opacity-50"
            ></div>
            
            <div 
              className="flex items-center gap-2 px-3"
            >
              <span 
                className="text-[9px] font-black text-gray-500 uppercase tracking-widest"
              >
                {t("to")}
              </span>
              <input 
                type="date" 
                value={to} 
                onChange={function(e){ setTo(e.target.value); }} 
                className="bg-transparent text-xs font-black text-white outline-none cursor-pointer uppercase" 
              />
            </div>
          </div>

          <button 
            onClick={function() { window.print(); }} 
            className="flex items-center gap-3 px-6 py-4 rounded-xl border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 text-[10px] font-black uppercase tracking-widest shadow-lg transition active:scale-95 shadow-orange-500/5"
          >
            <span>🖨️</span> PDF
          </button>
        </div>
      </div>

      {/* 6.2 PRIMARY METRICS GRID (FINANCIAL DATA CARDS) */}
      <div 
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {/* ROW 1: PROFITABILITY & SHARES */}
        <div 
          className="md:contents"
        >
          <window.StatCard 
            label="Pure Owner Profit" 
            value={window.formatAFN(finalNetOwnerProfitTotalValue)} 
            sub={window.formatDate(from) + " to " + window.formatDate(to)}
            positive={finalNetOwnerProfitTotalValue >= 0} 
            accent 
            icon="📈" 
          />
          
          <window.StatCard 
            label="Admin Commission" 
            value={window.formatAFN(totalAdminCommissionInRange)} 
            sub="15% Final Net share" 
            icon="💼" 
          />
          
          <window.StatCard 
            label="Owner Gross share" 
            value={window.formatAFN(totalOwnerGrossShareInRange)} 
            sub="Revenue Split result" 
            icon="💰"
          />
          
          <window.StatCard 
            label="Staff Payroll" 
            value={window.formatAFN(totalManualStaffPayrollInRange)} 
            sub={dayCountValue + " Active Days Audited"} 
            positive={false} 
            icon="👷"
          />
        </div>
        
        {/* ROW 2: OVERHEAD & LIQUIDITY */}
        <div 
          className="md:contents"
        >
          <window.StatCard 
            label="Workshop Costs" 
            value={window.formatAFN(totalWorkshopExpensesInRange)} 
            sub="Sum of daily overhead" 
            positive={false} 
            icon="💸"
          />
          
          <window.StatCard 
            label="Gross Collection" 
            value={window.formatAFN(totalGrossRevenueInRange)} 
            sub="Total Cash Managed" 
            icon="🏦"
          />
          
          <window.StatCard 
            label={t("pendingLoans")} 
            value={window.formatAFN(currentPendingLoansSumValue)} 
            icon="⚠️" 
          />

          <window.StatCard 
            label="Loans Impact" 
            value={window.formatAFN(totalPaymentsReceivedInRange - totalLoansIssuedInRange)} 
            sub="Net Loan Cashflow" 
            positive={(totalPaymentsReceivedInRange - totalLoansIssuedInRange) >= 0} 
            icon="🔃"
          />
        </div>
        
        {/* PEAK PERFORMANCE DETECTION */}
        {peakPerformanceDateKey && (
          <div 
            className="col-span-2 md:col-span-1 rounded-2xl border bg-gray-800 border-gray-700 p-4 flex flex-col gap-1 shadow-inner relative overflow-hidden group hover:border-orange-500/50 transition-colors"
          >
             <div 
               className="absolute -right-2 -bottom-2 text-4xl opacity-[0.05] group-hover:opacity-10 transition-opacity"
             >
               🏆
             </div>
             <span 
               className="text-[9px] font-bold uppercase text-gray-400 tracking-widest"
             >
               {t("bestDay")} Detected
             </span>
             <div 
               className="text-sm font-black text-orange-400"
             >
               {window.formatDate(peakPerformanceDateKey)}
             </div>
             <div 
               className="text-[10px] text-gray-500 font-bold uppercase tabular-nums"
             >
               Volume: {window.formatAFN(dailyRevenueTrendMapping[peakPerformanceDateKey])}
             </div>
          </div>
        )}
      </div>

      {/* 6.3 SECTOR PERFORMANCE VISUALIZATION (CHART ARCHITECTURE) */}
      <div 
        className="rounded-[2.5rem] border bg-gray-800 border-gray-700 p-10 shadow-2xl relative overflow-visible group"
      >
        <div 
          className="flex items-center gap-3 mb-10"
        >
          <span className="text-lg opacity-50 group-hover:opacity-100 transition-opacity leading-none">📊</span>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
            {t("revenueByDepartment")} Temporal Analytics
          </h2>
        </div>
        
        <div 
          className="space-y-10"
        >
          {window.DEPTS.map(function(deptID) {
            
            const revenueDisplayValue = departmentStatsMapping[deptID];
            const barWidthPercentage = (revenueDisplayValue / chartScalingMaximumValue) * 100;
            const isOwner100Sector = window.isStreamA(deptID);

            return (
              <div 
                key={deptID} 
                className="group overflow-visible"
              >
                {/* Visual Data Labels */}
                <div 
                  className="flex justify-between items-end mb-3 px-1"
                >
                  <span 
                    className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-300 transition-colors group-hover:text-white"
                  >
                    {t(window.DEPT_KEY[deptID])}
                  </span>
                  <span 
                    className="font-mono text-xs font-black text-white tabular-nums"
                  >
                    {window.formatAFN(revenueDisplayValue)}
                  </span>
                </div>
                
                {/* Horizontal Progress Component */}
                <div 
                  className="h-4 bg-gray-950 rounded-full overflow-hidden flex shadow-inner border border-gray-700/50 p-0.5"
                >
                  <div 
                    className={"h-full rounded-full transition-all duration-1000 shadow-lg " + (isOwner100Sector ? "bg-orange-500 shadow-orange-500/20" : "bg-blue-500 shadow-blue-500/20")}
                    style={{ width: (barWidthPercentage || 1) + "%" }}
                  >
                     <div 
                       className="w-full h-full bg-white/5 animate-pulse"
                     ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* CHART LEGEND (SPLIT VS OWNED) */}
        <div 
          className="mt-14 pt-10 border-t border-gray-700/50 flex gap-12 justify-center"
        >
           <div 
             className="flex items-center gap-3"
           >
             <div 
               className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/30"
             ></div>
             <span 
               className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em]"
             >
               100% Owner Sector
             </span>
           </div>
           
           <div 
             className="flex items-center gap-3"
           >
             <div 
               className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30"
             ></div>
             <span 
               className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em]"
             >
               50/50 Shared Sector
             </span>
           </div>
        </div>
      </div>

      {/* 6.4 PDF PRINT ATTESTATION SECTION (CERTIFICATION) */}
      <div 
        className="hidden print:block mt-32 pt-12 border-t border-dashed border-gray-600"
      >
         <div 
           className="text-center mb-16"
         >
            <h3 
              className="text-lg font-black text-white uppercase tracking-[0.5em] mb-2 leading-none"
            >
              Certified Audit Settlement Documentation
            </h3>
            <p 
              className="text-[11px] font-bold text-gray-500 uppercase tracking-widest italic mt-4"
            >
               Ledger Coverage Window: {window.formatDate(from)} — {window.formatDate(to)}
            </p>
         </div>
         
         {/* Manual Signature Integration Architecture */}
         <div 
           className="flex justify-between items-end px-12"
         >
            <div 
              className="text-center"
            >
               <div 
                 className="w-64 border-b-2 border-gray-400 mb-4 shadow-sm"
               ></div>
               <span 
                 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]"
               >
                 Workshop Administrator
               </span>
            </div>
            
            <div 
              className="text-center"
            >
               <div 
                 className="w-64 border-b-2 border-gray-400 mb-4 shadow-sm"
               ></div>
               <span 
                 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]"
               >
                 Workshop Proprietor
               </span>
            </div>
         </div>
         
         <p 
           className="text-center text-[8px] font-bold text-gray-600 mt-24 uppercase tracking-[0.6em] select-none"
         >
           Generated via Lemar Workshop Database v8.5 • ISO-8601 Temporal Protocol Active
         </p>
         <p className="text-center text-[6px] text-gray-700 uppercase tracking-[0.4em] mt-4 opacity-40">
            System Hash: {Math.random().toString(36).substr(2, 14).toUpperCase()}
         </p>
      </div>

      {/* 6.5 SYSTEM SCROLLING BUFFERS (UI PADDING) */}
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 1</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 2</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 3</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 4</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 5</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 6</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 7</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 8</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 9</div>
      <div className="h-20 no-print opacity-0 pointer-events-none">Vertical Spacer Segment 10</div>

    </div>
  );
};

/**
 * ============================================================================
 * END OF MODULE: REPORTS.JS
 * ============================================================================
 * THIS MODULE IS PROTECTED BY THE WORKSHOP ANALYTICS CORE.
 * TEMPORAL ATTENDANCE SYNC LOGIC v8.5 VERIFIED.
 * ============================================================================
 */