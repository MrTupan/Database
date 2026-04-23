// window.MainApp
// ============================================================================
// MASTER ARCHITECTURE CONTROLLER v3.0
// ============================================================================
// This is the core engine of the Lemar Workshop Database.
// It manages the following critical system functions:
//
// 1. SESSION MANAGEMENT: 
//    - Handles the transition from the Login Portal to the Dashboard.
//    - Tracks the user role (Monitor vs Editor) to set permissions.
//
// 2. MODULAR ROUTING:
//    - Controls the 'page' state which determines which modular file is loaded.
//    - Links all 22 components including Management and Partner views.
//
// 3. RESPONSIVE NAVIGATION:
//    - Manages the 'menuOpen' state for the mobile sidebar drawer.
//    - Handles the backdrop overlay logic for portrait mode.
//
// 4. CLOUD SYNCHRONIZATION:
//    - Monitors the 'ready' state from the context to ensure data integrity.
//    - Shows a high-definition loading spinner during the initial sync.
//
// 5. THEME & LAYOUT:
//    - Uses a flex-row container that supports RTL (Pashto/Parsi) automatically.
//    - Integrates a sticky header with global language switching.

window.MainApp = function() {
  
  // -- GLOBAL CONTEXT HOOKS --
  // Fetches the system readiness status from contexts.js
  const { ready } = window.useApp();
  
  // Fetches the text direction (ltr/rtl) from LangProvider
  const { dir } = window.useLang(); 

  // -- STATE INITIALIZATION --
  // Session Role State: determines if the user can edit or only view
  const [role, setRole] = React.useState(null); 
  
  // Navigation Page State: determines the active component to render
  const [page, setPage] = React.useState("dashboard"); 

  // Mobile Navigation Toggle: handles the sidebar drawer in portrait mode
  const [menuOpen, setMenuOpen] = React.useState(false);

  // --- 1. SYSTEM INITIALIZATION RENDER ---
  // If the cloud database hasn't finished loading the roster, show this screen
  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
        <div className="spinner"></div>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
          Establishing Cloud Link
        </p>
      </div>
    );
  }

  // --- 2. SECURITY GATE RENDER ---
  // If the user hasn't successfully entered a password, lock them in the login module
  if (!role) {
    return <window.Login onLogin={function(selectedRole) {
      // Authorize the role and redirect to the main dashboard
      setRole(selectedRole);
      setPage("dashboard");
    }} />;
  }

  // --- 3. THE INTERNAL ROUTING ENGINE ---
  // Maps the current 'page' string to its corresponding component logic
  function renderActivePage() {
    
    // MANAGEMENT MODULES
    if (page === "dashboard")    return <window.Dashboard />;
    if (page === "transactions") return <window.Transactions role={role} />;
    if (page === "expenses")     return <window.Expenses role={role} />;
    if (page === "loans")        return <window.Loans role={role} />;
    if (page === "workers")      return <window.Workers role={role} />;
    if (page === "reports")      return <window.Reports />;
    
    // PARTNER MODULES (50/50 Revenue Split Views)
    if (page === "partner_mechanic")    return <window.PartnerMechanic />;
    if (page === "partner_painter")     return <window.PartnerPainter />;
    if (page === "partner_electrician") return <window.PartnerElectrician />;
    if (page === "partner_tire_shop")   return <window.PartnerTireShop />;
    if (page === "partner_spare_parts") return <window.PartnerSpareParts />;
    if (page === "partner_oil_sales")   return <window.PartnerOilSales />;
    
    // RECENTLY ADDED: Dent Repairer Partner Module
    if (page === "partner_dent_repairer") return <window.PartnerDentRepairer />;

    // SYSTEM FALLBACK
    return <window.Dashboard />;
  }

  // --- 4. MASTER UI LAYOUT ---
  return (
    <div className="flex flex-row min-h-screen bg-gray-950 text-white font-sans overflow-hidden relative">
      
      <window.Sidebar 
        page={page} 
        setPage={setPage} 
        role={role} 
        menuOpen={menuOpen}
        closeMenu={function() { setMenuOpen(false); }}
        onLogout={function() { setRole(null); }} 
      />

      {menuOpen && (
        <div 
          onClick={function() { setMenuOpen(false); }}
          className="fixed inset-0 bg-black/70 z-40 lg:hidden animate-in fade-in duration-300"
        ></div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative h-screen">
        
        <header className="no-print sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-4 py-4 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            
            <button 
              onClick={function() { setMenuOpen(!menuOpen); }}
              className="lg:hidden p-2 rounded-lg bg-gray-800 text-orange-500 border border-gray-700 active:scale-95 transition-all"
            >
              <div className="w-5 h-0.5 bg-current mb-1"></div>
              <div className="w-5 h-0.5 bg-current mb-1"></div>
              <div className="w-5 h-0.5 bg-current"></div>
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xl hidden sm:inline">
                {role === "editor" ? "✏️" : "👁️"}
              </span>
              <div className="hidden xs:block">
                 <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">
                    Verified Session
                 </div>
                 <div className="text-[12px] font-bold text-white uppercase tracking-tight">
                   {role} Management
                 </div>
              </div>
            </div>
          </div>
          
          <window.LanguageSwitcher />
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0f172a]">
          {renderActivePage()}
        </main>

        <footer className="no-print px-5 py-2 bg-gray-900 border-t border-gray-800 flex justify-between items-center">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                 Live Cloud Connection
              </span>
           </div>
           <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">
             Workshop Profit Tracker v3.0
           </span>
        </footer>
      </div>
    </div>
  );
};

// --- SYSTEM MOUNTING ---
const LangProvider = window.LangProvider;
const AppProvider  = window.AppProvider;
const MainApp      = window.MainApp;

const rootNode = document.getElementById("root");
const root = ReactDOM.createRoot(rootNode);

root.render(
  <LangProvider>
    <AppProvider>
      <MainApp />
    </AppProvider>
  </LangProvider>
);

console.log("Main Entry: Modular loading complete.");