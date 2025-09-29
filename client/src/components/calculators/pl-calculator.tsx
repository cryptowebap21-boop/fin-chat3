import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, formatPercentage } from '@/lib/api';

interface PLResult {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  roi: number;
  positionType: string;
  isProfit: boolean;
}

export default function PLCalculator() {
  const [inputs, setInputs] = useState({
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    fees: '0.1',
    positionType: 'long',
  });
  
  const [result, setResult] = useState<PLResult | null>(null);
  const { toast } = useToast();

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/calculators/pl', data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast({
        title: 'Calculation Error',
        description: error instanceof Error ? error.message : 'Failed to calculate P/L',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    const data = {
      entryPrice: parseFloat(inputs.entryPrice),
      exitPrice: parseFloat(inputs.exitPrice),
      quantity: parseFloat(inputs.quantity),
      fees: parseFloat(inputs.fees),
      positionType: inputs.positionType === 'long' ? 1 : -1,
    };

    calculateMutation.mutate(data);
  };

  const isFormValid = inputs.entryPrice && inputs.exitPrice && inputs.quantity;

  return (
    <div className="glass-panel rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 text-foreground">Profit/Loss Calculator</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Entry Position */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Entry Position</h3>
          <div>
            <Label htmlFor="entry-price" className="text-sm font-medium text-foreground mb-2 block">
              Entry Price
            </Label>
            <Input
              id="entry-price"
              type="number"
              placeholder="41,500"
              value={inputs.entryPrice}
              onChange={(e) => handleInputChange('entryPrice', e.target.value)}
              className="calculator-input"
              data-testid="pl-entry-price"
            />
          </div>
          <div>
            <Label htmlFor="quantity" className="text-sm font-medium text-foreground mb-2 block">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              placeholder="0.25"
              value={inputs.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              className="calculator-input"
              data-testid="pl-quantity"
            />
          </div>
          <div>
            <Label htmlFor="position-type" className="text-sm font-medium text-foreground mb-2 block">
              Position Type
            </Label>
            <Select value={inputs.positionType} onValueChange={(value) => handleInputChange('positionType', value)}>
              <SelectTrigger className="calculator-input" id="position-type" data-testid="pl-position-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exit Position */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Exit Position</h3>
          <div>
            <Label htmlFor="exit-price" className="text-sm font-medium text-foreground mb-2 block">
              Exit Price
            </Label>
            <Input
              id="exit-price"
              type="number"
              placeholder="43,247"
              value={inputs.exitPrice}
              onChange={(e) => handleInputChange('exitPrice', e.target.value)}
              className="calculator-input"
              data-testid="pl-exit-price"
            />
          </div>
          <div>
            <Label htmlFor="fees" className="text-sm font-medium text-foreground mb-2 block">
              Trading Fees (%)
            </Label>
            <Input
              id="fees"
              type="number"
              placeholder="0.1"
              value={inputs.fees}
              onChange={(e) => handleInputChange('fees', e.target.value)}
              className="calculator-input"
              data-testid="pl-fees"
            />
          </div>
          <Button
            onClick={handleCalculate}
            disabled={!isFormValid || calculateMutation.isPending}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-lg font-medium neon-glow transition-all mt-6"
            data-testid="pl-calculate"
          >
            {calculateMutation.isPending ? 'Calculating...' : 'Calculate P/L'}
          </Button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Results</h3>
          {result ? (
            <div className="space-y-3">
              <div className="p-4 glass-panel rounded-lg text-center">
                <div className={`text-xl font-bold ${result.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPrice(result.netPnL)}
                </div>
                <div className="text-sm text-muted-foreground">Net Profit/Loss</div>
              </div>
              <div className="p-3 glass-panel rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross P/L:</span>
                  <span className={result.grossPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatPrice(result.grossPnL)}
                  </span>
                </div>
              </div>
              <div className="p-3 glass-panel rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Fees:</span>
                  <span className="text-red-400">-{formatPrice(result.totalFees)}</span>
                </div>
              </div>
              <div className="p-3 glass-panel rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ROI:</span>
                  <span className={result.roi >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatPercentage(result.roi)}
                  </span>
                </div>
              </div>
              <div className="p-3 glass-panel rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="text-foreground">{result.positionType}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <i className="fas fa-balance-scale text-3xl text-muted-foreground mb-3"></i>
              <p className="text-sm text-muted-foreground">
                Enter position details to calculate P/L
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
