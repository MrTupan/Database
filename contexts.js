/**
 * ============================================================================
 * WORKSHOP CLOUD DATA & CONTEXT ENGINE v7.0 - TEMPORAL & FORMAT INTEGRITY
 * ============================================================================
 * 
 * This module serves as the central "Brain" of the entire application.
 * It manages the synchronization between the local device and Firebase.
 *
 * ----------------------------------------------------------------------------
 * MAJOR REVISION LOG v7.0:
 * ----------------------------------------------------------------------------
 * 1. DATE FORMAT NORMALIZATION: 
 *    Enforces strict YYYY-MM-DD (ISO-8601) standards for every cloud write.
 *    This solves the "Alphabetical Comparison Failure" where staff lists 
 *    appeared empty on future dates.
 * 
 * 2. STANDALONE ATTENDANCE ENGINE: 
 *    Maintains the 'attendance' node history. Each day has a unique list 
 *    of working vs. absent staff, stored under normalized date keys.
 * 
 * 3. REAL-TIME DATA ARCHITECTURE:
 *    Synchronizes 7 distinct data vectors: Transactions, Expenses, Workers, 
 *    Loans, Inventory, Payouts, and Attendance.
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
 * Global context for translation strings and layout direction.
 */
window.LangCtx = createContext(null);

/**
 * window.LangProvider
 * logic: Multi-language wrapper providing support for EN, Dari, and Pashto.
 */
window.LangProvider = function({ children }) {
  
  // State: Selected language code (e.g., 'en', 'fa')
  const [lang, setLangRaw] = useState(function() { 
    return localStorage.getItem("wpt_lang") || "en"; 
  });

  // Action: Persist language choice to local device storage
  const setLang = function(l) {
    setLangRaw(l);
    localStorage.setItem("wpt_lang", l);
  };

  /**
   * t (Translate)
   * logic: Look up key in translations.js dictionary with English fallback.
   */
  const t = function(k) { 
    return (window.T[lang] && window.T[lang][k]) || (window.T.en[k]) || k; 
  };

  // logic: LTR for English, RTL for Afghan regional languages
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


/* --- SECTION 2: MASTER GLOBAL DATA HUB --- */

window.AppCtx = createContext(null);

/**
 * window.AppProvider
 * logic: The primary data engine. Connects the UI to the Firebase Cloud.
 */
window.AppProvider = function({ children }) {
  
  // --- A. PRIMARY DATA STATES ---
  const [transactions, setTransactions] = useState([]);
  const [expenses,     setExpenses]     = useState([]);
  const [workers,      setWorkers]      = useState([]);
  const [loans,        setLoans]        = useState([]);
  const [oilInventory, setOilInventory] = useState([]); 
  const [partnerPayments, setPartnerPayments] = useState([]);
  
  // --- B. ATTENDANCE HISTORY MAP ---
  // Structure: { "2026-04-21": { "workerID": true } }
  const [attendance, setAttendance] = useState({});
  
  // UI Ready Flag for Splash Screen
  const [ready, setReady] = useState(false);

  /**
   * useEffect (Lifecycle Initialization)
   * logic: Opens real-time web-socket listeners for all Firebase nodes.
   */
  useEffect(function() {
    
    // 1. Transaction Ledger Listener
    db.ref("transactions").on("value", function(snapshot) {
      setTransactions(window.snapToArr(snapshot));
    });

    // 2. Workshop Expense Listener
    db.ref("expenses").on("value", function(snapshot) {
      setExpenses(window.snapToArr(snapshot));
    });

    // 3. Customer Loan/Credit Listener
    db.ref("loans").on("value", function(snapshot) {
      setLoans(window.snapToArr(snapshot));
    });

    // 4. Lubricant Stock Inventory Listener
    db.ref("oil_inventory").on("value", function(snapshot) {
      setOilInventory(window.snapToArr(snapshot));
    });

    // 5. Partner Settlement History Listener
    db.ref("partner_payments").on("value", function(snapshot) {
      setPartnerPayments(window.snapToArr(snapshot));
    });

    // 6. Daily Staff Attendance Listener
    db.ref("attendance").on("value", function(snapshot) {
      setAttendance(snapshot.val() || {});
    });

    /**
     * 7. Roster Timeline Listener
     * logic: Validates and seeds the staff roster.
     */
    db.ref("workers").on("value", function(snap) {
      var data = snap.val() || {};
      
      // logic: Seed database if empty with baseline staff
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

    // --- CLEANUP PROTOCOL ---
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
   * logic: Saves daily revenue with forced date normalization.
   */
  function addTransaction(tx) {
    db.ref("transactions").push({
      // Normalization: Ensure date is YYYY-MM-DD
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

  function delTransaction(id) { 
    db.ref("transactions").child(id).remove(); 
  }

  /**
   * addExpense
   * logic: Saves overhead costs with forced date normalization.
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
   * logic: Creates a career timeline node for personnel.
   */
  function addWorker(workerData) {
    db.ref("workers").push({
        ...workerData,
        // Normalization: Prevent alphabetical comparison failure
        startDate: window.normalizeDate(workerData.startDate),
        endDate: null 
    });
  }

  function delWorker(id) { 
    db.ref("workers").child(id).remove(); 
  }

  function updWorker(id, data) { 
    // logic: if data contains dates, normalize them before update
    if (data.startDate) data.startDate = window.normalizeDate(data.startDate);
    if (data.endDate) data.endDate = window.normalizeDate(data.endDate);
    
    db.ref("workers").child(id).update(data); 
  }

  /**
   * toggleAttendance (Independent Daily System)
   * logic: Marks worker OFF for specific normalized date.
   */
  function toggleAttendance(rawDate, workerId, markAsOff) {
    const safeDate = window.normalizeDate(rawDate);
    if (markAsOff) {
        db.ref("attendance").child(safeDate).child(workerId).set(true);
    } else {
        db.ref("attendance").child(safeDate).child(workerId).remove();
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

  /**
   * logic: Distributes state and functions across all modular JS components.
   */
  const contextValue = {
    transactions, 
    expenses, 
    workers, 
    loans, 
    oilInventory, 
    partnerPayments, 
    attendance,      
    ready,
    addTransaction, 
    delTransaction, 
    addExpense, 
    delExpense,
    addWorker, 
    delWorker, 
    updWorker, 
    toggleAttendance, 
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

/* --- SECTION 5: GLOBAL CUSTOM HOOKS (API) --- */

/**
 * useLang
 * Hook: Retrieves translation engine and layout direction.
 */
window.useLang = function() { 
  return React.useContext(window.LangCtx); 
};

/**
 * useApp
 * Hook: Retrieves cloud data state and action methods.
 */
window.useApp = function() { 
  return React.useContext(window.AppCtx); 
};

/**
 * ============================================================================
 * SYSTEM LOG: 
 * Real-time Cloud context V7.0 established.
 * Mandatory ISO-8601 Date Normalization Protocol Active.
 * Standalone Attendance engine online.
 * ============================================================================
 */

// End of Module: contexts.js