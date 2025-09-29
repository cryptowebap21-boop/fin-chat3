import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/api';

interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  rates: Record<string, number>;
}

export default function ConversionCalculator() {
  const [inputs, setInputs] = useState({
    amount: '1',
    fromCurrency: 'BTC',
    toCurrency: 'USD',
  });
  
  const [result, setResult] = useState<ConversionResult | null>(null);
  const { toast } = useToast();

  // Fetch live rates for display
  const { data: marketData } = useQuery<any[]>({
    queryKey: [`/api/markets/snapshot?kind=crypto&symbols=BTC,ETH,SOL,ADA`],
    refetchInterval: 15000,
  });

  const convertMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/calculators/convert', data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast({
        title: 'Conversion Error',
        description: error instanceof Error ? error.message : 'Failed to convert currency',
        variant: 'destructive',
      });
    },
  });

  const currencies = [
    { symbol: 'USD', name: 'US Dollar' },
    { symbol: 'EUR', name: 'Euro' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'ADA', name: 'Cardano' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleSwap = () => {
    setInputs(prev => ({
      ...prev,
      fromCurrency: prev.toCurrency,
      toCurrency: prev.fromCurrency,
    }));
    setResult(null);
  };

  const handleConvert = () => {
    const data = {
      amount: parseFloat(inputs.amount),
      fromCurrency: inputs.fromCurrency,
      toCurrency: inputs.toCurrency,
    };

    convertMutation.mutate(data);
  };

  const handleQuickAmount = (amount: string) => {
    setInputs(prev => ({ ...prev, amount }));
  };

  const isFormValid = inputs.amount && inputs.fromCurrency && inputs.toCurrency;

  return (
    <Card className="glass-panel rounded-xl max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground text-center">
          Cryptocurrency Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* From Currency */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">From</Label>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="1.0"
              value={inputs.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className="calculator-input text-lg font-medium"
              data-testid="conversion-amount"
            />
            <Select value={inputs.fromCurrency} onValueChange={(value) => handleInputChange('fromCurrency', value)}>
              <SelectTrigger className="calculator-input" data-testid="conversion-from-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.symbol} value={currency.symbol}>
                    {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwap}
            className="w-12 h-12 glass-panel rounded-full hover:neon-glow transition-all"
            data-testid="conversion-swap"
          >
            <i className="fas fa-exchange-alt text-primary"></i>
          </Button>
        </div>

        {/* To Currency */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">To</Label>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              placeholder="Result"
              value={result ? result.convertedAmount.toFixed(8) : ''}
              className="calculator-input text-lg font-medium"
              readOnly
              data-testid="conversion-result"
            />
            <Select value={inputs.toCurrency} onValueChange={(value) => handleInputChange('toCurrency', value)}>
              <SelectTrigger className="calculator-input" data-testid="conversion-to-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.symbol} value={currency.symbol}>
                    {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Convert Button */}
        <Button
          onClick={handleConvert}
          disabled={!isFormValid || convertMutation.isPending}
          className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-lg font-medium neon-glow transition-all"
          data-testid="conversion-convert"
        >
          {convertMutation.isPending ? 'Converting...' : 'Convert'}
        </Button>

        {/* Live Rates */}
        <div className="glass-panel rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Live Exchange Rates</h3>
          <div className="space-y-2 text-sm">
            {marketData && Array.isArray(marketData) && marketData.slice(0, 4).map((asset: any) => (
              <div key={asset.symbol} className="flex justify-between">
                <span className="text-muted-foreground">1 {asset.symbol}</span>
                <span className="text-foreground">{formatPrice(asset.price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 pulse-dot"></div>
            Updated in real-time
          </div>
        </div>

        {/* Quick Convert Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {['100', '500', '1000', '10000'].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAmount(amount)}
              className="glass-panel hover:bg-accent/10 transition-all"
              data-testid={`quick-amount-${amount}`}
            >
              ${amount}
            </Button>
          ))}
        </div>

        {/* Exchange Rate Display */}
        {result && (
          <div className="glass-panel rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Exchange Rate</div>
            <div className="text-lg font-medium text-foreground">
              1 {result.fromCurrency} = {result.exchangeRate.toFixed(8)} {result.toCurrency}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
