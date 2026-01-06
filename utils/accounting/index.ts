import accounting from 'accounting';

export const formatCurrency = (amount: number, symbol = '$', precision = 4) => {
  return accounting.formatMoney(amount, symbol, precision, ' ', '.');
};
