import { useState } from 'react';
import Navbar from '@/components/layout/navbar';
import ChatAssistant from '@/components/chat/chat-assistant';
import MarketOverview from '@/components/markets/market-overview';
import TradingChart from '@/components/charts/trading-chart';
import NewsDashboard from '@/components/news/news-dashboard';
import CalculatorDashboard from '@/components/calculators/calculator-dashboard';
import TaxCalculator from '@/components/tax/tax-calculator';

export type TabType = 'chat' | 'charts' | 'news' | 'calculators' | 'tax';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const renderMainContent = () => {
    // For the chat tab, show the split layout like in the screenshot
    if (activeTab === 'chat') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 h-full animate-in fade-in duration-500">
          {/* Chat Assistant - Left Side */}
          <div className="col-span-1 lg:col-span-8">
            <ChatAssistant onNavigateToCharts={() => setActiveTab('charts')} />
          </div>
          
          {/* Market Overview - Right Side */}
          <div className="col-span-1 lg:col-span-4">
            <MarketOverview onNavigateToCharts={() => setActiveTab('charts')} />
          </div>
        </div>
      );
    }

    // For other tabs, show full-width content
    switch (activeTab) {
      case 'charts':
        return <div className="animate-in fade-in duration-500"><TradingChart /></div>;
      case 'news':
        return <div className="animate-in fade-in duration-500"><NewsDashboard /></div>;
      case 'calculators':
        return <div className="animate-in fade-in duration-500"><CalculatorDashboard /></div>;
      case 'tax':
        return <div className="animate-in fade-in duration-500"><TaxCalculator /></div>;
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 h-full animate-in fade-in duration-500">
            <div className="col-span-1 lg:col-span-8">
              <ChatAssistant onNavigateToCharts={() => setActiveTab('charts')} />
            </div>
            <div className="col-span-1 lg:col-span-4">
              <MarketOverview onNavigateToCharts={() => setActiveTab('charts')} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-100px)] md:min-h-[calc(100vh-80px)] transition-all duration-300 ease-in-out">
        {renderMainContent()}
      </main>
    </div>
  );
}