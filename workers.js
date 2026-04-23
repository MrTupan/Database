/* --- COMPONENT: WORKERS & PAYROLL ROSTER --- */
// ============================================================================
// WORKSHOP PERSONNEL MANAGEMENT SYSTEM v7.2 - ATTENDANCE & FORMAT INTEGRITY
// ============================================================================
//
// MAJOR LOGIC REVISION v7.2:
// 1. DATE FORMAT SYNC: Solved the "Empty List Transfer" issue. Every date 
//    interaction (Hire Date, View Date, Attendance Key) is now forced into 
//    standard ISO-8601 (YYYY-MM-DD).
//
// 2. STANDALONE DAILY ENGINE: Status changes (OFF/ON) are recorded under 
//    unique date-keys in Firebase. Marking staff "OFF" on April 23rd 
//    creates a fresh slate for April 24th automatically.
//
// 3. TEMPORAL COMPARISON: Replaced alpha-string checks with window.compareDates.
//    This ensures that a worker enrolled on 2026-04-21 correctly appears on 
//    2026-04-24 without being "robbed" from the list.
//
// 4. RESTORED DEPT/ROLE DROPDOWNS: Professional sector and Management sector 
//    now have their specialty dropdowns restored in the recruitment form.
//
// ----------------------------------------------------------------------------
// SYSTEM ARCHITECTURE:
// - Career Node: workers/{id} -> { startDate, name, wage }
// - Daily Node: attendance/{date}/{id} -> true (means worker is OFF)
// ============================================================================

