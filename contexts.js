/**
 * ============================================================================
 * WORKSHOP CLOUD DATA & CONTEXT ENGINE v8.0 - ATTENDANCE & FRIDAY PAYROLL
 * ============================================================================
 * 
 * This module serves as the central "Brain" of the entire application.
 * It manages the synchronization between the local device and Firebase.
 *
 * ----------------------------------------------------------------------------
 * MAJOR REVISION LOG v8.0:
 * ----------------------------------------------------------------------------
 * 1. FRIDAY WAGE SUPPORT: 
 *    The 'attendance' node now stores objects. This allows the system to 
 *    record manual wages for "Both Shift" workers on Fridays without 
 *    changing their permanent contract wage.
 * 
 * 2. STANDALONE DAILY ENGINE: 
 *    Each date has a unique attendance map. Marking a worker OFF or 
 *    changing their Friday pay only affects that specific date.
 * 
 * 3. UNIVERSAL DATE NORMALIZATION: 
 *    Every function now forces dates into YYYY-MM-DD. This ensures that 
 *    hired staff transfer correctly into the future and historical 
 *    reports remain accurate.
 * 
 * 4. REAL-TIME DATA HUB:
 *    Maintains persistent web-socket links for Transactions, Expenses, 
 *    Workers, Loans, Inventory, Payouts, and the new Attendance logic.
 * ----------------------------------------------------------------------------
 */

const { 
  useState, 
  useContext, 
  createContext, 
  useEffect 
} = React;

/* --- SECTION 1: LANGUAGE & UI DIRECTION CONTEXT --- */

/**
 * window.LangCtx
 * Stores translation keys and layout orientation (LTR/RTL).
 */
window.LangCtx = createContext(null);

/**
 * window.LangProvider
 * logic: Multi-language wrapper providing support for EN, Dari, and Pashto.
 */
