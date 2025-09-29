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

interface TaxResult {
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  totalCost: number;
  totalSale: number;
  fees: number;
  capitalGains: number;
  holdingDays: number;
  isLongTerm: boolean;
  taxRate: number;
  taxOwed: number;
  netProfit: number;
  effectiveRate: number;
  scenarios: {
    current: {
      type: string;
      taxRate: number;
      taxOwed: number;
      netProfit: number;
    };
    shortTerm: {
      type: string;
      taxRate: number;
      taxOwed: number;
      netProfit: number;
    };
    savings: number;
  };
}

export default function TaxCalculator() {
  const { toast } = useToast();
  const [inputs, setInputs] = useState({
    assetType: 'cryptocurrency',
    symbol: 'BTC',
    quantity: '',
    purchasePrice: '',
    salePrice: '',
    purchaseDate: '',
    saleDate: '',
    fees: '0',
    region: 'US',
    taxBracket: '50000',
  });
  
  const [result, setResult] = useState<TaxResult | null>(null);

  const calculateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/calculators/tax', data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast({
        title: 'Tax Calculation Error',
        description: error instanceof Error ? error.message : 'Failed to calculate tax liability',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    const data = {
      assetType: inputs.assetType,
      symbol: inputs.symbol,
      quantity: parseFloat(inputs.quantity),
      purchasePrice: parseFloat(inputs.purchasePrice),
      salePrice: parseFloat(inputs.salePrice),
      purchaseDate: inputs.purchaseDate,
      saleDate: inputs.saleDate || undefined,
      fees: parseFloat(inputs.fees),
      region: inputs.region,
      taxBracket: parseFloat(inputs.taxBracket),
    };

    calculateMutation.mutate(data);
  };

  const calculateHoldingPeriod = () => {
    if (inputs.purchaseDate && inputs.saleDate) {
      const purchase = new Date(inputs.purchaseDate);
      const sale = new Date(inputs.saleDate);
      const diffTime = Math.abs(sale.getTime() - purchase.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} days`;
    }
    return '';
  };

  const isFormValid = inputs.quantity && inputs.purchasePrice && inputs.salePrice && inputs.purchaseDate;

  const taxBrackets = [
    { value: '10275', label: '10% ($0 - $10,275)' },
    { value: '41775', label: '12% ($10,275 - $41,775)' },
    { value: '89450', label: '22% ($41,775 - $89,450)' },
    { value: '190750', label: '24% ($89,450 - $190,750)' },
    { value: '364200', label: '32% ($190,750 - $364,200)' },
    { value: '462500', label: '35% ($364,200 - $462,500)' },
  ];

  return (
    <div className="space-y-6">
      {/* Tax Calculator Header */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tax & Investment Calculator</h1>
            <p className="text-muted-foreground mt-1">Calculate capital gains, tax liability, and investment scenarios</p>
          </div>
          <div className="flex space-x-2">
            <Select value={inputs.region} onValueChange={(value) => handleInputChange('region', value)}>
              <SelectTrigger className="calculator-input w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tax Input Panel */}
        <div className="xl:col-span-2 space-y-6">
          {/* Asset Details */}
          <Card className="glass-panel rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="asset-type" className="text-sm font-medium text-foreground mb-2 block">
                  Asset Type
                </Label>
                <Select value={inputs.assetType} onValueChange={(value) => handleInputChange('assetType', value)}>
                  <SelectTrigger className="calculator-input" id="asset-type" data-testid="tax-asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cryptocurrency">Cryptocurrency</SelectItem>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                    <SelectItem value="commodity">Commodity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="symbol" className="text-sm font-medium text-foreground mb-2 block">
                  Asset Symbol/Name
                </Label>
                <Select value={inputs.symbol} onValueChange={(value) => handleInputChange('symbol', value)}>
                  <SelectTrigger className="calculator-input" id="symbol" data-testid="tax-symbol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                    <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                    <SelectItem value="AAPL">Apple (AAPL)</SelectItem>
                    <SelectItem value="TSLA">Tesla (TSLA)</SelectItem>
                    <SelectItem value="CUSTOM">Custom Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card className="glass-panel rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    data-testid="tax-purchase-date"
                  />
                </div>
                <div>
                  <Label htmlFor="sale-date" className="text-sm font-medium text-foreground mb-2 block">
                    Sale Date
                  </Label>
                  <Input
                    id="sale-date"
                    type="date"
                    value={inputs.saleDate}
                    onChange={(e) => handleInputChange('saleDate', e.target.value)}
                    className="calculator-input"
                    data-testid="tax-sale-date"
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
                    value={calculateHoldingPeriod()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity" className="text-sm font-medium text-foreground mb-2 block">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="0.5"
                    value={inputs.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    className="calculator-input"
                    data-testid="tax-quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="cost-basis" className="text-sm font-medium text-foreground mb-2 block">
                    Cost Basis per Unit
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="cost-basis"
                      type="number"
                      placeholder="35,000"
                      value={inputs.purchasePrice}
                      onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                      className="calculator-input pl-8"
                      data-testid="tax-purchase-price"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale-price" className="text-sm font-medium text-foreground mb-2 block">
                    Sale Price per Unit
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="sale-price"
                      type="number"
                      placeholder="43,247"
                      value={inputs.salePrice}
                      onChange={(e) => handleInputChange('salePrice', e.target.value)}
                      className="calculator-input pl-8"
                      data-testid="tax-sale-price"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fees" className="text-sm font-medium text-foreground mb-2 block">
                    Transaction Fees
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="fees"
                      type="number"
                      placeholder="25"
                      value={inputs.fees}
                      onChange={(e) => handleInputChange('fees', e.target.value)}
                      className="calculator-input pl-8"
                      data-testid="tax-fees"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Settings */}
          <Card className="glass-panel rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Tax Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tax-bracket" className="text-sm font-medium text-foreground mb-2 block">
                  Income Tax Bracket
                </Label>
                <Select value={inputs.taxBracket} onValueChange={(value) => handleInputChange('taxBracket', value)}>
                  <SelectTrigger className="calculator-input" id="tax-bracket" data-testid="tax-bracket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxBrackets.map((bracket) => (
                      <SelectItem key={bracket.value} value={bracket.value}>
                        {bracket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">
                  Short-term Capital Gains
                </Label>
                <Input
                  type="text"
                  placeholder="Based on income bracket"
                  className="calculator-input"
                  readOnly
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">
                  Long-term Capital Gains
                </Label>
                <Input
                  type="text"
                  placeholder="0%, 15%, or 20%"
                  className="calculator-input"
                  readOnly
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleCalculate}
            disabled={!isFormValid || calculateMutation.isPending}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-lg font-medium neon-glow transition-all"
            data-testid="tax-calculate"
          >
            <i className="fas fa-calculator mr-2"></i>
            {calculateMutation.isPending ? 'Calculating...' : 'Calculate Tax Liability'}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* Tax Summary */}
          <Card className="glass-panel rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Tax Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="text-center p-4 glass-panel rounded-lg neon-glow">
                    <div className="text-2xl font-bold text-foreground">{formatPrice(result.capitalGains)}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Capital Gains</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 glass-panel rounded-lg">
                      <div className="text-lg font-bold text-red-400">{formatPrice(result.taxOwed)}</div>
                      <div className="text-xs text-muted-foreground">Tax Owed</div>
                    </div>
                    <div className="text-center p-3 glass-panel rounded-lg">
                      <div className="text-lg font-bold text-green-400">{formatPrice(result.netProfit)}</div>
                      <div className="text-xs text-muted-foreground">Net Profit</div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Purchase Price:</span>
                      <span className="text-foreground">{formatPrice(result.totalCost)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Sale Price:</span>
                      <span className="text-foreground">{formatPrice(result.totalSale)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Transaction Fees:</span>
                      <span className="text-red-400">-{formatPrice(result.fees)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Holding Period:</span>
                      <span className={`${result.isLongTerm ? 'text-primary' : 'text-accent'}`}>
                        {result.holdingDays} days ({result.isLongTerm ? 'Long-term' : 'Short-term'})
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Tax Rate:</span>
                      <span className="text-foreground">{result.taxRate}%</span>
                    </div>
                    <div className="flex justify-between py-2 font-medium">
                      <span className="text-foreground">After-Tax Profit:</span>
                      <span className="text-green-400">{formatPrice(result.netProfit)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-percentage text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">
                    Enter transaction details to calculate tax liability
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenario Comparison */}
          {result && (
            <Card className="glass-panel rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Scenario Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 glass-panel rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Current Scenario ({result.scenarios.current.type})</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Profit:</span>
                      <span className="text-green-400">{formatPrice(result.scenarios.current.netProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Rate:</span>
                      <span className="text-foreground">{result.scenarios.current.taxRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 glass-panel rounded-lg opacity-75">
                  <h4 className="font-medium text-foreground mb-2">If Short-term ({result.scenarios.shortTerm.type})</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Profit:</span>
                      <span className="text-red-400">{formatPrice(result.scenarios.shortTerm.netProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Rate:</span>
                      <span className="text-foreground">{result.scenarios.shortTerm.taxRate}%</span>
                    </div>
                  </div>
                  {result.scenarios.savings > 0 && (
                    <div className="mt-2 text-xs text-green-400">
                      Saved {formatPrice(result.scenarios.savings)} by holding long-term
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="glass-panel rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button className="w-full text-left p-3 glass-panel rounded-lg hover:bg-accent/10 transition-all">
                <i className="fas fa-download mr-2 text-primary"></i>
                <span className="text-sm">Export Tax Report</span>
              </button>
              <button className="w-full text-left p-3 glass-panel rounded-lg hover:bg-accent/10 transition-all">
                <i className="fas fa-save mr-2 text-primary"></i>
                <span className="text-sm">Save Calculation</span>
              </button>
              <button 
                onClick={() => {
                  const shareUrl = `${window.location.origin}${window.location.pathname}#tax-results`;
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    toast({
                      title: 'Link Copied!',
                      description: 'Tax calculation results link has been copied to your clipboard.',
                    });
                  }).catch(() => {
                    toast({
                      title: 'Share Results',
                      description: 'Copy this link to share your results: ' + shareUrl,
                      variant: 'default',
                    });
                  });
                }}
                className="w-full text-left p-3 glass-panel rounded-lg hover:bg-accent/10 transition-all"
                data-testid="tax-share-results"
              >
                <i className="fas fa-share mr-2 text-primary"></i>
                <span className="text-sm">Share Results</span>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tax Tool Features */}
      <div className="glass-panel rounded-xl p-6 border border-primary/30">
        <div className="space-y-3">
          <h3 className="font-semibold text-primary flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            Advanced Tax Analysis
          </h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Comprehensive tax calculations with real-time data integration.</strong></p>
            <p>Our advanced algorithms analyze multiple tax scenarios to help you optimize your financial strategy. 
               Results are based on current tax brackets and include sophisticated modeling for various income types.</p>
            <p><strong>Features include:</strong> Multi-jurisdiction support, real-time rate updates, and detailed breakdown analysis 
               for informed financial planning.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
