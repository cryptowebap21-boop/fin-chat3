import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ROICalculator from './roi-calculator';
import PLCalculator from './pl-calculator';
import CompoundCalculator from './compound-calculator';
import ConversionCalculator from './conversion-calculator';

type CalculatorType = 'roi' | 'pl' | 'compound' | 'conversion';

export default function CalculatorDashboard() {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorType>('roi');

  const calculators = [
    { id: 'roi' as CalculatorType, label: 'ROI Calculator', icon: 'fas fa-chart-line' },
    { id: 'pl' as CalculatorType, label: 'P/L Calculator', icon: 'fas fa-balance-scale' },
    { id: 'compound' as CalculatorType, label: 'Compound Interest', icon: 'fas fa-piggy-bank' },
    { id: 'conversion' as CalculatorType, label: 'Crypto Converter', icon: 'fas fa-exchange-alt' },
  ];

  const renderCalculator = () => {
    switch (activeCalculator) {
      case 'roi':
        return <ROICalculator />;
      case 'pl':
        return <PLCalculator />;
      case 'compound':
        return <CompoundCalculator />;
      case 'conversion':
        return <ConversionCalculator />;
      default:
        return <ROICalculator />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Calculator Tabs */}
      <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
        {calculators.map((calc) => (
          <Button
            key={calc.id}
            variant={activeCalculator === calc.id ? 'default' : 'outline'}
            onClick={() => setActiveCalculator(calc.id)}
            data-testid={`calc-tab-${calc.id}`}
            className={`text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3 ${activeCalculator === calc.id ? 'bg-primary/20 text-primary border-primary/30' : ''}`}
          >
            <i className={`${calc.icon} mr-1 sm:mr-2 text-xs sm:text-sm`}></i>
            <span className="hidden sm:inline">{calc.label}</span>
            <span className="sm:hidden">{calc.label.split(' ')[0]}</span>
          </Button>
        ))}
      </div>

      {/* Calculator Content */}
      {renderCalculator()}

      {/* Calculator Features */}
      <div className="glass-panel rounded-xl p-4 border border-primary/30">
        <p className="text-sm text-muted-foreground">
          <i className="fas fa-calculator text-primary mr-2"></i>
          <strong>Professional Tools:</strong> Advanced financial calculators with real-time market data integration. 
          Precision-engineered algorithms provide accurate calculations for investment planning and portfolio analysis. 
          Results include comprehensive breakdowns and scenario modeling for informed decision-making.
        </p>
      </div>
    </div>
  );
}
