/**
 * TradePulse Financial Precision Utilities
 * Safe monetary arithmetic using integer cents / paisa.
 */

function toPaisa(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    return Math.round(amount * 100);
}

function fromPaisa(paisa) {
    if (typeof paisa !== 'number' || isNaN(paisa)) return 0;
    return Number((paisa / 100).toFixed(2));
}

function roundMoney(amount) {
    return fromPaisa(toPaisa(amount));
}

function calcValue(quantity, price) {
    const qtyInt = Math.floor(quantity || 0);
    const pricePaisa = toPaisa(price || 0);
    return fromPaisa(qtyInt * pricePaisa);
}

function calcAvgCost(oldQty, oldAvg, newQty, fillPrice) {
    const totalQty = (oldQty || 0) + (newQty || 0);
    if (totalQty <= 0) return 0;

    const oldTotalPaisa = (oldQty || 0) * toPaisa(oldAvg || 0);
    const newTotalPaisa = (newQty || 0) * toPaisa(fillPrice || 0);
    const avgPaisa = Math.round((oldTotalPaisa + newTotalPaisa) / totalQty);

    return fromPaisa(avgPaisa);
}

function calcRealizedPnL(soldQty, sellPrice, avgCost) {
    const qtyInt = Math.floor(soldQty || 0);
    const diffPaisa = toPaisa(sellPrice || 0) - toPaisa(avgCost || 0);
    return fromPaisa(qtyInt * diffPaisa);
}

function calcUnrealizedPnL(qty, currentPrice, avgCost) {
    const qtyInt = Math.floor(qty || 0);
    const diffPaisa = toPaisa(currentPrice || 0) - toPaisa(avgCost || 0);
    return fromPaisa(qtyInt * diffPaisa);
}

module.exports = {
    toPaisa,
    fromPaisa,
    roundMoney,
    calcValue,
    calcAvgCost,
    calcRealizedPnL,
    calcUnrealizedPnL
};
