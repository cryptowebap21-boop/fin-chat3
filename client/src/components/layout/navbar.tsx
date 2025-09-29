import { useTheme } from '@/hooks/use-theme';
import { TabType } from '@/pages/home';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: 'chat' as TabType, label: 'Chat', icon: 'fas fa-robot' },
    { id: 'charts' as TabType, label: 'Charts', icon: 'fas fa-chart-area' },
    { id: 'news' as TabType, label: 'News', icon: 'fas fa-newspaper' },
    { id: 'calculators' as TabType, label: 'Calculators', icon: 'fas fa-calculator' },
    { id: 'tax' as TabType, label: 'Tax Tools', icon: 'fas fa-percentage' },
  ];

  return (
    <nav className="sticky top-0 z-50 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center justify-center flex-1 md:flex-none md:justify-start space-x-2 sm:space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 48 48" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="max-w-[150px] filter drop-shadow-sm"
              >
                {/* Financial chart bars */}
                <rect x="6" y="28" width="4" height="14" fill="#1e293b" rx="1"/>
                <rect x="12" y="24" width="4" height="18" fill="#334155" rx="1"/>
                <rect x="18" y="20" width="4" height="22" fill="#1e293b" rx="1"/>
                <rect x="24" y="16" width="4" height="26" fill="#334155" rx="1"/>
                
                {/* Chat bubble */}
                <path 
                  d="M32 8C37.5228 8 42 12.4772 42 18C42 23.5228 37.5228 28 32 28H35L30 32V28C32.2091 28 34 26.2091 34 24V12C34 9.79086 32.2091 8 30 8H32Z" 
                  fill="#1e293b"
                />
                <circle cx="35" cy="18" r="1.5" fill="white"/>
                <circle cx="38" cy="18" r="1.5" fill="white"/>
                
                {/* Connection line */}
                <path 
                  d="M28 24L32 20" 
                  stroke="#334155" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold gradient-text">FinChat</h1>
            <div className="pulse-dot w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full ml-1 sm:ml-2"></div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                data-testid={`nav-${item.id}`}
                className={`nav-tab px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-primary/20 text-primary border border-primary/30 neon-glow animate-glow'
                    : 'hover:bg-accent/20 hover:text-accent'
                }`}
              >
                <i className={`${item.icon} mr-2`}></i>
                {item.label}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg glass-panel flex items-center justify-center hover:bg-primary/10 transition-all"
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-primary text-sm sm:text-base`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-3 pb-3">
        <div className="flex flex-wrap justify-center gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              data-testid={`nav-mobile-${item.id}`}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all min-w-[60px] flex-1 max-w-[100px] ${
                activeTab === item.id
                  ? 'bg-primary/25 text-primary border-2 border-primary/50 scale-105 neon-glow animate-glow'
                  : 'hover:bg-accent/15 hover:text-accent text-muted-foreground border-2 border-transparent'
              }`}
            >
              <div className="flex flex-col items-center space-y-1">
                <i className={`${item.icon} text-sm`}></i>
                <span className="leading-none">{item.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
