/* --- COMPONENT: LANGUAGE SWITCHER --- */
// Allows users to switch between English, Farsi, and Pashto on the login screen
window.LanguageSwitcher = function() {
  const { lang, setLang, t } = window.useLang();
  const [open, setOpen] = React.useState(false);
  
  const LANGS = [
    { code: "en", label: "English" },
    { code: "fa", label: "فارسی" },
    { code: "ps", label: "پښتو" }
  ];

  return (
    <div className="relative no-print">
      <button 
        onClick={function() { setOpen(!open); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 text-sm hover:bg-gray-700 transition text-gray-200"
      >
        🌐 <span>{t("language")}</span>
      </button>
      
      {open && (
        <div className="absolute top-full mt-1 end-0 bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden z-50 min-w-[130px]">
          {LANGS.map(function(l) {
            return (
              <button 
                key={l.code} 
                onClick={function() { setLang(l.code); setOpen(false); }}
                className={"w-full px-4 py-2 text-sm text-start hover:bg-gray-700 transition " + (lang === l.code ? "text-orange-400 font-semibold" : "text-gray-200")}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* --- COMPONENT: LOGIN SCREEN --- */
// The first screen that guards the app with passwords
window.Login = function({ onLogin }) {
  const { t } = window.useLang();
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    
    // Exact logic from your original index.html
    if (pw === "wali@lemar") { 
      onLogin("monitor"); 
      return; 
    }
    if (pw === "nabizada@lemar") { 
      onLogin("editor");  
      return; 
    }
    
    // If wrong password
    setErr(true);
    // Remove error highlight after 2 seconds
    setTimeout(function() { setErr(false); }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-sans">
      {/* Language Switcher in top right */}
      <div className="absolute top-4 end-4">
        <window.LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          
          {/* PHOTO ICON INSTEAD OF EMOJI --- */}
          <img 
            src="logo.png" 
            className="w-24 h-24 rounded-2xl mx-auto mb-4 shadow-lg border-2 border-orange-500/30 object-cover" 
            alt="Workshop Logo"
          />
          
          <h1 className="text-xl font-bold uppercase tracking-widest text-white">
            {t("workshopPortal")}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t("enterPassword")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type="password" 
              required 
              value={pw}
              onChange={function(e) { setPw(e.target.value); setErr(false); }}
              placeholder="••••••••"
              className={"w-full rounded-xl border px-4 py-4 bg-gray-900 text-white text-center text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-500 transition " + (err ? "border-red-500 animate-pulse" : "border-gray-600")}
              autoFocus
            />
          </div>

          {err && (
            <p className="text-red-400 text-sm text-center font-semibold animate-bounce">
              {t("wrongPassword")}
            </p>
          )}

          <button 
            type="submit"
            className="w-full bg-orange-500 text-gray-900 py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-orange-400 active:scale-95 transition shadow-lg shadow-orange-500/20"
          >
            {t("accessSystem")}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-700/50 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
            Authorized Personnel Only
          </p>
          <p className="text-xs text-orange-500/50 mt-2 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            {t("connected")}
          </p>
        </div>
      </div>
    </div>
  );
};
