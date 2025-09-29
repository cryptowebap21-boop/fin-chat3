import { calculateHoldingPeriod, isLongTermHolding, calculateTaxRate } from '../utils/formatters.js';
import { type CalculatorInput, type TaxCalculation } from '@shared/schema';

export class CalculatorService {
  
  calculateROI(inputs: Record<string, number>): any {
    const { initialInvestment, currentValue, purchaseDate } = inputs;
    
    if (!initialInvestment || !currentValue) {
      throw new Error('Initial investment and current value are required');
    }
    
    const absoluteGain = currentValue - initialInvestment;
    const percentageGain = (absoluteGain / initialInvestment) * 100;
    
    let annualizedReturn = 0;
    let holdingPeriod = 0;
    
    if (purchaseDate) {
      holdingPeriod = calculateHoldingPeriod(new Date(purchaseDate).toISOString());
      if (holdingPeriod > 0) {
        const years = holdingPeriod / 365;
        annualizedReturn = (Math.pow(currentValue / initialInvestment, 1 / years) - 1) * 100;
      }
    }
    
    return {
      initialInvestment,
      currentValue,
      absoluteGain,
      percentageGain,
      annualizedReturn,
      holdingPeriod,
      isProfit: absoluteGain > 0
    };
  }
  
  calculateProfitLoss(inputs: Record<string, number>): any {
    const { entryPrice, exitPrice, quantity, fees = 0, positionType = 1 } = inputs; // 1 = long, -1 = short
    
    if (!entryPrice || !exitPrice || !quantity) {
      throw new Error('Entry price, exit price, and quantity are required');
    }
    
    const direction = positionType >= 0 ? 1 : -1;
    const grossPnL = direction * (exitPrice - entryPrice) * quantity;
    const totalFees = fees * 2; // Entry + exit fees
    const netPnL = grossPnL - totalFees;
    const roi = (netPnL / (entryPrice * quantity)) * 100;
    
    return {
      entryPrice,
      exitPrice,
      quantity,
      grossPnL,
      totalFees,
      netPnL,
      roi,
      positionType: direction > 0 ? 'Long' : 'Short',
      isProfit: netPnL > 0
    };
  }
  
  calculateCompoundInterest(inputs: Record<string, any>): any {
    const { 
      principal, 
      annualRate, 
      timePeriod, 
      timeUnit = 'years', 
      compoundFrequency = 12, 
      monthlyContribution = 0 
    } = inputs;
    
    if (!principal || !annualRate || !timePeriod) {
      throw new Error('Principal, annual rate, and time period are required');
    }
    
    const rate = annualRate / 100;
    const years = timeUnit === 'years' ? timePeriod : timePeriod / 12;
    const periodsPerYear = compoundFrequency;
    const totalPeriods = years * periodsPerYear;
    
    // Compound interest formula with regular contributions
    const futureValue = principal * Math.pow(1 + rate / periodsPerYear, totalPeriods) +
      monthlyContribution * (Math.pow(1 + rate / periodsPerYear, totalPeriods) - 1) / (rate / periodsPerYear);
    
    const totalContributions = principal + (monthlyContribution * 12 * years);
    const interestEarned = futureValue - totalContributions;
    
    // Year-by-year breakdown
    const yearlyBreakdown = [];
    for (let year = 1; year <= Math.min(years, 10); year++) {
      const periods = year * periodsPerYear;
      const yearValue = principal * Math.pow(1 + rate / periodsPerYear, periods) +
        monthlyContribution * (Math.pow(1 + rate / periodsPerYear, periods) - 1) / (rate / periodsPerYear);
      
      yearlyBreakdown.push({
        year,
        value: Math.round(yearValue * 100) / 100,
        contributions: principal + (monthlyContribution * 12 * year),
        interest: yearValue - (principal + (monthlyContribution * 12 * year))
      });
    }
    
    return {
      principal,
      annualRate,
      years,
      monthlyContribution,
      compoundFrequency,
      futureValue: Math.round(futureValue * 100) / 100,
      totalContributions,
      interestEarned: Math.round(interestEarned * 100) / 100,
      effectiveRate: ((futureValue / totalContributions - 1) * 100),
      yearlyBreakdown
    };
  }
  
