/**
 * ============================================================================
 * WORKSHOP UTILITIES & CONFIGURATION MODULE v3.5
 * ============================================================================
 * This file serves as the foundational utility layer for the workshop app.
 * It handles global constants, currency formatting, and temporal date logic.
 *
 * ----------------------------------------------------------------------------
 * MAJOR REVISION LOG v3.5:
 * ----------------------------------------------------------------------------
 * 1. FRIDAY DETECTION: Added window.isFriday() to support manual wage entry
 *    for workers on "Both Shifts" during the Friday day-only schedule.
 * 2. DATE NORMALIZATION: Enforced strict ISO-8601 (YYYY-MM-DD) standards to
 *    prevent the "Empty Staff List" issue on future/past dates.
 * 3. TEMPORAL COMPARISON: Standardized numeric-based date comparison to solve
 *    alphabetical sorting bugs in historical reporting.
 * 4. CURRENCY PRECISION: Standardized AFN outputs for professional PDF reports.
 * ----------------------------------------------------------------------------
 */

// --- 1. GLOBAL DEPARTMENT MASTER LIST ---
// This array defines every department available for selection in the app.
// Adding or removing items here updates the entire system UI.
window.DEPTS = [
  "car_wash", 
  "mechanic", 
  "painter", 
  "electrician", 
  "tire_shop", 
  "spare_parts", 
  "oil_sales",
  "dent_repairer"
];

// --- 2. PARTNER REVENUE SPLIT CONFIGURATION ---
// These departments are shared 50/50 between the workshop owner and a partner.
// These are used for the Partner Views and the Dashboard settlement logic.
window.PARTNER_DEPTS = [
  "mechanic", 
  "painter", 
  "electrician", 
  "tire_shop", 
  "spare_parts", 
  "oil_sales", 
  "dent_repairer"
];

// --- 3. TRANSLATION DICTIONARY KEYS ---
// Used by the multi-language engine to look up names in translations.js.
// Maps internal IDs to human-readable language keys.
window.DEPT_KEY = {
  car_wash: "carWash",
  mechanic: "mechanic",
  painter: "painter",
  electrician: "electrician",
  tire_shop: "tireShop",
  spare_parts: "spareParts",
  oil_sales: "oilSales",
  dent_repairer: "dentRepairer"
};

// --- 4. STAFF SEED DATA ---
// This array is kept empty to protect your live cloud worker records.
// The app now uses the personnel registry managed in the Workers section.
window.SEED_WORKERS = []; 

// --- 5. REVENUE STREAM LOGIC ---
// isStreamA determines if 100% of the money goes to the owner.
// logic: Only Car Wash is 100% Owner; all other sectors involve a partner split.
window.isStreamA = function(deptID) {
  var isOwnerOnly = (deptID === "car_wash");
  return isOwnerOnly;
};

// --- 6. CURRENCY FORMATTING ENGINE ---
// formatAFN converts raw numbers into a professional AFN string.
// Example: 10000 -> AFN 10,000
window.formatAFN = function(amountValue) {
  // Ensure we are working with a valid number type
  var cleanAmount = Number(amountValue || 0);
  
  // Format with commas and no decimal places for Afghan Currency standards
  var formattedNumber = cleanAmount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  var finalString = "AFN " + formattedNumber;
  return finalString;
};

// --- 7. HIGH-PRECISION TIMEZONE LOGIC ---
// todayDate forces the app to sync with Afghanistan Time (UTC +4:30).
// This returns the standardized YYYY-MM-DD used for all database keys.
window.todayDate = function() {
  // Configuration for the international date formatter
  var tzOptions = {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  try {
    // locale 'sv-SE' (Sweden) is used because it defaults to ISO-8601 format
    var kabulTimeFormatter = new Intl.DateTimeFormat('sv-SE', tzOptions);
    var dateString = kabulTimeFormatter.format(new Date());
    
    // logic: ensure the string is exactly 10 characters (YYYY-MM-DD)
    var finalIsoDate = dateString.trim().substring(0, 10);
    return finalIsoDate;
  } catch (error) {
    // logic: reliable fallback for older Android devices or WebViews
    var d = new Date();
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    var fallbackDate = y + "-" + m + "-" + day;
    return fallbackDate;
  }
};

// --- 8. DATE DISPLAY FORMATTER ---
// formatDate converts database strings (YYYY-MM-DD) into DD/MM/YYYY for the user.
window.formatDate = function(rawDateString) {
  // Safety check for null inputs
  if (!rawDateString) {
    return "";
  }
  
  // logic: if date is already in DD/MM/YYYY (user input), return it as is
  if (rawDateString.indexOf('/') > -1 && rawDateString.split('/').length === 3) {
      return rawDateString;
  }

  // split into Year, Month, Day parts
  var parts = rawDateString.split("-");
  if (parts.length !== 3) {
    return rawDateString;
  }
  
  // Output format constructed for Afghan UI standards: Day / Month / Year
  var userDisplayDate = parts[2] + "/" + parts[1] + "/" + parts[0];
  return userDisplayDate;
};

// --- 9. TEMPORAL NORMALIZATION UTILITY ---
// normalizeDate ensures any input date is converted to YYYY-MM-DD for the cloud.
window.normalizeDate = function(d) {
    if (!d) return window.todayDate();
    
    // If format is already YYYY-MM-DD, return it safely
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return d;
    }
    
    // If format is DD/MM/YYYY (common in manual entry), flip it
    var parts = d.split("/");
    if (parts.length === 3) {
        var normalized = parts[2] + "-" + parts[1] + "-" + parts[0];
        return normalized;
    }
    
    return d;
};

