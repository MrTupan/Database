// COMPONENT: PARTNER VIEW (ELECTRICIAN)
// ============================================================================
// MASTER PARTNER SETTLEMENT ENGINE v2.5 - ELECTRICIAN DIVISION
// ============================================================================
/**
 * Provides high-precision financial tracking for the Electrician partner.
 * 
 * CORE LOGIC FEATURES:
 * 1. DEDUCTION SYSTEM: Every transaction in the range is checked against 
 *    the payment history. If a transaction date was already covered by 
 *    a previous payment, it is subtracted from the current total.
 * 
 * 2. DOUBLE-PAYMENT PREVENTION: The "Remaining Share" card only shows 
 *    money that has NOT been recorded in the Payout History.
 * 
 * 3. EDIT & DELETE: Payout history records can now be modified or removed.
 *    - Removal requires the 'modifier321' security password.
 *    - Editing allows correction of payment amounts and date ranges.
 * 
 * 4. TRANSACTION AUDIT: The list at the bottom clearly shows which 
 *    services are already "CLEARED" and which ones are "PENDING".
 */

window.PartnerElectrician = function() {
  
  // -- EXTERNAL DATA HOOKS --
  const { t } = window.useLang();
  
  // Accessing master cloud data and settlement functions from App Context
  const { 
    transactions, 
    partnerPayments, 
    addPartnerPayment 
  } = window.useApp();
  
  // -- UI LOCAL STATE --
  // Controls the date range for auditing and settlement
  const [from, setFrom] = React.useState(window.todayDate());
  const [to,   setTo]   = React.useState(window.todayDate());

  // State for the Edit Payment Modal
  const [editPaymentData, setEditPaymentData] = React.useState(null);

  // Fixed department identifier for the Electrician sector
  const deptID = "electrician";

  // ==========================================================================
  // 1. SECURITY & ACTION LOGIC
  // ==========================================================================

  /**
   * verifyEditorAction
   * logic: Requires password authorization for deleting or editing history.
   */
  function verifyEditorAction(actionText) {
    const confirmation = confirm(actionText);
    if (!confirmation) return false;

    const pass = prompt("SECURITY CHECK: Enter Editor Password to authorize:");
    if (pass === "modifier321") {
      return true;
    } else {
      alert("Unauthorized! Incorrect Password.");
      return false;
    }
  }

  /**
   * handleDeletePayment
   * logic: Permanently removes a payout record from the cloud database.
   */
  function handleDeletePayment(payment) {
    const msg = "Are you sure you want to PERMANENTLY DELETE the payment record of " + window.formatAFN(payment.amount) + "?";
    if (verifyEditorAction(msg)) {
      db.ref("partner_payments").child(payment.id).remove();
    }
  }

  /**
   * handleUpdatePayment
   * logic: Saves changes made to a past payment record in the cloud.
   */
  function handleUpdatePayment(e) {
    e.preventDefault();
    if (!editPaymentData) return;

    db.ref("partner_payments").child(editPaymentData.id).update({
      amount: parseFloat(editPaymentData.amount),
      fromDate: editPaymentData.fromDate,
      toDate: editPaymentData.toDate
    });

    setEditPaymentData(null);
    alert("Record updated successfully.");
  }

  // ==========================================================================
  // 2. SMART CALCULATION ENGINE (ANTI-OVERLAP)
  // ==========================================================================

  // Step A: Filter all transactions for this department within the selected range
  const txRange = transactions.filter(function(tx) {
    return tx.date >= from && tx.date <= to && tx.department === deptID;
  });

  // Step B: Filter all previous payout records for the Electrician
  const electricianPaymentHistory = partnerPayments.filter(function(p) {
    return p.dept === deptID;
  });

  // Step C: Process every transaction to see if it was already paid
  let totalRevenueInRange = 0;
  let totalAlreadyPaidInRange = 0;

  const auditedTransactions = txRange.map(function(tx) {
    // Logic: Check if this specific transaction date falls inside any previous payout range
    const wasThisTxPaid = electricianPaymentHistory.some(function(payout) {
      return tx.date >= payout.fromDate && tx.date <= payout.toDate;
    });

    totalRevenueInRange += Number(tx.amount);
    
    if (wasThisTxPaid) {
      // Add the partner's 50% share to the "Already Paid" accumulator
      totalAlreadyPaidInRange += Number(tx.partnerShare);
    }

    return {
      ...tx,
      isCleared: wasThisTxPaid
    };
  });

  // Step D: Final Balance Calculations
  const ownerShareTotal = totalRevenueInRange * 0.5;
  const fullPartnerShareTotal = totalRevenueInRange * 0.5;
  
  // THE FIX: Remaining money owed = (Total 50% share) - (Sum of shares already marked paid)
  const remainingBalanceOwed = fullPartnerShareTotal - totalAlreadyPaidInRange;
  
  // Determine if the entire selected range is fully cleared
  const isRangeFullyPaid = remainingBalanceOwed <= 0 && totalRevenueInRange > 0;

  // ==========================================================================
  // 3. SETTLEMENT HANDLER
  // ==========================================================================

  function handleProcessPayment() {
    if (remainingBalanceOwed <= 0) {
      alert("Notice: There is no outstanding balance for this specific range.");
      return;
    }

    const confirmationMsg = "AUTHORIZE PAYOUT:\n\n" + 
      "Total Revenue: " + window.formatAFN(totalRevenueInRange) + "\n" +
      "Balance to Pay: " + window.formatAFN(remainingBalanceOwed) + "\n\n" +
      "Confirm payment for the period: " + window.formatDate(from) + " to " + window.formatDate(to) + "?";

    if (confirm(confirmationMsg)) {
      addPartnerPayment({
        dept: deptID,
        amount: remainingBalanceOwed,
        fromDate: from,
        toDate: to,
        paymentDate: window.todayDate()
      });
    }
  }

  // ==========================================================================
  // 4. UI RENDERING
  // ==========================================================================

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans pb-32 animate-in fade-in duration-500">
      
      {/* HEADER & DATE SELECTORS */}
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div>
           <h1 className="text-2xl font-black text-white uppercase italic leading-none">{t("electrician")}</h1>
           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Settlement & Payout Portal</p>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-2xl border border-gray-700 shadow-inner">
          <div className="flex flex-col px-2 border-r border-gray-700">
             <span className="text-[8px] font-black text-gray-500 uppercase">{t("from")}</span>
             <input type="date" value={from} onChange={function(e){ setFrom(e.target.value); }} className="bg-transparent text-xs font-black text-white outline-none" />
          </div>
          <div className="flex flex-col px-2">
             <span className="text-[8px] font-black text-gray-500 uppercase">{t("to")}</span>
             <input type="date" value={to} onChange={function(e){ setTo(e.target.value); }} className="bg-transparent text-xs font-black text-white outline-none" />
          </div>
        </div>
      </div>

      {/* EDIT MODAL (Conditional) */}
      {editPaymentData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in zoom-in duration-300">
           <div className="bg-gray-800 border-2 border-gray-700 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-black text-white uppercase mb-6 italic">Edit Payment Entry</h3>
              <form onSubmit={handleUpdatePayment} className="space-y-4">
                 <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase mb-1 ml-1">Total AFN Paid</label>
                    <input type="number" value={editPaymentData.amount} onChange={e => setEditPaymentData({...editPaymentData, amount: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none" />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[9px] font-black text-gray-500 uppercase mb-1 ml-1">Range From</label>
                       <input type="date" value={editPaymentData.fromDate} onChange={e => setEditPaymentData({...editPaymentData, fromDate: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white text-xs outline-none" />
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-gray-500 uppercase mb-1 ml-1">Range To</label>
                       <input type="date" value={editPaymentData.toDate} onChange={e => setEditPaymentData({...editPaymentData, toDate: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white text-xs outline-none" />
                    </div>
                 </div>
                 <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 bg-orange-500 text-gray-900 font-black py-3 rounded-xl shadow-lg">UPDATE</button>
                    <button type="button" onClick={() => setEditPaymentData(null)} className="flex-1 bg-gray-700 text-white font-black py-3 rounded-xl">CANCEL</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* TRIPLE STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Total Revenue */}
        <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl relative overflow-hidden">
           <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Group Revenue</div>
           <div className="text-2xl font-black text-white tabular-nums tracking-tighter">{window.formatAFN(totalRevenueInRange)}</div>
           <div className="text-[9px] text-gray-600 font-bold uppercase mt-2 italic">100% Collected Intake</div>
        </div>

        {/* Card 2: Owner's fixed 50% share */}
        <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl opacity-90 relative overflow-hidden">
           <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Owner Share (50%)</div>
           <div className="text-2xl font-black text-gray-300 tabular-nums tracking-tighter">{window.formatAFN(ownerShareTotal)}</div>
           <div className="text-[9px] text-green-500 font-black uppercase mt-2 bg-green-500/5 py-1 px-2 rounded-lg border border-green-500/10 w-fit">Status: Already Paid</div>
        </div>

        {/* Card 3: Electrician's share with Pay Button or Paid Label */}
        <div className={"p-5 rounded-2xl border shadow-2xl transition-all duration-500 relative overflow-hidden " + (isRangeFullyPaid ? "bg-blue-900/20 border-blue-500/30" : "bg-orange-500/10 border-orange-500/30 shadow-orange-500/5")}>
           <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Electrician Balance</div>
           <div className={"text-2xl font-black mb-3 tabular-nums tracking-tighter " + (isRangeFullyPaid ? "text-blue-400" : "text-orange-400")}>
              {window.formatAFN(remainingBalanceOwed)}
           </div>
           
           {isRangeFullyPaid ? (
             <div className="w-full bg-blue-500/20 text-blue-400 py-3 rounded-xl text-[11px] font-black uppercase text-center border border-blue-500/30">
                Paid ✓
             </div>
           ) : (
             <button onClick={handleProcessPayment} disabled={remainingBalanceOwed <= 0} className="w-full bg-orange-500 text-gray-900 py-3 rounded-xl text-[11px] font-black uppercase shadow-lg active:scale-95 transition disabled:opacity-30">
                Authorize Payout
             </button>
           )}
        </div>
      </div>

      {/* SECTION: ELECTRICIAN PAYOUT HISTORY */}
      <div className="rounded-2xl border bg-gray-800 border-gray-700 overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">Official Payout Registry</h2>
          <span className="text-[9px] font-bold text-gray-600 uppercase italic">Cloud History</span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {electricianPaymentHistory.length === 0 ? <div className="p-10 text-center text-gray-600 text-[10px] font-bold uppercase tracking-widest opacity-30">No recorded payments</div> :
            electricianPaymentHistory.map(function(payment) {
              return (
                <div key={payment.id} className="p-5 flex justify-between items-center bg-blue-500/[0.01] hover:bg-gray-700/20 transition-all group">
                  <div>
                     <div className="text-sm font-black text-blue-400">PAID: {window.formatAFN(payment.amount)}</div>
                     <div className="text-[9px] text-gray-500 uppercase font-bold mt-1">Range: {window.formatDate(payment.fromDate)} to {window.formatDate(payment.toDate)}</div>
                     <div className="text-[8px] text-gray-600 mt-1 font-bold uppercase">Date: {window.formatDate(payment.paymentDate)}</div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setEditPaymentData(payment)} className="w-9 h-9 flex items-center justify-center bg-gray-700 text-gray-400 rounded-xl hover:text-white transition">✎</button>
                     <button onClick={() => handleDeletePayment(payment)} className="w-9 h-9 flex items-center justify-center bg-red-900/10 text-red-500/50 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition">🗑️</button>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* SECTION: TRANSACTION AUDIT LOG */}
      <div className="rounded-2xl border bg-gray-800 border-gray-700 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Detailed Service Ledger</h2>
        </div>
        <div className="divide-y divide-gray-700/50">
          {auditedTransactions.length === 0 ? <div className="p-16 text-center text-gray-600 italic text-[10px] font-bold uppercase tracking-widest opacity-20">No services performed in this range</div> :
            auditedTransactions.map(function(tx) {
              return (
                <div key={tx.id} className={"flex items-center px-6 py-5 gap-4 transition-all " + (tx.isCleared ? "opacity-30 bg-black/10" : "hover:bg-gray-700/40")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                       <div className={"text-sm font-black uppercase tracking-tight " + (tx.isCleared ? "text-gray-500 line-through" : "text-gray-200")}>{tx.description || "Electrician Service"}</div>
                       {tx.isCleared && <span className="text-[7px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">Cleared</span>}
                    </div>
                    <div className="text-[9px] text-gray-500 font-black uppercase">{window.formatDate(tx.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className={"font-black text-sm tabular-nums " + (tx.isCleared ? "text-gray-600" : "text-white")}>{window.formatAFN(tx.amount)}</div>
                    <div className="text-[9px] text-orange-500/70 uppercase font-black mt-1">50% Share: {window.formatAFN(tx.partnerShare)}</div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      <div className="h-10"></div>
    </div>
  );
};