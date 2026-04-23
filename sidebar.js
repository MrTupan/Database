/* --- COMPONENT: SIDEBAR NAVIGATION --- */
// ============================================================================
// WORKSHOP NAVIGATION SYSTEM v4.0 - RESPONSIVE ARCHITECTURE
// ============================================================================
//
// This module handles:
// 1. Navigation State: Tracks the active page and role-based access.
// 2. Responsive Drawer: Handles "Hamburger" behavior for mobile Portrait mode.
// 3. RTL Support: Mirrors the UI for Dari and Pashto languages.
// 4. Dynamic Icons: Assigns unique visual glyphs to partner departments.
//
// ----------------------------------------------------------------------------
// UI DESIGN STANDARDS:
// ----------------------------------------------------------------------------
// - Colors: Gray-900 (Background), Gray-700 (Border), Orange-500 (Accent).
// - Spacing: Compact padding (p-3) for maximum content visibility on mobile.
// - Typography: Font-medium with uppercase headers for section clarity.
// ============================================================================

window.Sidebar = function({ page, setPage, role, menuOpen, closeMenu, onLogout }) {
  
  // -- GLOBAL DATA HOOKS --
  // Accessing multi-language helpers from the global language context
  const { t, dir } = window.useLang();
  
  // logic: Check if current language direction is Right-to-Left (Dari/Pashto)
  const isRtl = dir === "rtl";

  // --------------------------------------------------------------------------
  // -- SUB-COMPONENT: NAV ITEM --
  // --------------------------------------------------------------------------
  /**
   * NavItem
   * Helper component to generate a single menu button with active state detection.
   */
  function NavItem({ id, label, icon }) {
    // logic: Highlight the button if it matches the current active page
    const isActive = page === id;
    
    return (
      <button 
        onClick={function() { 
          // Action: Switch the master view
          setPage(id); 
          // logic: Close the menu drawer after clicking an item (Mobile only)
          if (closeMenu) closeMenu(); 
        }}
        className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-start " +
          (isActive 
            ? "bg-orange-500/20 text-orange-400 border-r-2 border-orange-500/50" 
            : "text-gray-300 hover:bg-gray-700/50 hover:text-white")}
      >
        <span className="text-lg">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  }

  // --------------------------------------------------------------------------
  // -- RTL & RESPONSIVE CALCULATION --
  // --------------------------------------------------------------------------
  // In LTR (English): Sidebar hides to the Left (-translate-x-full)
  // In RTL (Pashto/Dari): Sidebar hides to the Right (translate-x-full)
  let transformClass = "";
  if (menuOpen) {
    transformClass = "translate-x-0"; // State: Fully visible
  } else {
    // State: Hidden logic based on language direction for Android Drawer effect
    transformClass = isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0";
  }

  // logic: start-0 is a logical property (Left in LTR, Right in RTL)
  // lg:static: In landscape/tablet, sidebar becomes a fixed part of the layout.
  const sidebarClasses = "no-print fixed lg:static top-0 start-0 z-50 w-64 bg-gray-900 border-e border-gray-700 flex flex-col h-screen transition-transform duration-300 ease-in-out " + 
    transformClass;

  return (
    <aside className={sidebarClasses}>
      
      {/* 6.1 BRAND / LOGO SECTION */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-black/10">
        <div className="flex items-center gap-3">
          
          {/* --- BRAND PHOTO LOGO (Asset: assets/logo.png) --- */}
          <img 
            src="logo.png" 
            className="w-10 h-10 rounded-lg shadow-lg border border-gray-600 object-cover"
            alt="Lemar Workshop"
          />
          
          <div className="min-w-0">
            <div className="font-bold text-sm text-white truncate uppercase tracking-tight">
              {t("workshop")}
            </div>
            <div className="text-[12px] text-orange-500 font-bold uppercase tracking-tight opacity-80">
              {t("LTD")}              
            </div>
            <div className="text-[8px] text-red-500 font-bold uppercase tracking-widest opacity-60">
              {t(role)} SESSION
            </div>
          </div>
        </div>

        {/* Action: Close button visible only in Mobile drawer */}
        <button 
          onClick={closeMenu}
          className="lg:hidden p-2 text-gray-500 hover:text-white transition active:scale-75"
        >
          ✕
        </button>
      </div>

      {/* 6.2 MAIN NAVIGATION AREA */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        
        {/* SECTION HEADER: MANAGEMENT */}
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-3 py-3 mt-2 flex items-center gap-2">
          <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
          {t("management")}
        </div>
        
        <NavItem id="dashboard" label={t("ownerDashboard")} icon="📊" />
        <NavItem id="transactions" label={t("transactions")} icon="💵" />
        <NavItem id="expenses" label={t("expenses")} icon="💸" />
        <NavItem id="loans" label={t("loans")} icon="📋" />

        {/* SECTION HEADER: ROSTER */}
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-3 py-3 mt-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
          {t("roster")}
        </div>
        <NavItem id="workers" label={t("workers")} icon="👷" />

        {/* SECTION HEADER: ANALYSIS */}
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-3 py-3 mt-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
          {t("analysis")}
        </div>
        <NavItem id="reports" label={t("reports")} icon="📈" />

        {/* SECTION HEADER: PARTNER VIEWS (DYNAMIC ICON MAPPING) */}
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-3 py-3 mt-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
          {t("partnerViews")}
        </div>
        
        {window.PARTNER_DEPTS.map(function(deptID) {
          
          // logic: Determine the unique icon based on the department ID
          let partnerIcon = "🔧"; // Default fallback
          
          if (deptID === "mechanic")     partnerIcon = "🔧";
          if (deptID === "painter")      partnerIcon = "🎨";
          if (deptID === "electrician")  partnerIcon = "🔌";
          if (deptID === "tire_shop")    partnerIcon = "🛞";
          if (deptID === "spare_parts")  partnerIcon = "🧰";
          if (deptID === "oil_sales")    partnerIcon = "🛢️";
          if (deptID === "dent_repairer") partnerIcon = "🚙🔨";

          return (
            <NavItem 
              key={deptID} 
              id={"partner_" + deptID} 
              label={t(window.DEPT_KEY[deptID])} 
              icon={partnerIcon} 
            />
          );
        })}
      </nav>

      {/* 6.3 FOOTER / LOGOUT AREA */}
      <div className="p-3 border-t border-gray-700/50 bg-black/20">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition text-start"
        >
          <span>🚪</span>
          {t("logOut")}
        </button>
      </div>

      {/* 6.4 SYSTEM STATUS INDICATOR */}
      <div className="px-6 py-4 border-t border-gray-800 text-[9px] text-gray-600 flex items-center justify-between select-none">
        <div className="flex flex-col">
           <span className="font-bold tracking-widest text-[7px] uppercase opacity-40">System Architect</span>
           <span className="font-black tracking-tighter">NABIZADA</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="uppercase font-bold opacity-30">Live</span>
           <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_green]"></span>
        </div>
      </div>
    </aside>
  );
};

// ============================================================================
// END OF MODULE: SIDEBAR.JS
// ============================================================================