/**
 * --- 10. FRIDAY DETECTION LOGIC ---
 * logic: Checks if a standardized date string represents a Friday.
 * used: To trigger manual wage inputs for Both-Shift staff.
 */
window.isFriday = function(dateString) {
    if (!dateString) return false;
    
    // Use ISO normalization to ensure the date object is accurate
    var isoDate = window.normalizeDate(dateString);
    
    // Use Noon (12:00) to prevent date-shifting during timezone offset calculations
    var d = new Date(isoDate + "T12:00:00");
    
    // getDay() returns 5 for Friday in standard JavaScript
    var dayIndex = d.getDay();
    var result = (dayIndex === 5);
    
    return result;
};

// --- 11. ADVANCED DATE COMPARISON ENGINE ---
// logic: Solves the "Alphabetical Comparison Failure" issue.
// returns: Numeric difference. Positive if dateA is later than dateB.
window.compareDates = function(dateA, dateB) {
    // Strip dashes and convert to raw numbers for integer math comparison
    var a = window.normalizeDate(dateA).replace(/-/g, "");
    var b = window.normalizeDate(dateB).replace(/-/g, "");
    
    var comparisonResult = Number(a) - Number(b);
    return comparisonResult;
};

// --- 12. CLOUD SNAPSHOT TRANSFORMER ---
// snapToArr turns Firebase object data into a clean, sortable array.
window.snapToArr = function(snapshotData) {
  // Get raw data object from Firebase cloud nodes
  var cloudData = snapshotData.val() || {};
  
  // Get keys and reverse them so newest items are first in the list
  var objectKeys = Object.keys(cloudData).reverse();
  
  // Transform the object into an array while injecting the ID
  var finalArray = objectKeys.map(function(uniqueKey) {
    var itemRecord = cloudData[uniqueKey];
    // Attach the unique Firebase key for React mapping and deletion
    itemRecord.id = uniqueKey; 
    return itemRecord;
  });
  
  return finalArray;
};

// --- 13. NATIVE ANDROID PRINT BRIDGE ---
// window.print overrides the browser print to use the Java PDF engine.
window.print = function() {
  // Log attempt for AIDE console monitoring
  console.log("Print Request: Connecting to Native Java Bridge...");

  // Check for the presence of our custom Java interface in MainActivity.java
  var bridgeExists = (window.AndroidPrint && window.AndroidPrint.print);

  if (bridgeExists) {
    // Trigger the Java print function
    window.AndroidPrint.print();
    console.log("Success: Handoff to Android Print Manager complete.");
  } else {
    // Handle cases where the app is run in a standard browser instead of APK
    var errMsg = "System Error: Native Print Interface missing.\n";
    errMsg += "Please run this app inside the Lemar Workshop APK.";
    
    console.error(errMsg);
    window.alert(errMsg);
  }
};

// --- 14. SYSTEM BOOTSTRAP LOGS ---
// These provide feedback during the index.html compilation phase.
console.log("=================================================");
console.log("WORKSHOP UTILITY CORE v3.5 LOADED");
console.log("Standardized Date Format: YYYY-MM-DD (ISO-8601)");
console.log("Friday Wage Logic: ACTIVE");
console.log("Active Timezone: Asia/Kabul (UTC +4:30)");
console.log("=================================================");

// ============================================================================
// END OF UTILITIES MODULE
// ============================================================================