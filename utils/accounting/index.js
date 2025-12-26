import accounting from 'accounting';
export const formatCurrency = (amount, symbol = '$', precision = 2) => {
    return accounting.formatMoney(amount, symbol, precision, ' ', '.');
};
//# sourceMappingURL=index.js.map