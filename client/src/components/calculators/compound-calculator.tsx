import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/api';

interface CompoundResult {
  principal: number;
  annualRate: number;
  years: number;
  monthlyContribution: number;
  compoundFrequency: number;
  futureValue: number;
  totalContributions: number;
  interestEarned: number;
  effectiveRate: number;
  yearlyBreakdown: Array<{
    year: number;
    value: number;
    contributions: number;
    interest: number;
  }>;
}

export default function CompoundCalculator() {
  const [inputs, setInputs] = useState({
    principal: '',
    annualRate: '',
    timePeriod: '',
    timeUnit: 'years',
    compoundFrequency: '12',
    monthlyContribution: '0',
  });
  
  const [result, setResult] = useState<CompoundResult | null>(null);
  const { toast } = useToast();

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/calculators/compound', data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast({
        title: 'Calculation Error',
        description: error instanceof Error ? error.message : 'Failed to calculate compound interest',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    const data = {
      principal: parseFloat(inputs.principal),
      annualRate: parseFloat(inputs.annualRate),
      timePeriod: parseFloat(inputs.timePeriod),
      timeUnit: inputs.timeUnit,
      compoundFrequency: parseInt(inputs.compoundFrequency),
      monthlyContribution: parseFloat(inputs.monthlyContribution),
    };

    calculateMutation.mutate(data);
  };

  const isFormValid = inputs.principal && inputs.annualRate && inputs.timePeriod;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="glass-panel rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Compound Interest Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="principal" className="text-sm font-medium text-foreground mb-2 block">
              Principal Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="principal"
                type="number"
                placeholder="10,000"
                value={inputs.principal}
                onChange={(e) => handleInputChange('principal', e.target.value)}
                className="calculator-input pl-8"
                data-testid="compound-principal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="annual-rate" className="text-sm font-medium text-foreground mb-2 block">
                Annual Interest Rate
              </Label>
              <div className="relative">
                <Input
                  id="annual-rate"
                  type="number"
                  placeholder="8"
                  value={inputs.annualRate}
                  onChange={(e) => handleInputChange('annualRate', e.target.value)}
                  className="calculator-input pr-8"
                  data-testid="compound-rate"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label htmlFor="time-period" className="text-sm font-medium text-foreground mb-2 block">
                Time Period
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="time-period"
                  type="number"
                  placeholder="5"
                  value={inputs.timePeriod}
                  onChange={(e) => handleInputChange('timePeriod', e.target.value)}
                  className="calculator-input flex-1"
                  data-testid="compound-time"
                />
                <Select value={inputs.timeUnit} onValueChange={(value) => handleInputChange('timeUnit', value)}>
                  <SelectTrigger className="calculator-input w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="years">Years</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="compound-frequency" className="text-sm font-medium text-foreground mb-2 block">
                Compound Frequency
              </Label>
              <Select value={inputs.compoundFrequency} onValueChange={(value) => handleInputChange('compoundFrequency', value)}>
                <SelectTrigger className="calculator-input" id="compound-frequency" data-testid="compound-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">Monthly</SelectItem>
                  <SelectItem value="4">Quarterly</SelectItem>
                  <SelectItem value="1">Annually</SelectItem>
                  <SelectItem value="365">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="monthly-contribution" className="text-sm font-medium text-foreground mb-2 block">
                Monthly Contribution
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="monthly-contribution"
                  type="number"
                  placeholder="500"
                  value={inputs.monthlyContribution}
                  onChange={(e) => handleInputChange('monthlyContribution', e.target.value)}
                  className="calculator-input pl-8"
                  data-testid="compound-contribution"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={!isFormValid || calculateMutation.isPending}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-lg font-medium neon-glow transition-all"
            data-testid="compound-calculate"
          >
            {calculateMutation.isPending ? 'Calculating...' : 'Calculate Compound Growth'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card className="glass-panel rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Projection Results</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-6">
              <div className="text-center p-6 glass-panel rounded-lg neon-glow">
                <div className="text-3xl font-bold gradient-text">{formatPrice(result.futureValue)}</div>
                <div className="text-sm text-muted-foreground mt-2">Final Amount</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 glass-panel rounded-lg">
                  <div className="text-xl font-bold text-primary">{formatPrice(result.totalContributions)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Contributions</div>
                </div>
                <div className="text-center p-4 glass-panel rounded-lg">
                  <div className="text-xl font-bold text-green-400">{formatPrice(result.interestEarned)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Interest Earned</div>
                </div>
              </div>

              {/* Growth Chart Placeholder */}
              <div className="h-40 glass-panel rounded-lg p-4 relative">
                <div className="text-sm font-medium text-foreground mb-2">Growth Over Time</div>
                <svg className="w-full h-full" viewBox="0 0 300 120">
                  <path 
                    className="sparkline" 
                    d="M10,100 Q75,90 150,70 Q225,50 290,30" 
                    strokeWidth="3"
                  />
                  <circle cx="290" cy="30" r="4" fill="var(--primary)" />
                </svg>
                <div className="absolute bottom-2 left-4 text-xs text-muted-foreground">Start</div>
                <div className="absolute bottom-2 right-4 text-xs text-muted-foreground">
                  Year {result.years}
                </div>
              </div>

              {/* Yearly Breakdown */}
              {result.yearlyBreakdown && result.yearlyBreakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Year-by-Year Breakdown</h4>
                  <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                    {result.yearlyBreakdown.slice(0, 5).map((year) => (
                      <div key={year.year} className="flex justify-between">
                        <span className="text-muted-foreground">Year {year.year}:</span>
                        <span className="text-foreground">{formatPrice(year.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-piggy-bank text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">
                Enter investment details to see compound growth projection
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
