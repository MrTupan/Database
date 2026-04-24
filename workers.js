/**
 * ============================================================================
 * COMPONENT: WORKERS & PAYROLL ROSTER - MASTER TEMPORAL ENGINE v8.8
 * ============================================================================
 * AUTHOR: NABIZADA (System Architect)
 * REVISION: FRIDAY OVERRIDE + CRITICAL UNDEFINED FIX
 * ============================================================================
 * 
 * DESCRIPTION:
 * This module manages the workshop personnel registry and standalone daily presence.
 * It combines "Career Timeline" (Hiring/Departing) with "Daily Attendance".
 * 
 * CORE LOGIC REVISIONS:
 * 1. STANDALONE DAILY ATTENDANCE: 
 *    Status changes (OFF/ON) and special wages are recorded per specific date. 
 *    Marking someone OFF on Friday does not affect their status on Saturday.
 * 
 * 2. FRIDAY WAGE OVERRIDE:
 *    Specifically for "Both Shift" workers. On Fridays (Day-shift only),
 *    the UI provides a manual input to set the single-shift wage.
 * 
 * 3. SAFE DEPARTURE LOGIC:
 *    The 🗑️ button now sets an 'endDate'. This preserves historical payroll
 *    while removing the worker from future rosters.
 * 
 * 4. FIREBASE DATA INTEGRITY FIX:
 *    Resolved the "set failed: value argument contains undefined" error
 *    by forcing explicit boolean casting on the attendance payload.
 * 
 * 5. AIDE OPTIMIZATION:
 *    Uses expanded vertical formatting to ensure maximum compatibility and
 *    easier code navigation on small mobile screens.
 * ============================================================================
 */