  convertCurrency(inputs: Record<string, any>, marketPrices: Record<string, number>): any {
    const { fromCurrency, toCurrency, amount } = inputs;
    
    if (!fromCurrency || !toCurrency || !amount) {
      throw new Error('From currency, to currency, and amount are required');
    }
    
    let fromRate = 1;
    let toRate = 1;
    
    // Get rates from market prices (assuming USD as base)
    if (fromCurrency !== 'USD' && marketPrices[fromCurrency]) {
      fromRate = marketPrices[fromCurrency];
    }
    
    if (toCurrency !== 'USD' && marketPrices[toCurrency]) {
      toRate = marketPrices[toCurrency];
    }
    
    // Convert via USD
    const usdAmount = fromCurrency === 'USD' ? amount : amount * fromRate;
    const convertedAmount = toCurrency === 'USD' ? usdAmount : usdAmount / toRate;
    
    const exchangeRate = convertedAmount / amount;
    
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: Math.round(convertedAmount * 100000) / 100000,
      exchangeRate: Math.round(exchangeRate * 100000) / 100000,
      rates: {
        [fromCurrency]: fromRate,
        [toCurrency]: toRate
      }
    };
  }
  
  calculateTax(calculation: TaxCalculation): any {
    const {
      quantity,
      purchasePrice,
      salePrice,
      purchaseDate,
      saleDate,
      fees = 0,
      region = 'US',
      taxBracket
    } = calculation;
    
    if (!quantity || !purchasePrice || !salePrice || !purchaseDate) {
      throw new Error('Quantity, purchase price, sale price, and purchase date are required');
    }
    
    const totalCost = quantity * purchasePrice + fees;
    const totalSale = quantity * salePrice - fees;
    const capitalGains = totalSale - totalCost;
    
    const holdingDays = saleDate 
      ? calculateHoldingPeriod(purchaseDate, saleDate)
      : 0;
    
    const isLongTerm = isLongTermHolding(holdingDays);
    
    // Calculate tax rate based on holding period and income
    const taxRate = calculateTaxRate(taxBracket, isLongTerm, region);
    const taxOwed = Math.max(0, capitalGains * (taxRate / 100));
    const netProfit = capitalGains - taxOwed;
    const effectiveRate = capitalGains > 0 ? (taxOwed / capitalGains) * 100 : 0;
    
    // Scenario comparison
    const shortTermTaxRate = calculateTaxRate(taxBracket, false, region);
    const shortTermTax = Math.max(0, capitalGains * (shortTermTaxRate / 100));
    const shortTermNet = capitalGains - shortTermTax;
    const taxSavings = shortTermTax - taxOwed;
    
    return {
      purchasePrice,
      salePrice,
      quantity,
      totalCost,
      totalSale,
      fees,
      capitalGains,
      holdingDays,
      isLongTerm,
      taxRate,
      taxOwed: Math.round(taxOwed * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      scenarios: {
        current: {
          type: isLongTerm ? 'Long-term' : 'Short-term',
          taxRate,
          taxOwed: Math.round(taxOwed * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100
        },
        shortTerm: {
          type: 'Short-term',
          taxRate: shortTermTaxRate,
          taxOwed: Math.round(shortTermTax * 100) / 100,
          netProfit: Math.round(shortTermNet * 100) / 100
        },
        savings: Math.round(taxSavings * 100) / 100
      }
    };
  }
  
  getServiceHealth() {
    return {
      supportedCalculations: ['roi', 'pl', 'compound', 'conversion', 'tax'],
      regions: ['US', 'UK', 'CA', 'AU'],
      currencies: ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'SOL', 'ADA']
    };
  }
}