window.LangProvider = function({ children }) {
  
  // State: Selected language code
  const [lang, setLangRaw] = useState(function() { 
    return localStorage.getItem("wpt_lang") || "en"; 
  });

  // Action: Persist language choice to local device storage
  const setLang = function(l) {
    setLangRaw(l);
    localStorage.setItem("wpt_lang", l);
  };

  /**
   * t (Translate Helper)
   * logic: Look up key in translations.js with English fallback.
   */
  const t = function(k) { 
    return (window.T[lang] && window.T[lang][k]) || (window.T.en[k]) || k; 
  };

  // direction logic: Afghan languages are RTL
  const dir = lang === "en" ? "ltr" : "rtl";

  /**
   * Effect: DOM Sync
   * logic: Updates root HTML attributes for RTL/LTR layout flipping.
   */
  useEffect(function() {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  return React.createElement(window.LangCtx.Provider, { 
    value: { lang, setLang, t, dir } 
  }, children);
};


/* --- SECTION 2: MASTER GLOBAL DATA HUB (FIREBASE) --- */

window.AppCtx = createContext(null);

/**
 * window.AppProvider
 * logic: The primary data engine connecting the app to the Cloud.
 */
window.AppProvider = function({ children }) {
  
  // --- A. PRIMARY DATA STATES (Arrays) ---
  const [transactions, setTransactions] = useState([]);
  const [expenses,     setExpenses]     = useState([]);
  const [workers,      setWorkers]      = useState([]);
  const [loans,        setLoans]        = useState([]);
  const [oilInventory, setOilInventory] = useState([]); 
  const [partnerPayments, setPartnerPayments] = useState([]);
  
  // --- B. ATTENDANCE & WAGE OVERRIDE MAP ---
  // Key Structure: { "YYYY-MM-DD": { "workerID": { isOff: bool, fridayWage: num } } }
  const [attendance, setAttendance] = useState({});
  
  // System Readiness Flag
  const [ready, setReady] = useState(false);

  /**
   * useEffect (Socket Initialization)
   * logic: Opens real-time web-socket listeners for all primary nodes.
   */
  useEffect(function() {
    
    // 1. Transactions Socket (Revenue & Splits)
    db.ref("transactions").on("value", function(snapshot) {
      setTransactions(window.snapToArr(snapshot));
    });

    // 2. Expenses Socket (Overhead)
    db.ref("expenses").on("value", function(snapshot) {
      setExpenses(window.snapToArr(snapshot));
    });

    // 3. Loans Socket (Receivables)
    db.ref("loans").on("value", function(snapshot) {
      setLoans(window.snapToArr(snapshot));
    });

    // 4. Oil Inventory Socket (Lubricants)
    db.ref("oil_inventory").on("value", function(snapshot) {
      setOilInventory(window.snapToArr(snapshot));
    });

    // 5. Partner Payouts Socket (Disbursements)
    db.ref("partner_payments").on("value", function(snapshot) {
      setPartnerPayments(window.snapToArr(snapshot));
    });

    // 6. Attendance & Friday Wage Socket
    db.ref("attendance").on("value", function(snapshot) {
      setAttendance(snapshot.val() || {});
    });

    /**
     * 7. Roster timeline Socket
     * logic: Validates and seeds the staff roster.
     */
    db.ref("workers").on("value", function(snap) {
      var data = snap.val() || {};
      
      // logic: Seed database if empty
      if (Object.keys(data).length === 0) {
          window.SEED_WORKERS.forEach(function(w) {
            db.ref("workers").push(Object.assign({}, w, { 
              sector: 'car_wash',
              startDate: '2024-01-01',
              endDate: null 
            }));
          });
          return; 
      }

      // logic: Transform raw object into array with IDs
      var arr = Object.keys(data).map(function(k) {
        var workerItem = data[k];
        workerItem.id = k;
        return workerItem;
      });
      
      setWorkers(arr);
      setReady(true); 
    });

    // --- CLEANUP ---
    return function() {
      db.ref("transactions").off();
      db.ref("expenses").off();
      db.ref("workers").off();
      db.ref("loans").off();
      db.ref("oil_inventory").off();
      db.ref("partner_payments").off();
      db.ref("attendance").off();
    };

  }, []);

  /* --- SECTION 3: NORMALIZED CLOUD ACTIONS (WRITE ENGINE) --- */

  /**
   * addTransaction
   * logic: Records revenue with forced date normalization.
   */
  function addTransaction(tx) {
    db.ref("transactions").push({
      date:              window.normalizeDate(tx.date),
      department:        tx.department,
      amount:            tx.amount,      
      description:       tx.description || "",
      oilBrandID:        tx.oilBrandID || "none",
      oilLiters:         tx.oilLiters || 0,
      grossRevenue:      tx.grossRevenue || tx.amount, 
      oilBuyPriceAtSale: tx.oilBuyPriceAtSale || 0,
      ownerShare:        window.isStreamA(tx.department) ? tx.amount : tx.amount * 0.5,
      partnerShare:      window.isStreamA(tx.department) ? 0 : tx.amount * 0.5,
      timestamp:         tx.timestamp || new Date().toISOString()
    });
  }

  /**
   * delTransaction
   * Removes a record from the cloud ledger.
   */
  function delTransaction(id) { 
    db.ref("transactions").child(id).remove(); 
  }

  /**
   * addExpense
   * logic: Saves costs with forced date normalization.
   */
  function addExpense(e) {
    db.ref("expenses").push({ 
      date: window.normalizeDate(e.date), 
      description: e.description, 
      amount: e.amount 
    });
  }

  function delExpense(id) { 
    db.ref("expenses").child(id).remove(); 
  }

  /**
   * addWorker
   * logic: Enrolls personnel into the timeline registry.
   */
  function addWorker(workerData) {
    db.ref("workers").push({
        ...workerData,
        startDate: window.normalizeDate(workerData.startDate),
        endDate: null 
    });
  }

  function delWorker(id) { 
    db.ref("workers").child(id).remove(); 
  }

  /**
   * updWorker
   * logic: Synchronizes profile changes or "Safe Deletions" (End Dates).
   */
  function updWorker(id, data) { 
    if (data.startDate) data.startDate = window.normalizeDate(data.startDate);
    if (data.endDate) data.endDate = window.normalizeDate(data.endDate);
    db.ref("workers").child(id).update(data); 
  }

  /**
   * toggleAttendance
   * logic: Records STANDALONE daily data (OFF status and Friday wages).
   * @param {string} rawDate - Target date
   * @param {string} workerId - Target worker
   * @param {any} statusData - Boolean (isOff) OR Object {isOff, fridayWage}
   */
  function toggleAttendance(rawDate, workerId, statusData) {
    const safeDate = window.normalizeDate(rawDate);
    
    // logic: If statusData is exactly 'false' and not an object, clean up node
    if (statusData === false) {
        db.ref("attendance").child(safeDate).child(workerId).remove();
    } else {
        // logic: Save either the boolean or the complex Friday wage object
        db.ref("attendance").child(safeDate).child(workerId).set(statusData);
    }
  }

  /**
   * addLoan / updLoan
   */
  function addLoan(loanData) {
    if (loanData.loanDate) loanData.loanDate = window.normalizeDate(loanData.loanDate);
    db.ref("loans").push(loanData);
  }

  function updLoan(id, updateData) { 
    if (updateData.loanDate) updateData.loanDate = window.normalizeDate(updateData.loanDate);
    if (updateData.lastPaymentDate) updateData.lastPaymentDate = window.normalizeDate(updateData.lastPaymentDate);
    db.ref("loans").child(id).update(updateData); 
  }

  /**
   * addOilBrand / updOilBrand / delOilBrand
   */
  function addOilBrand(brandData) {
    db.ref("oil_inventory").push(brandData);
  }

  function updOilBrand(id, data) {
    db.ref("oil_inventory").child(id).update(data);
  }

  function delOilBrand(id) {
    db.ref("oil_inventory").child(id).remove();
  }

  function addPartnerPayment(paymentData) {
    if (paymentData.fromDate) paymentData.fromDate = window.normalizeDate(paymentData.fromDate);
    if (paymentData.toDate) paymentData.toDate = window.normalizeDate(paymentData.toDate);
    db.ref("partner_payments").push(paymentData);
  }

  /* --- SECTION 4: EXPORT CONTEXT PROVIDER --- */

  const contextValue = {
    transactions, 
    expenses, 
    workers, 
    loans, 
    oilInventory, 
    partnerPayments, 
    attendance, // Exported standalone daily attendance and wage overrides
    ready,
    addTransaction, 
    delTransaction, 
    addExpense, 
    delExpense,
    addWorker, 
    delWorker, 
    updWorker, 
    toggleAttendance, // Exported to support Friday manual pay logic
    addLoan, 
    updLoan,
    addOilBrand, 
    updOilBrand, 
    delOilBrand,
    addPartnerPayment 
  };

  return React.createElement(window.AppCtx.Provider, { 
    value: contextValue 
  }, children);
};

/* --- SECTION 5: GLOBAL CUSTOM HOOKS --- */

window.useLang = function() { 
  return React.useContext(window.LangCtx); 
};

window.useApp = function() { 
  return React.useContext(window.AppCtx); 
};

/**
 * ============================================================================
 * SYSTEM LOG: 
 * Real-time Cloud context V8.0 established.
 * Friday Manual Wage Object Architecture Active.
 * Historical Departure Protection (endDate) Synchronized.
 * ============================================================================
 */

// End of Module: contexts.js