window.Workers = function({ role }) {
  
  // --------------------------------------------------------------------------
  // -- GLOBAL DATA HOOKS --
  // --------------------------------------------------------------------------
  
  /**
   * window.useLang
   * logic: Retrieves the current language context (English, Dari, or Pashto).
   */
  const { 
    t 
  } = window.useLang();
  
  /**
   * window.useApp
   * logic: Retrieves the core application state and cloud write methods.
   */
  const { 
    workers, 
    addWorker, 
    delWorker, 
    updWorker,
    attendance,       
    toggleAttendance, 
    transactions,
    expenses 
  } = window.useApp();
  
  // --------------------------------------------------------------------------
  // -- COMPONENT UI STATE MANAGEMENT --
  // --------------------------------------------------------------------------
  
  /**
   * selectedDate
   * logic: The temporal context for the roster viewing and attendance marking.
   */
  const [selectedDate, setSelectedDate] = React.useState(window.todayDate());
  
  // Normalize the date to ensure ISO-8601 (YYYY-MM-DD) consistency
  const normalizedSelectedDate = window.normalizeDate(selectedDate);
  
  /**
   * isFridayToday
   * logic: Uses the utility helper to check if viewed day is a Friday.
   */
  const isFridayToday = window.isFriday(normalizedSelectedDate);

  // UI Drawer/Modal visibility state
  const [showForm, setShowForm] = React.useState(false);
  
  // Role based access check (Editor/Monitor)
  const isEditor = role === "editor";

  // Enrollment Form Variables
  const [nm, setNm] = React.useState(""); // Worker Name
  const [wg, setWg] = React.useState(""); // Worker standard daily/weekly wage
  const [sec, setSec] = React.useState("car_wash"); // Active sector
  const [sh, setSh] = React.useState("day"); // Car wash shift
  const [pDept, setPDept] = React.useState("Mechanic"); // Tech department
  const [mRole, setMRole] = React.useState("Financial"); // Manager function

  // --------------------------------------------------------------------------
  // -- TEMPORAL COMPARISON UTILITIES --
  // --------------------------------------------------------------------------
  
  /**
   * getNumericDate
   * logic: Strips date strings of delimiters for absolute integer comparison.
   * example: "2026-04-24" becomes 20260424.
   */
  const getNumericDate = function(dateStr) {
    if (!dateStr) return 0;
    
    // Normalize to handle mixed formats from cloud data
    let cleanDate = window.normalizeDate(dateStr);
    
    // Parse to number
    let intVal = parseInt(cleanDate.replace(/-/g, ""), 10);
    
    return isNaN(intVal) ? 0 : intVal;
  };

  const selectedDateValue = getNumericDate(selectedDate);

  /* --- UI DICTIONARIES (DROPDOWN OPTIONS) --- */
  
  const SECTORS = [
    { id: "car_wash", label: "1. Car Wash Sector" },
    { id: "professional", label: "2. Professional Technicians" },
    { id: "manager", label: "3. Management Team" }
  ];

  const SHIFTS = [
    { id: "day", label: "DAY SHIFT" },
    { id: "night", label: "NIGHT SHIFT" },
    { id: "both", label: "BOTH SHIFTS" }
  ];

  const PRO_DEPTS = [
    { id: "Mechanic", label: "Car Mechanic" },
    { id: "Electrician", label: "Car Wiring (Electrician)" },
    { id: "Spare Parts", label: "Spare Parts Seller" },
    { id: "Dent Repairer", label: "Dent Repairer" },
    { id: "Tire Shop", label: "Tire Shop" },
    { id: "Painter", label: "Car Painter" }
  ];

  const MANAGER_ROLES = [
    { id: "Financial", label: "Financial Manager (Daily Pay)" },
    { id: "Administrative", label: "Administrative Manager (15% Commission)" }
  ];

  // ==========================================================================
  // 1. TEMPORAL PAYROLL & FILTERING LOGIC
  // ==========================================================================

  /**
   * staffRecordsForDate
   * logic: Determines which staff members were actually employed on the viewed day.
   * flow: Hired Date <= Current View <= Departed Date.
   */
  const staffRecordsForDate = workers.filter(function(worker) {
    const hireNum = getNumericDate(worker.startDate || "2020-01-01");
    const departureNum = worker.endDate ? getNumericDate(worker.endDate) : 99999999;
    
    const isEmployed = hireNum <= selectedDateValue && selectedDateValue <= departureNum;
    
    return isEmployed;
  });

  /**
   * totalActiveManualWagesOnDate
   * logic: Aggregates wages for the dashboard analytics.
   * rules: Subtracts OFF staff and applies Friday manual wage overrides.
   */
  const totalActiveManualWagesOnDate = staffRecordsForDate
    .filter(function(worker) { 
       // Check attendance record (Supports boolean and object structures)
       const dayMap = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
       const isOff = (dayMap === true) || (dayMap && dayMap.isOff === true);
       const isStandard = worker.managerRole !== 'Administrative';
       
       return !isOff && isStandard;
    })
    .reduce(function(acc, worker) { 
      const dayData = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
      
      /**
       * FRIDAY LOGIC:
       * If worker is on Both Shifts and it's Friday, look for the 'fridayWage' override.
       */
      if (isFridayToday && worker.shift === "both" && dayData && dayData.fridayWage) {
          return acc + Number(dayData.fridayWage);
      }
      
      // Standard: Pro weekly pay is divided by 7
      const dailyImpact = worker.payCycle === "weekly" ? (Number(worker.dailyWage) / 7) : Number(worker.dailyWage);
      return acc + dailyImpact; 
    }, 0);

  /**
   * Financial Summary Calculations (Local State)
   */
  const totalExpensesOnDate = expenses
    .filter(function(e) { return window.normalizeDate(e.date) === normalizedSelectedDate; })
    .reduce(function(acc, e) { return acc + Number(e.amount); }, 0);

  const totalOwnerGrossOnDate = transactions
    .filter(function(tx) { return window.normalizeDate(tx.date) === normalizedSelectedDate; })
    .reduce(function(acc, tx) { return acc + Number(tx.ownerShare); }, 0);

  // ==========================================================================
  // 2. CRITICAL DATA INTEGRITY HANDLERS (THE FIX)
  // ==========================================================================

  /**
   * handleFridayWageChange
   * logic: Updates the attendance node with a custom wage value.
   * FIX: Forces isOff to a boolean to prevent Firebase 'undefined' error.
   */
  function handleFridayWageChange(workerId, wageValue) {
      const dateKey = normalizedSelectedDate;
      const currentDayAttendance = attendance[dateKey] || {};
      const workerCurrentData = currentDayAttendance[workerId];
      
      // logic: determine current boolean OFF status correctly
      let currentIsOffStatus = false;
      if (workerCurrentData === true) {
          currentIsOffStatus = true;
      } else if (workerCurrentData && typeof workerCurrentData === 'object' && workerCurrentData.isOff === true) {
          currentIsOffStatus = true;
      }
      
      // Action: Update attendance object with guaranteed boolean
      toggleAttendance(dateKey, workerId, {
          isOff: currentIsOffStatus, // FORCED BOOLEAN FIX
          fridayWage: parseFloat(wageValue || 0)
      });
  }

  /**
   * handleDailyAttendanceToggle
   * logic: Toggles the presence status for a specific standalone day.
   * FIX: Ensures object merging does not result in undefined keys.
   */
  function handleDailyAttendanceToggle(worker) {
    const dateKey = normalizedSelectedDate;
    const currentData = attendance[dateKey] && attendance[dateKey][worker.id];
    
    // logic: correctly identify current boolean state
    const currentlyOff = (currentData === true) || (currentData && currentData.isOff === true);
    const targetIsOff = !currentlyOff;
    
    const msg = "TEMPORAL UPDATE: Set " + worker.name + " to [" + (targetIsOff ? "OFF" : "WORKING") + "] on " + window.formatDate(dateKey) + "?";
    
    if (confirm(msg)) {
      if (currentData && typeof currentData === 'object') {
          // logic: Preserve Friday wage if toggling OFF status
          toggleAttendance(dateKey, worker.id, { 
              ...currentData, 
              isOff: targetIsOff 
          });
      } else {
          // logic: standard toggle
          toggleAttendance(dateKey, worker.id, targetIsOff);
      }
    }
  }

  /**
   * verifyEditorAccess
   * security: password gate for deletions
   */
  function verifyEditorAccess(msg) {
    const userConf = confirm(msg);
    if (!userConf) return false;
    const pwdInput = prompt("SECURITY CHALLENGE: Enter Editor Password:");
    if (pwdInput === "modifier321") return true;
    alert("UNAUTHORIZED: Permission Denied.");
    return false;
  }

  /**
   * handleSafeDelete (The Departure Logic)
   * logic: Ahmad left on 4/24? Set his end date to 4/23.
   * effect: History is saved; future is cleaned.
   */
  function handleSafeDelete(worker) {
    const msg = "SAFE DEPARTURE: Mark " + worker.name + " as having left the workshop? \n\n" +
                "His historical data for previous days will be preserved, but he will be removed from " + window.formatDate(normalizedSelectedDate) + " onwards.";
    
    if (confirm(msg)) {
        const pass = prompt("Enter Password to authorize Departure:");
        if (pass === "modifier321") {
            // calculation: find the day before the selected date
            var baseDate = new Date(normalizedSelectedDate + "T12:00:00");
            baseDate.setDate(baseDate.getDate() - 1);
            const departureDate = baseDate.toISOString().split('T')[0];
            
            // Firebase action: set endDate
            updWorker(worker.id, { endDate: departureDate });
            alert("Roster Updated: Worker removed from active timeline.");
        } else {
            alert("Incorrect Password.");
        }
    }
  }

  /**
   * handleHireStaff
   * logic: Enrolls a new personnel node with a specific Start Date.
   */
  function handleHireStaff(e) {
    e.preventDefault();
    if (!nm) return;

    const isAdmin = (sec === "manager" && mRole === "Administrative");
    
    const workerPayload = {
      name: nm,
      sector: sec,
      shift: sec === "car_wash" ? sh : "none",
      professionalDept: sec === "professional" ? pDept : "none",
      managerRole: sec === "manager" ? mRole : "none",
      dailyWage: isAdmin ? 0 : parseFloat(wg || 0),
      payCycle: sec === "professional" ? "weekly" : "daily",
      startDate: normalizedSelectedDate, 
      endDate: null,           
      isActive: true           
    };

    addWorker(workerPayload);
    setNm(""); setWg(""); setShowForm(false);
  }

  // ==========================================================================
  // 3. UI RENDER HELPERS (THE LEDGER TABLES)
  // ==========================================================================

  function renderStaffGroup(fullList, sectorID, title, colorClass) {
    
    const filteredList = fullList.filter(function(w) {
       if (sectorID === "car_wash") return w.sector === "car_wash" || !w.sector;
       return w.sector === sectorID;
    });

    return (
      <div 
        className="rounded-2xl border bg-gray-800 border-gray-700 overflow-hidden shadow-2xl mb-8"
      >
        
        {/* Ledger Sector Header */}
        <div 
          className="px-6 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center"
        >
          <h2 
            className={"text-[11px] font-black uppercase tracking-[0.2em] " + colorClass}
          >
            {title}
          </h2>
          <span 
            className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/20 px-2 py-1 rounded-lg"
          >
            {filteredList.filter(w => {
                const entry = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][w.id];
                return !((entry === true) || (entry && entry.isOff === true));
            }).length} STAFF WORKING
          </span>
        </div>

        {/* Ledger Rows */}
        <div 
          className="divide-y divide-gray-700/40"
        >
          {filteredList.length === 0 ? (
            <div 
              className="p-16 text-center text-gray-400 text-xs italic opacity-30 uppercase tracking-[0.3em]"
            >
               No personnel detected for this date unit
            </div>
          ) : (
            filteredList.map(function(worker) {
              
              const dayData = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
              const isMarkedOff = (dayData === true) || (dayData && dayData.isOff === true);
              const friPayValue = (dayData && dayData.fridayWage) || "";
              
              // logic: specific Friday UI for both-shifters
              const requiresFridayInput = isFridayToday && worker.shift === "both" && !isMarkedOff;

              return (
                <div 
                  key={worker.id} 
                  className={"flex flex-col px-6 py-4 transition-all duration-500 " + (isMarkedOff ? "bg-red-500/[0.01] opacity-40 grayscale" : "hover:bg-gray-700/20")}
                >
                  <div 
                    className="flex items-center gap-5"
                  >
                    <div 
                      className="flex-1 min-w-0"
                    >
                        <div 
                          className={"font-black text-[14px] uppercase tracking-tight " + (!isMarkedOff ? "text-white" : "text-gray-600 italic line-through")}
                        >
                        {worker.name}
                        </div>
                        <div 
                          className="text-[9px] text-gray-500 flex items-center gap-2 mt-1.5 uppercase font-bold tracking-widest"
                        >
                        {worker.sector === 'car_wash' && <span className="bg-gray-950 px-2 py-0.5 rounded border border-gray-700">{worker.shift} shift</span>}
                        {worker.sector === 'professional' && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{worker.professionalDept}</span>}
                        {worker.sector === 'manager' && <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">{worker.managerRole}</span>}
                        <span className="opacity-10 text-xl leading-none">|</span>
                        <span>Start: {window.formatDate(worker.startDate)}</span>
                        </div>
                    </div>
                    
                    <div 
                      className="text-right"
                    >
                        <div 
                          className={"font-black tabular-nums text-xs tracking-tighter " + (!isMarkedOff ? "text-orange-400" : "text-gray-800")}
                        >
                        {worker.managerRole === "Administrative" ? "COMMISSION" : window.formatAFN(worker.dailyWage)}
                        </div>
                        <div 
                          className="text-[8px] text-gray-600 uppercase font-black tracking-widest mt-1 opacity-70"
                        >
                        PAY: {worker.payCycle || 'daily'}
                        </div>
                    </div>

                    {isEditor && (
                        <div 
                          className="flex gap-3 ml-2"
                        >
                          <button 
                              onClick={function() { handleDailyAttendanceToggle(worker); }}
                              className={"px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg border-2 " + (!isMarkedOff ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20")}
                          >
                              {!isMarkedOff ? "WORKING" : "OFF WORK"}
                          </button>
                          
                          <button 
                              onClick={function() { handleSafeDelete(worker); }}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-950/50 text-gray-700 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-75 border border-gray-700 hover:border-red-500/30"
                          >
                              🗑️
                          </button>
                        </div>
                    )}
                  </div>

                  {/* FRIDAY OVERRIDE SUB-UI */}
                  {isEditor && requiresFridayInput && (
                      <div 
                        className="mt-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-2xl flex items-center justify-between animate-in zoom-in"
                      >
                          <div 
                            className="flex items-center gap-2"
                          >
                              <span className="text-lg">💰</span>
                              <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Friday Single-Shift Pay Override:</span>
                          </div>
                          <div 
                            className="flex items-center gap-3"
                          >
                              <input 
                                type="number" 
                                placeholder="Enter Amount" 
                                value={friPayValue}
                                onChange={(e) => handleFridayWageChange(worker.id, e.target.value)}
                                className="bg-gray-950 border border-orange-500/30 rounded-xl px-4 py-2 text-sm text-white font-black w-32 outline-none focus:ring-2 focus:ring-orange-500 shadow-inner"
                              />
                              <span className="text-[10px] font-black text-gray-500">AFN</span>
                          </div>
                      </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. MAIN INTERFACE RENDER
  // ==========================================================================

  return (
    <div 
      className="p-6 max-w-5xl mx-auto space-y-6 font-sans pb-32 animate-in fade-in duration-500"
    >
      
      {/* 6.1 APP HEADER & DATE NAV */}
      <div 
        className="flex items-center justify-between flex-wrap gap-4 pt-2 no-print border-b border-gray-800 pb-6"
      >
        <div 
          className="border-l-4 border-orange-500 pl-4"
        >
          <h1 
            className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none"
          >
            Roster & Attendance
          </h1>
          <p 
            className="text-[9px] text-gray-500 font-black uppercase tracking-[0.4em] mt-2 leading-none"
          >
             Temporal Ledger System v8.8
          </p>
        </div>
        
        <div 
          className="flex items-center gap-3"
        >
          <div 
            className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl"
          >
             <span className="text-lg">🗓️</span>
             <input 
               type="date" 
               value={normalizedSelectedDate} 
               onChange={function(e){ setSelectedDate(e.target.value); }} 
               className="bg-transparent text-sm font-black text-white outline-none cursor-pointer uppercase"
             />
          </div>

          {isEditor && (
            <button 
              onClick={function(){ setShowForm(!showForm); }} 
              className="bg-orange-500 text-gray-900 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-orange-400"
            >
              {showForm ? "✕ CANCEL" : "+ ENROLL STAFF"}
            </button>
          )}
        </div>
      </div>

      {/* 6.2 NEW PERSONNEL ENROLLMENT FORM */}
      {isEditor && showForm && (
        <div 
          className="rounded-[2.5rem] border-2 border-orange-500/30 bg-gray-800 p-10 shadow-2xl animate-in slide-in-from-top duration-500 relative overflow-hidden group"
        >
          <div className="absolute -top-10 -right-10 opacity-5 text-[12rem] pointer-events-none group-hover:rotate-12 transition-all duration-1000">👷</div>
          <h2 className="text-[12px] font-black uppercase text-orange-400 mb-10 tracking-[0.3em] flex items-center gap-4 border-b border-gray-700 pb-5">
            <span>✍️</span> Authorizing Entry for {window.formatDate(normalizedSelectedDate)}
          </h2>
          
          <form 
            onSubmit={handleHireStaff} 
            className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10"
          >
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2">Legal Identity (Name)</label>
              <input type="text" required placeholder="Staff Full Name..." value={nm} onChange={(e)=>setNm(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-md font-black focus:ring-4 focus:ring-orange-500/20 outline-none transition-all shadow-inner" />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2">Workshop Sector</label>
              <select value={sec} onChange={(e)=>setSec(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none shadow-inner">
                {SECTORS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {sec === "professional" && (
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2">Department Assignment</label>
                <select value={pDept} onChange={(e)=>setPDept(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none shadow-inner">
                  {PRO_DEPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            )}

            {sec === "manager" && (
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2">Management Function</label>
                <select value={mRole} onChange={(e)=>setMRole(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none shadow-inner">
                  {MANAGER_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            )}

            {!(sec === "manager" && mRole === "Administrative") ? (
              <div className="animate-in zoom-in">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2">Payment Rate (AFN)</label>
                <input type="number" required placeholder="0.00" value={wg} onChange={(e)=>setWg(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-md font-black focus:ring-4 focus:ring-orange-500/20 outline-none shadow-inner" />
              </div>
            ) : (
              <div className="p-6 bg-orange-500/10 rounded-[2rem] border border-orange-500/20 flex items-center animate-in zoom-in shadow-inner">
                 <div className="flex flex-col">
                    <div className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-1">Administrative Profit-Share</div>
                    <div className="text-[9px] text-orange-500/60 font-bold uppercase tracking-tighter">Automatic 15% Net Surplus logic active</div>
                 </div>
              </div>
            )}

            {sec === "car_wash" && (
              <div className="md:col-span-2 animate-in zoom-in duration-400">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-4 ml-2">Shift Rotation</label>
                <div className="flex gap-4">
                  {SHIFTS.map(s => {
                    const active = sh === s.id;
                    return (
                      <button key={s.id} type="button" onClick={() => setSh(s.id)} className={"flex-1 py-5 rounded-[1.5rem] text-[10px] font-black border-2 transition-all " + (active ? "bg-orange-500 border-orange-500 text-gray-900 shadow-2xl scale-[1.05]" : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500")}>{s.label}</button>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="submit" className="md:col-span-2 bg-orange-500 text-gray-900 font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[12px] mt-6 shadow-2xl active:scale-95 transition-all shadow-orange-500/20 hover:bg-orange-400 italic">Commit Enrollment to Cloud</button>
          </form>
        </div>
      )}

      {/* --- SECTOR ATTENDANCE TABLES --- */}

      {renderStaffGroup(staffRecordsForDate, "car_wash", "1. CAR WASH SECTOR (DAILY OPERATIONS)", "text-orange-500")}
      {renderStaffGroup(staffRecordsForDate, "professional", "2. PROFESSIONAL TECHNICIANS (WEEKLY CYCLE)", "text-blue-400")}
      {renderStaffGroup(staffRecordsForDate, "manager", "3. ADMINISTRATIVE & FINANCIAL MANAGEMENT", "text-green-400")}

      {/* 6.3 DECORATIVE SYSTEM ARCHITECTURE FOOTER */}
      <div 
        className="text-center pt-40 pb-20 select-none opacity-20 no-print"
      >
         <div 
           className="flex items-center justify-center gap-6 mb-6"
         >
            <div className="w-16 h-px bg-gray-700 shadow-lg"></div>
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_orange] animate-pulse"></div>
            <div className="w-16 h-px bg-gray-700 shadow-lg"></div>
         </div>
         <p 
           className="text-[10px] font-black text-gray-700 uppercase tracking-[2em] italic leading-none"
         >
            Temporal Ledger Architecture End
         </p>
         <p 
           className="text-[7px] font-bold text-gray-800 uppercase tracking-[0.5em] mt-6"
         >
            Lemar Workshop Database v8.8 • Personnel Attendance Layer
         </p>
      </div>

    </div>
  );
};

// ============================================================================
// END OF MODULE: WORKERS.JS
// ============================================================================