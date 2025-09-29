import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, formatPercentage } from '@/lib/api';

interface ROIResult {
  initialInvestment: number;
  currentValue: number;
  absoluteGain: number;
  percentageGain: number;
  annualizedReturn: number;
  holdingPeriod: number;
  isProfit: boolean;
}

export default function ROICalculator() {
  const [inputs, setInputs] = useState({
    asset: 'BTC',
    initialInvestment: '',
    currentValue: '',
    purchaseDate: '',
  });
  
  const [result, setResult] = useState<ROIResult | null>(null);
  const { toast } = useToast();

  // Fetch current prices for asset selection
  const { data: marketData } = useQuery<any[]>({
    queryKey: [`/api/markets/snapshot?kind=crypto&symbols=BTC,ETH,SOL,ADA`],
    refetchInterval: 30000,
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/calculators/roi', data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast({
        title: 'Calculation Error',
        description: error instanceof Error ? error.message : 'Failed to calculate ROI',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    
    // Auto-fill current value if asset price is available
    if (field === 'asset' && marketData) {
      const selectedAsset = marketData.find((item: any) => item.symbol === value);
      if (selectedAsset && inputs.initialInvestment) {
        const quantity = parseFloat(inputs.initialInvestment) / selectedAsset.price;
        setInputs(prev => ({ 
          ...prev, 
          currentValue: (quantity * selectedAsset.price).toString()
        }));
      }
    }
  };

  const handleCalculate = () => {
    const data = {
      initialInvestment: parseFloat(inputs.initialInvestment),
      currentValue: parseFloat(inputs.currentValue),
      purchaseDate: inputs.purchaseDate ? new Date(inputs.purchaseDate).getTime() : undefined,
    };

    calculateMutation.mutate(data);
  };

  const isFormValid = inputs.initialInvestment && inputs.currentValue;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="glass-panel rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">ROI Calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="asset" className="text-sm font-medium text-foreground mb-2 block">
              Asset Selection
            </Label>
            <Select value={inputs.asset} onValueChange={(value) => handleInputChange('asset', value)}>
              <SelectTrigger className="calculator-input" id="asset" data-testid="roi-asset-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {marketData && Array.isArray(marketData) && marketData.map((asset: any) => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    {asset.name} ({asset.symbol}) - {formatPrice(asset.price)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="initial" className="text-sm font-medium text-foreground mb-2 block">
                Initial Investment
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="initial"
                  type="number"
                  placeholder="10,000"
                  value={inputs.initialInvestment}
                  onChange={(e) => handleInputChange('initialInvestment', e.target.value)}
                  className="calculator-input pl-8"
                  data-testid="roi-initial-investment"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="current" className="text-sm font-medium text-foreground mb-2 block">
                Current Value
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="current"
                  type="number"
                  placeholder="12,500"
                  value={inputs.currentValue}
                  onChange={(e) => handleInputChange('currentValue', e.target.value)}
                  className="calculator-input pl-8"
                  data-testid="roi-current-value"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchase-date" className="text-sm font-medium text-foreground mb-2 block">
                Purchase Date
              </Label>
              <Input
                id="purchase-date"
                type="date"
                value={inputs.purchaseDate}
                onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                className="calculator-input"
                data-testid="roi-purchase-date"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Holding Period
              </Label>
              <Input
                type="text"
                placeholder="Auto-calculated"
                className="calculator-input"
                readOnly
                value={
                  inputs.purchaseDate && result
                    ? `${result.holdingPeriod} days`
                    : ''
                }
              />
            </div>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={!isFormValid || calculateMutation.isPending}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-lg font-medium neon-glow transition-all"
            data-testid="roi-calculate"
          >
            <i className="fas fa-calculator mr-2"></i>
            {calculateMutation.isPending ? 'Calculating...' : 'Calculate ROI'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card className="glass-panel rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Results</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 glass-panel rounded-lg">
                  <div className={`text-2xl font-bold ${result.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {result.isProfit ? '+' : ''}{formatPercentage(result.percentageGain)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Total ROI</div>
                </div>
                <div className="text-center p-4 glass-panel rounded-lg">
                  <div className={`text-2xl font-bold ${result.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPrice(result.absoluteGain)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Profit/Loss</div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Initial Investment</span>
                  <span className="font-medium text-foreground">{formatPrice(result.initialInvestment)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Current Value</span>
                  <span className="font-medium text-foreground">{formatPrice(result.currentValue)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Absolute Gain</span>
                  <span className={`font-medium ${result.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {result.isProfit ? '+' : ''}{formatPrice(result.absoluteGain)}
                  </span>
                </div>
                {result.annualizedReturn !== 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Annualized Return</span>
                    <span className={`font-medium ${result.annualizedReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercentage(result.annualizedReturn)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Holding Period</span>
                  <span className="font-medium text-foreground">{result.holdingPeriod} days</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <button className="w-full text-left p-3 glass-panel rounded-lg hover:bg-accent/10 transition-all">
                  <i className="fas fa-share mr-2 text-primary"></i>
                  <span className="text-sm">Share Results</span>
                </button>
                <button className="w-full text-left p-3 glass-panel rounded-lg hover:bg-accent/10 transition-all">
                  <i className="fas fa-download mr-2 text-primary"></i>
                  <span className="text-sm">Export to CSV</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-calculator text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">
                Enter your investment details to calculate ROI
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
