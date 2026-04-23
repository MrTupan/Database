// ============================================================================
// WORKSHOP UTILITIES & CONFIGURATION MODULE v3.0
// ============================================================================
// This file serves as the foundational utility layer for the workshop app.
// It handles global constants, currency formatting, and temporal date logic.
//
// ----------------------------------------------------------------------------
// MAJOR REVISION LOG v3.0:
// ----------------------------------------------------------------------------
// 1. DATE NORMALIZATION: Added forced ISO-8601 (YYYY-MM-DD) standards to
//    prevent the "Empty Staff List" issue on future/past dates.
// 2. TEMPORAL COMPARISON: Added window.compareDates to allow the app to
//    correctly determine if a hire date has passed relative to today.
// 3. CURRENCY PRECISION: Standardized AFN outputs for better PDF reporting.
// ----------------------------------------------------------------------------

// --- 1. GLOBAL DEPARTMENT MASTER LIST ---
// This array defines every department available for selection in the app.
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
// Logic: Only Car Wash is 100% Owner; all others are 50/50.
window.isStreamA = function(deptID) {
  var isOwnerOnly = (deptID === "car_wash");
  return isOwnerOnly;
};

// --- 6. CURRENCY FORMATTING ENGINE ---
// formatAFN converts raw numbers into a professional AFN string.
// Example: 10000 -> AFN 10,000
window.formatAFN = function(amountValue) {
  // Ensure we are working with a valid number
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
    // locale 'sv-SE' (Sweden) is used because it defaults to ISO format
    var kabulTimeFormatter = new Intl.DateTimeFormat('sv-SE', tzOptions);
    var dateString = kabulTimeFormatter.format(new Date());
    
    // logic: ensure the string is exactly 10 characters (YYYY-MM-DD)
    return dateString.trim().substring(0, 10);
  } catch (error) {
    // logic: reliable fallback for older devices
    var d = new Date();
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return y + "-" + m + "-" + day;
  }
};

// --- 8. DATE DISPLAY FORMATTER ---
// formatDate converts database strings (YYYY-MM-DD) into DD/MM/YYYY.
window.formatDate = function(rawDateString) {
  if (!rawDateString) return "";
  
  // logic: if date is already in DD/MM/YYYY, return it as is
  if (rawDateString.indexOf('/') > -1 && rawDateString.split('/').length === 3) {
      return rawDateString;
  }

  var parts = rawDateString.split("-");
  if (parts.length !== 3) return rawDateString;
  
  // Output format: Day / Month / Year
  return parts[2] + "/" + parts[1] + "/" + parts[0];
};

// --- 9. TEMPORAL NORMALIZATION UTILITY ---
// normalizeDate ensures any input date is converted to YYYY-MM-DD for the cloud.
window.normalizeDate = function(d) {
    if (!d) return window.todayDate();
    // If format is already YYYY-MM-DD, return it
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
    // If format is DD/MM/YYYY, flip it
    var parts = d.split("/");
    if (parts.length === 3) {
        return parts[2] + "-" + parts[1] + "-" + parts[0];
    }
    return d;
};

// --- 10. ADVANCED DATE COMPARISON ENGINE ---
// logic: Solves the "Alphabetical Comparison Failure" issue.
// returns: -1 if a < b, 1 if a > b, 0 if equal.
window.compareDates = function(dateA, dateB) {
    var a = window.normalizeDate(dateA).replace(/-/g, "");
    var b = window.normalizeDate(dateB).replace(/-/g, "");
    return Number(a) - Number(b);
};

// --- 11. CLOUD SNAPSHOT TRANSFORMER ---
// snapToArr turns Firebase object data into a clean, sortable array.
window.snapToArr = function(snapshotData) {
  var cloudData = snapshotData.val() || {};
  var objectKeys = Object.keys(cloudData).reverse();
  
  return objectKeys.map(function(uniqueKey) {
    var itemRecord = cloudData[uniqueKey];
    itemRecord.id = uniqueKey; 
    return itemRecord;
  });
};

// --- 12. NATIVE ANDROID PRINT BRIDGE ---
// window.print overrides the browser print to use the Java PDF engine.
window.print = function() {
  console.log("Print Request: Connecting to Native Java Bridge...");

  var bridgeExists = (window.AndroidPrint && window.AndroidPrint.print);

  if (bridgeExists) {
    window.AndroidPrint.print();
    console.log("Success: Handoff to Android Print Manager complete.");
  } else {
    var errMsg = "System Error: Native Print Interface missing.\n";
    errMsg += "Please run this app inside the Lemar Workshop APK.";
    console.error(errMsg);
    window.alert(errMsg);
  }
};

// --- 13. SYSTEM BOOTSTRAP LOGS ---
console.log("=================================================");
console.log("WORKSHOP UTILITY CORE v3.0 LOADED");
console.log("Standardized Date Format: YYYY-MM-DD (ISO-8601)");
console.log("Active Timezone: Asia/Kabul (UTC +4:30)");
console.log("=================================================");

// ============================================================================
// END OF UTILITIES MODULE
// ============================================================================