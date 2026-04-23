/* --- COMPONENT: LOANS & CUSTOMER CREDIT --- */
/**
 * ============================================================================
 * WORKSHOP DEBT & CREDIT MANAGEMENT SYSTEM v2.0
 * ============================================================================
 * 
 * This module manages receivables (money customers owe).
 * 
 * FEATURES:
 * 1.  NEW LOANS: Issued loans subtract from daily profit.
 * 2.  PAYMENTS: Received payments add to daily profit.
 * 3.  SECURITY: Deleting a loan requires 'modifier321' password.
 * 4.  COMPACT UI: Designed for small screens to prevent excessive scrolling.
 */

window.Loans = function({ role }) {
  // --- HOOKS & CLOUD DATA ---
  const { t } = window.useLang();
  
  // Destructure logic from global cloud context
  const { 
    loans, 
    addLoan, 
    updLoan 
  } = window.useApp();
  
  // --- UI STATE MANAGEMENT ---
  // Status filter (All, Pending, Partial, Paid)
  const [filter, setFilter] = React.useState("");
  // Visibility for the Add Loan form
  const [showForm, setShowForm] = React.useState(false);
  // Target loan for the payment update modal
  const [payForm, setPayForm] = React.useState(null); 
  
  // --- NEW LOAN FORM STATE ---
  const [cn, setCn] = React.useState(""); // Client Name
  const [amt, setAmt] = React.useState(""); // Total Amount
  const [dp, setDp] = React.useState(""); // Department
  const [ds, setDs] = React.useState(""); // Description
  const [dd, setDd] = React.useState(""); // Due Date
  
  const isEditor = role === "editor";

  /* --- DATA PROCESSING --- */
  
  // Apply filter selection to the cloud list
  const filteredLoans = filter 
    ? loans.filter(function(l) { return l.status === filter; }) 
    : loans;

  // Calculate grand total of outstanding receivables (money in the street)
  const pendingTotal = loans
    .filter(function(l) { return l.status !== "paid"; })
    .reduce(function(acc, l) { 
      return acc + (Number(l.amount) - Number(l.amountPaid || 0)); 
    }, 0);

  /* --- ACTION HANDLERS (CLOUD WRITES) --- */

  /**
   * verifyEditorSecurity
   * Logic: Password gate for high-risk deletions.
   */
  function verifyEditorSecurity(msg) {
    const agree = confirm(msg);
    if (!agree) return false;
    const pass = prompt("SECURITY: Enter Editor Password to delete:");
    if (pass === "modifier321") return true;
    alert("Unauthorized!");
    return false;
  }
  
  /**
   * handleCreate
   * logic: Pushes a new loan to Firebase.
   */
  function handleCreate(e) {
    e.preventDefault();
    if (!cn || !amt) return;
    
    addLoan({
      clientName: cn,
      amount: parseFloat(amt),
      department: dp,
      description: ds,
      dueDate: dd,
      loanDate: window.todayDate() 
    });
    
    setCn(""); setAmt(""); setDp(""); setDs(""); setDd("");
    setShowForm(false);
  }

  /**
   * handlePaymentUpdate
   * logic: Updates payment status and tracks "New Cash" for the dashboard.
   */
  function handlePaymentUpdate(e) {
    e.preventDefault();
    if (!payForm) return;
    
    const currentLoan = loans.find(function(item) { 
      return item.id === payForm.id; 
    });

    if (!currentLoan) return;

    const newTotalPaid = parseFloat(payForm.amountPaid || 0);
    const freshCashReceived = newTotalPaid - (Number(currentLoan.amountPaid) || 0);

    updLoan(payForm.id, {
      amountPaid: newTotalPaid,
      status: payForm.status,
      lastPaymentDate: window.todayDate(),
      lastPaymentAmount: freshCashReceived 
    });

    setPayForm(null);
  }

  /**
   * handleDeleteLoan
   * logic: Permanently removes the record if authorized.
   */
  function handleDeleteLoan(loan) {
    const msg = "Are you sure you want to PERMANENTLY DELETE the loan for " + loan.clientName + "?";
    if (verifyEditorSecurity(msg)) {
      // Use standard Firebase removal if delLoan helper isn't in context
      db.ref("loans").child(loan.id).remove();
    }
  }

  /**
   * StatusBadge
   * Compact UI indicator for loan status
   */
  function StatusBadge({ status }) {
    if (status === "paid") {
      return (
        <span className="text-green-400 text-[10px] font-bold uppercase flex items-center gap-1">
          ✅ {t("paid")}
        </span>
      );
    }
    if (status === "partial") {
      return (
        <span className="text-yellow-400 text-[10px] font-bold uppercase flex items-center gap-1">
          🕐 {t("partial")}
        </span>
      );
    }
    return (
      <span className="text-red-400 text-[10px] font-bold uppercase flex items-center gap-1">
        ⚠️ {t("pending")}
      </span>
    );
  }

  /* --- RENDER LOGIC --- */

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans animate-in fade-in duration-500 pb-20">
      
      {/* HEADER SECTION (Compact) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
            {t("loansCredit")}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{t("trackCustomerCredit")}</p>
        </div>
        
        {isEditor && (
          <button 
            onClick={function() { setShowForm(!showForm); }}
            className="bg-orange-500 text-gray-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition"
          >
            {showForm ? t("cancel") : "+ " + t("addLoan")}
          </button>
        )}
      </div>

      {/* OUTSTANDING SUMMARY CARD */}
      {pendingTotal > 0 && (
        <div className="rounded-xl border bg-red-500/10 border-red-500/30 p-4 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3 text-red-400">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="text-[10px] font-bold uppercase opacity-80">{t("outstandingReceivables")}</div>
              <div className="text-xl font-black tabular-nums">{window.formatAFN(pendingTotal)}</div>
            </div>
          </div>
        </div>
      )}

      {/* NEW LOAN FORM (Compact Design) */}
      {isEditor && showForm && (
        <div className="rounded-xl border bg-gray-800 border-gray-700 p-5 shadow-xl animate-in slide-in-from-top">
          <h2 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">{t("newLoanCredit")}</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1 ml-1">{t("clientName")}</label>
              <input type="text" required placeholder={t("customerName")} value={cn} onChange={function(e){setCn(e.target.value);}}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1 ml-1">{t("amountAFN")}</label>
              <input type="number" required min="0" step="1" placeholder="0" value={amt} onChange={function(e){setAmt(e.target.value);}}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1 ml-1">{t("departmentOptional")}</label>
              <select value={dp} onChange={function(e){setDp(e.target.value);}}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none cursor-pointer">
                <option value="">{t("none")}</option>
                {window.DEPTS.map(function(d){ return <option key={d} value={d}>{t(window.DEPT_KEY[d])}</option>; })}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1 ml-1">{t("dueDateOptional")}</label>
              <input type="date" value={dd} onChange={function(e){setDd(e.target.value);}}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1 ml-1">{t("descriptionOptional")}</label>
              <input type="text" placeholder={t("serviceDetails")} value={ds} onChange={function(e){setDs(e.target.value);}}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
            </div>
            <div className="md:col-span-2 pt-1">
              <button type="submit" className="w-full bg-orange-500 text-gray-900 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg">
                {t("addLoan")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UPDATE PAYMENT MODAL */}
      {payForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h3 className="text-lg font-black text-white uppercase mb-1">{t("updatePayment")}</h3>
            <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mb-4">{payForm.clientName}</p>
            <form onSubmit={handlePaymentUpdate} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1">{t("amountPaidAFN")}</label>
                <input type="number" min="0" value={payForm.amountPaid}
                  onChange={function(e){ var val = e.target.value; setPayForm(function(f){ return Object.assign({}, f, {amountPaid: val}); }); }}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase text-gray-500 mb-1">{t("status")}</label>
                <select value={payForm.status}
                  onChange={function(e){ var val = e.target.value; setPayForm(function(f){ return Object.assign({}, f, {status: val}); }); }}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:ring-1 focus:ring-orange-500">
                  <option value="pending">{t("pending")}</option>
                  <option value="partial">{t("partial")}</option>
                  <option value="paid">{t("paid")}</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-orange-500 text-gray-900 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg transition active:scale-95">{t("save")}</button>
                <button type="button" onClick={function(){setPayForm(null);}} className="flex-1 bg-gray-700 text-white py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition active:scale-95">{t("cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILTER BUTTONS */}
      <div className="flex gap-2 flex-wrap border-b border-gray-800 pb-4">
        {[{v:"",l:t("all")},{v:"pending",l:t("pending")},{v:"partial",l:t("partial")},{v:"paid",l:t("paid")}].map(function(tab) {
          const isAct = filter === tab.v;
          return (
            <button key={tab.v} onClick={function(){ setFilter(tab.v); }}
              className={"px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all " + 
              (isAct ? "bg-orange-500 text-gray-900 border-orange-500 shadow-md" : "border-gray-700 text-gray-500 hover:border-gray-600")}>
              {tab.l}
            </button>
          );
        })}
      </div>

      {/* DATABASE LIST */}
      <div className="rounded-xl border bg-gray-800 border-gray-700 overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{t("loansLabel")}</h2>
          <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Live Registry</span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {filteredLoans.map(function(l) {
            return (
              <div key={l.id} className="flex items-center px-5 py-4 gap-4 hover:bg-gray-700/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-bold text-sm text-gray-200 uppercase tracking-tight">{l.clientName}</span>
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tight flex gap-x-2 flex-wrap">
                    {l.department && <span className="text-orange-500/70">{t(window.DEPT_KEY[l.department])}</span>}
                    {l.dueDate && <span className="text-blue-400/70">· {t("due")}: {window.formatDate(l.dueDate)}</span>}
                    <span className="opacity-40">| Issued: {window.formatDate(l.loanDate || "2024-01-01")}</span>
                  </div>
                </div>
                
                <div className="text-right min-w-[120px]">
                  <div className="font-black text-sm tabular-nums text-white">
                    {window.formatAFN(l.amount)}
                  </div>
                  {Number(l.amountPaid) > 0 && (
                    <div className="text-[9px] text-green-500 font-bold uppercase tabular-nums">
                      Paid: {window.formatAFN(l.amountPaid)}
                    </div>
                  )}
                </div>

                {isEditor && (
                  <div className="flex gap-2 ml-2">
                    <button 
                      onClick={function(){ setPayForm({id: l.id, clientName: l.clientName, amountPaid: String(l.amountPaid), status: l.status}); }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-900 border border-gray-700 text-gray-400 hover:text-orange-500 transition-all active:scale-90"
                      title="Update Payment"
                    >
                      💸
                    </button>
                    <button 
                      onClick={function(){ handleDeleteLoan(l); }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/5 border border-red-500/20 text-gray-500 hover:text-red-500 transition-all active:scale-90"
                      title="Delete Loan"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="h-10"></div>
    </div>
  );
};