window.Workers = function({ role }) {
  
  // --- EXTERNAL DATA HOOKS ---
  // Access multi-language translations from the global context
  const { t } = window.useLang();
  
  // Access master cloud state, attendance map, and toggle functions
  const { 
    workers, 
    addWorker, 
    delWorker, 
    updWorker,
    attendance,      // Standalone Daily Attendance Map
    toggleAttendance, // Function to mark OFF/ON per date
    transactions,
    expenses 
  } = window.useApp();
  
  // --- UI STATE MANAGEMENT ---
  // The specific calendar date the user is currently auditing or editing
  const [selectedDate, setSelectedDate] = React.useState(window.todayDate());
  // Normalization: Ensure the state always uses YYYY-MM-DD
  const normalizedSelectedDate = window.normalizeDate(selectedDate);

  // Toggle for the "Add New Personnel" recruitment form
  const [showForm, setShowForm] = React.useState(false);
  // Authorization level: Editor (Modifier) vs Monitor (Read-only)
  const isEditor = role === "editor";

  // --- FORM DATA STATE (New Staff Enrollment) ---
  const [nm, setNm] = React.useState(""); // Name string
  const [wg, setWg] = React.useState(""); // Wage numeric
  const [sec, setSec] = React.useState("car_wash"); // Sector ID
  
  // Secondary selection states for specific work-sector properties
  const [sh, setSh] = React.useState("day"); // Shift (Day/Night)
  const [pDept, setPDept] = React.useState("Mechanic"); // Professional Dept
  const [mRole, setMRole] = React.useState("Financial"); // Management Role

  /* --- DATA DICTIONARIES (Constants for Dropdowns) --- */
  
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

  // --------------------------------------------------------------------------
  // -- ADVANCED PAYROLL & STANDALONE ATTENDANCE CALCULATIONS --
  // --------------------------------------------------------------------------

  /**
   * staffRecordsForDate
   * logic: Filter workers who were hired before or on the viewed date.
   * forced fix: Uses window.compareDates to solve the 'Empty Tomorrow' bug.
   */
  const staffRecordsForDate = workers.filter(function(worker) {
    // Ensure both dates are normalized before comparison
    const hireDate = window.normalizeDate(worker.startDate || "2020-01-01");
    const departureDate = worker.endDate ? window.normalizeDate(worker.endDate) : null;
    
    // logic: show worker if (Hire Date <= Today) AND (Today <= Departure Date)
    const isHiredYet = window.compareDates(hireDate, normalizedSelectedDate) <= 0;
    const hasNotLeftYet = !departureDate || window.compareDates(normalizedSelectedDate, departureDate) <= 0;
    
    return isHiredYet && hasNotLeftYet;
  });

  /**
   * totalActiveManualWagesOnDate
   * logic: Aggregates total payroll for the Standalone date.
   * check: Excludes workers marked OFF in the standalone attendance map.
   */
  const totalActiveManualWagesOnDate = staffRecordsForDate
    .filter(function(worker) { 
       // Daily check: Is this worker marked ABSENT in the cloud map for this date?
       const isMarkedOffToday = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
       const isStandardStaff = worker.managerRole !== 'Administrative';
       
       return !isMarkedOffToday && isStandardStaff;
    })
    .reduce(function(acc, worker) { 
      return acc + Number(worker.dailyWage); 
    }, 0);

  /**
   * totalExpensesOnDate
   * logic: Aggregate overhead costs specifically for the Audit range.
   */
  const totalExpensesOnDate = expenses
    .filter(function(e) { return window.normalizeDate(e.date) === normalizedSelectedDate; })
    .reduce(function(acc, e) { return acc + Number(e.amount); }, 0);

  /**
   * totalOwnerGrossOnDate
   * logic: Sum of the proprietor's portion of service revenue on this day.
   */
  const selectedDateTx = transactions.filter(function(tx) { 
    return window.normalizeDate(tx.date) === normalizedSelectedDate; 
  });
  const totalOwnerGrossOnDate = selectedDateTx.reduce(function(acc, tx) { 
    return acc + Number(tx.ownerShare); 
  }, 0);

  /**
   * adminCommissionToday
   * logic: Standard 15% net-profit calculation for Administrative Managers.
   * attendance logic: Commission is only generated if Admin is not marked OFF.
   */
  const isAdminWorkingToday = staffRecordsForDate.some(function(worker) {
    const isOffInMap = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
    return worker.managerRole === "Administrative" && !isOffInMap;
  });

  const ownerNetProfitBeforeCommission = totalOwnerGrossOnDate - totalActiveManualWagesOnDate - totalExpensesOnDate;

  const adminCommissionToday = (isAdminWorkingToday && ownerNetProfitBeforeCommission > 0) 
    ? (ownerNetProfitBeforeCommission * 0.15) 
    : 0;

  // --------------------------------------------------------------------------
  // -- HIGH-SECURITY ACTION HANDLERS --
  // --------------------------------------------------------------------------

  /**
   * verifyEditorAccess
   * security: Requires 'modifier321' credentials for Cloud Deletion.
   */
  function verifyEditorAccess(actionMessage) {
    const userConfirm = confirm(actionMessage);
    if (!userConfirm) {
      return false;
    }

    const inputPassword = prompt("SECURITY CHECK: Enter Editor Password to confirm action:");
    if (inputPassword === "modifier321") {
      return true;
    } else {
      alert("UNAUTHORIZED: Incorrect credentials. Cloud write aborted.");
      return false;
    }
  }

  /**
   * handleDailyAttendanceToggle
   * action: Marks a worker OFF/PRESENT for the selected date ONLY.
   * standalone fix: This does not affect employment status on other dates.
   */
  function handleDailyAttendanceToggle(worker) {
    // Current status in the daily map
    const isCurrentlyOff = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
    const targetStatus = isCurrentlyOff ? "PRESENT (WORKING)" : "ABSENT (OFF)";
    
    const msg = "DAILY ROSTER UPDATE: Set " + worker.name + " to " + targetStatus + " for " + window.formatDate(normalizedSelectedDate) + "?";
    
    if (confirm(msg)) {
      // Version 7.0 engine: passes date and workerID to contexts.js
      toggleAttendance(normalizedSelectedDate, worker.id, !isCurrentlyOff);
    }
  }

  /**
   * handleDeleteWorker
   * logic: Permanently erases the career node from Firebase.
   */
  function handleDeleteWorker(worker) {
    const deleteMsg = "PERMANENT DELETION: Are you sure you want to remove " + worker.name + "? This erases their entire historical payroll trail.";
    
    if (verifyEditorAccess(deleteMsg)) {
      delWorker(worker.id);
    }
  }

  // --------------------------------------------------------------------------
  // -- RECRUITMENT LOGIC --
  // --------------------------------------------------------------------------

  /**
   * handleHireStaff
   * action: Packages worker data and sends to Firebase context.
   * normalizer: Forces the Hire Date to ISO-8601 for comparison safety.
   */
  function handleHireStaff(e) {
    e.preventDefault();
    if (!nm) return;

    const isCommissionBased = (sec === "manager" && mRole === "Administrative");
    
    const workerPayload = {
      name: nm,
      sector: sec,
      shift: sec === "car_wash" ? sh : "none",
      professionalDept: sec === "professional" ? pDept : "none",
      managerRole: sec === "manager" ? mRole : "none",
      dailyWage: isCommissionBased ? 0 : parseFloat(wg || 0),
      payCycle: sec === "professional" ? "weekly" : "daily",
      // Forced normalization for database consistency
      startDate: window.normalizeDate(normalizedSelectedDate), 
      endDate: null,           
      isActive: true           
    };

    // Trigger Firebase Push
    addWorker(workerPayload);
    
    // Cleanup enrollment UI
    setNm(""); 
    setWg(""); 
    setShowForm(false);
  }

  // --------------------------------------------------------------------------
  // -- UI RENDER HELPERS --
  // --------------------------------------------------------------------------

  /**
   * renderStaffGroup
   * logic: High-density sector-based list rendering.
   * status: Displays standalone daily working status.
   */
  function renderStaffGroup(fullList, sectorID, title, colorClass) {
    
    const filteredSectorList = fullList.filter(function(w) {
       if (sectorID === "car_wash") return w.sector === "car_wash" || !w.sector;
       return w.sector === sectorID;
    });

    return (
      <div className="rounded-2xl border bg-gray-800 border-gray-700 overflow-hidden shadow-2xl mb-8">
        
        {/* Sector Ledger Header */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className={"text-[11px] font-black uppercase tracking-[0.2em] " + colorClass}>
            {title}
          </h2>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/20 px-2 py-1 rounded-lg">
            {filteredSectorList.filter(w => !(attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][w.id])).length} ON DUTY
          </span>
        </div>

        {/* Personnel Ledger Rows */}
        <div className="divide-y divide-gray-700/40">
          {filteredSectorList.length === 0 ? (
            <div className="p-16 text-center text-gray-400 text-xs italic opacity-30 uppercase tracking-[0.3em]">
               No Active Hires for this date range
            </div>
          ) : (
            filteredSectorList.map(function(worker) {
              
              // Daily status lookup in the Attendance Map
              const isAbsentToday = attendance[normalizedSelectedDate] && attendance[normalizedSelectedDate][worker.id];
              const isAdm = worker.managerRole === "Administrative";
              const isPro = worker.sector === "professional";
              
              return (
                <div 
                  key={worker.id} 
                  className={"flex items-center px-6 py-4 gap-5 transition-all duration-300 " + (isAbsentToday ? "bg-red-500/[0.02] opacity-50 grayscale" : "hover:bg-gray-700/40")}
                >
                  {/* Personal Identity Column */}
                  <div className="flex-1 min-w-0">
                    <div className={"font-black text-[14px] uppercase tracking-tight " + (!isAbsentToday ? "text-white" : "text-gray-600 italic line-through")}>
                      {worker.name}
                    </div>
                    <div className="text-[9px] text-gray-500 flex items-center gap-2 mt-1.5 uppercase font-bold tracking-widest">
                      {worker.sector === 'car_wash' && <span className="bg-gray-950 px-2 py-0.5 rounded border border-gray-700">{worker.shift} shift</span>}
                      {isPro && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{worker.professionalDept}</span>}
                      {worker.sector === 'manager' && <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">{worker.managerRole}</span>}
                      <span className="opacity-10 text-xl leading-none">|</span>
                      <span>Start: {window.formatDate(worker.startDate)}</span>
                    </div>
                  </div>
                  
                  {/* Financial Column */}
                  <div className="text-right">
                    <div className={"font-black tabular-nums text-xs tracking-tighter " + (!isAbsentToday ? "text-orange-400" : "text-gray-800")}>
                      {isAdm ? "COMMISSION" : window.formatAFN(worker.dailyWage)}
                    </div>
                    <div className="text-[8px] text-gray-600 uppercase font-black tracking-widest mt-1 opacity-70">
                       Cycle: {worker.payCycle || 'daily'}
                    </div>
                  </div>

                  {/* STANDALONE ACTION BUTTON: Changes status for SELECTED DATE only */}
                  {isEditor && (
                    <div className="flex gap-3 ml-2">
                      <button 
                        onClick={function() { handleDailyAttendanceToggle(worker); }}
                        className={"px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg border-2 " + (!isAbsentToday ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20")}
                        title="Mark Present/Absent"
                      >
                        {!isAbsentToday ? "WORKING" : "OFF WORK"}
                      </button>
                      
                      <button 
                        onClick={function() { handleDeleteWorker(worker); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-950/50 text-gray-700 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-75 border border-gray-700 hover:border-red-500/30"
                        title="Fire Staff"
                      >
                        🗑️
                      </button>
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

  // --------------------------------------------------------------------------
  // -- MAIN UI RENDER LOOP (JSX Architecture) --
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 font-sans pb-32 animate-in fade-in duration-500">
      
      {/* 6.1 HEADER & DATE CONTROLS */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-2 no-print border-b border-gray-800 pb-6">
        <div className="border-l-4 border-orange-500 pl-4">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">
            Roster & Attendance
          </h1>
          <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.4em] mt-2">
             Workshop Temporal personnel Ledger
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Historical/Future Date Picker */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl">
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

      {/* 6.2 RECRUITMENT ENROLLMENT INTERFACE */}
      {isEditor && showForm && (
        <div className="rounded-[2.5rem] border-2 border-orange-500/30 bg-gray-800 p-10 shadow-2xl animate-in slide-in-from-top duration-500 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 p-10 opacity-5 text-[12rem] pointer-events-none select-none group-hover:rotate-12 transition-transform duration-1000">👷</div>
          
          <h2 className="text-[12px] font-black uppercase text-orange-400 mb-10 tracking-[0.3em] flex items-center gap-4 border-b border-gray-700 pb-5">
            <span>✍️</span> Authorizing Personnel Entry for {window.formatDate(normalizedSelectedDate)}
          </h2>
          
          <form onSubmit={handleHireStaff} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2 tracking-widest">Full Legal Identity (Name)</label>
              <input 
                type="text" 
                required 
                placeholder="Enter Staff Name..." 
                value={nm} 
                onChange={function(e) { setNm(e.target.value); }} 
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-md font-black focus:ring-4 focus:ring-orange-500/20 outline-none transition-all shadow-inner" 
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2 tracking-widest">Workshop Sector Allocation</label>
              <select 
                value={sec} 
                onChange={function(e) { setSec(e.target.value); }} 
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none appearance-none cursor-pointer shadow-inner"
              >
                {SECTORS.map(function(s) { return <option key={s.id} value={s.id}>{s.label}</option>; })}
              </select>
            </div>

            {/* RESTORED: SECTOR-SPECIFIC SUB-MENUS */}
            {sec === "professional" && (
              <div className="animate-in zoom-in duration-300">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2 tracking-widest">Department Assignment</label>
                <select 
                  value={pDept} 
                  onChange={function(e) { setPDept(e.target.value); }} 
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none appearance-none cursor-pointer shadow-inner"
                >
                  {PRO_DEPTS.map(function(d) { return <option key={d.id} value={d.id}>{d.label}</option>; })}
                </select>
              </div>
            )}

            {sec === "manager" && (
              <div className="animate-in zoom-in duration-300">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2 tracking-widest">Specific Management Function</label>
                <select 
                  value={mRole} 
                  onChange={function(e) { setMRole(e.target.value); }} 
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-sm font-black focus:ring-4 focus:ring-orange-500/20 outline-none appearance-none cursor-pointer shadow-inner"
                >
                  {MANAGER_ROLES.map(function(r) { return <option key={r.id} value={r.id}>{r.label}</option>; })}
                </select>
              </div>
            )}

            {/* RESTORED: WAGE LOGIC WITH COMMISSION CHECK */}
            {!(sec === "manager" && mRole === "Administrative") ? (
              <div className="animate-in zoom-in">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-2 tracking-widest">
                   {sec === 'professional' ? 'Standard Weekly Rate (AFN)' : 'Standard Daily Rate (AFN)'}
                </label>
                <input 
                  type="number" 
                  required 
                  placeholder="0.00" 
                  value={wg} 
                  onChange={function(e) { setWg(e.target.value); }} 
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-6 text-white text-md font-black focus:ring-4 focus:ring-orange-500/20 outline-none shadow-inner" 
                />
              </div>
            ) : (
              <div className="p-6 bg-orange-500/10 rounded-[2rem] border border-orange-500/20 flex items-center animate-in zoom-in shadow-inner">
                 <div className="flex flex-col">
                    <div className="text-[11px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Administrative Profit-Share</div>
                    <div className="text-[9px] text-orange-500/60 font-bold uppercase tracking-tighter">Automatic 15% Net Surplus logic active</div>
                 </div>
              </div>
            )}

            {/* RESTORED: CAR WASH SHIFTS */}
            {sec === "car_wash" && (
              <div className="md:col-span-2 animate-in zoom-in duration-400 pt-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-4 ml-2 tracking-widest">Primary Shift Assignment</label>
                <div className="flex gap-4">
                  {SHIFTS.map(function(s) {
                    const active = sh === s.id;
                    return (
                      <button 
                        key={s.id} 
                        type="button" 
                        onClick={function() { setSh(s.id); }} 
                        className={"flex-1 py-5 rounded-[1.5rem] text-[10px] font-black border-2 transition-all " + (active ? "bg-orange-500 border-orange-500 text-gray-900 shadow-2xl scale-[1.05]" : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500")}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="md:col-span-2 bg-orange-500 text-gray-900 font-black py-6 rounded-3xl uppercase tracking-[0.4em] text-[12px] mt-6 shadow-2xl active:scale-95 transition-all shadow-orange-500/20 hover:bg-orange-400 italic"
            >
              Commit Enrollment to Cloud
            </button>
          </form>
        </div>
      )}

      {/* --- SECTOR LEDGER TABLES (V7.2) --- */}

      {renderStaffGroup(
        staffRecordsForDate, 
        "car_wash", 
        "1. CAR WASH SECTOR (DAILY OPERATIONS)", 
        "text-orange-500"
      )}

      {renderStaffGroup(
        staffRecordsForDate, 
        "professional", 
        "2. PROFESSIONAL TECHNICIANS (WEEKLY CYCLE)", 
        "text-blue-400"
      )}

      {renderStaffGroup(
        staffRecordsForDate, 
        "manager", 
        "3. ADMINISTRATIVE & FINANCIAL MANAGEMENT", 
        "text-green-400"
      )}

      {/* 6.3 DECORATIVE SYSTEM ARCHITECTURE FOOTER */}
      <div className="text-center pt-40 pb-20 select-none opacity-20 no-print">
         <div className="flex items-center justify-center gap-6 mb-6">
            <div className="w-16 h-px bg-gray-700 shadow-lg"></div>
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_orange] animate-pulse"></div>
            <div className="w-16 h-px bg-gray-700 shadow-lg"></div>
         </div>
         <p className="text-[10px] font-black text-gray-700 uppercase tracking-[2em] italic leading-none">
            Temporal Ledger Architecture End
         </p>
         <p className="text-[7px] font-bold text-gray-800 uppercase tracking-[0.5em] mt-6">
            Lemar Workshop Database v7.2 • Personnel Attendance Layer
         </p>
      </div>

    </div>
  );
};

// ============================================================================
// END OF MODULE: WORKERS.JS
// ============================================================================