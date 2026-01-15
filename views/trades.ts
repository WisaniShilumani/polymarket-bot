import { Side } from '@polymarket/clob-client';
import { formatDistanceToNow, format } from 'date-fns';
import type { TradesReportSummary, TradeReport, MarketStats, OutcomeStats, PriceRangeStats, PriceRangeStatsByOutcome } from '../services/reporting/trades';

export function generateTradesHTML(report: TradesReportSummary): string {
  const formatPriceCents = (price: number) => Math.round(price * 100);
  const formatMoney = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
  };
  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  const renderSummaryCard = (label: string, value: string, color: string, icon: string) => `
    <div class="summary-card">
      <div class="summary-icon" style="background: ${color}15; color: ${color};">${icon}</div>
      <div class="summary-content">
        <div class="summary-label">${label}</div>
        <div class="summary-value" style="color: ${color};">${value}</div>
      </div>
    </div>
  `;

  const renderTradeRow = (trade: TradeReport) => {
    const imageHtml = trade.image
      ? `<img src="${trade.image}" alt="${trade.question}" class="trade-image" />`
      : '<div class="trade-image-placeholder">📊</div>';

    const outcomeColor = trade.outcome === 'Yes' ? '#10b981' : '#ef4444';
    const sideColor = trade.side === Side.BUY ? '#3b82f6' : '#f97316';
    const pnlColor = trade.pnl >= 0 ? '#10b981' : '#ef4444';
    const pnlBgColor = trade.pnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    const marketUrl = trade.marketSlug ? `https://polymarket.com/event/${trade.marketSlug}` : '#';

    return `
      <tr class="trade-row">
        <td class="trade-cell">
          <div class="trade-info">
            ${imageHtml}
            <div class="trade-details">
              <a href="${marketUrl}" target="_blank" class="trade-question">${trade.question}</a>
              <div class="trade-meta">
                <span class="trade-badge" style="background: ${sideColor}15; color: ${sideColor};">
                  ${trade.side === Side.BUY ? '+ Bought' : '- Sold'}
                </span>
                <span class="trade-badge" style="background: ${outcomeColor}15; color: ${outcomeColor};">
                  ${trade.outcome}
                </span>
              </div>
            </div>
          </div>
        </td>
        <td class="trade-cell trade-cell-right">
          <div class="trade-shares">${trade.shares.toFixed(2)}</div>
          <div class="trade-shares-label">shares</div>
        </td>
        <td class="trade-cell trade-cell-right">
          <div class="trade-price">${formatPriceCents(trade.orderPrice)}¢</div>
          <div class="trade-price-label">${trade.side === Side.SELL ? 'sold at' : 'bought at'}</div>
        </td>
        ${
          trade.side === Side.SELL && trade.matchedPrice > 0
            ? `
        <td class="trade-cell trade-cell-right">
          <div class="trade-price">${formatPriceCents(trade.matchedPrice)}¢</div>
          <div class="trade-price-label">cost basis</div>
        </td>
        `
            : `
        <td class="trade-cell trade-cell-right">
          <div class="trade-price">-</div>
          <div class="trade-price-label">cost basis</div>
        </td>
        `
        }
        ${
          trade.side === Side.SELL && trade.matchedPrice > 0
            ? `
        <td class="trade-cell trade-cell-right">
          <div class="trade-pnl" style="background: ${pnlBgColor}; color: ${pnlColor};">
            <div class="trade-pnl-amount">${formatMoney(trade.pnl)}</div>
            <div class="trade-pnl-percent">${formatPercent(trade.percentPnL)}</div>
          </div>
        </td>
        `
            : `
        <td class="trade-cell trade-cell-right">
          <div class="trade-pnl" style="background: var(--bg-tertiary); color: var(--text-muted);">
            <div class="trade-pnl-amount">-</div>
          </div>
        </td>
        `
        }
        <td class="trade-cell trade-cell-right">
          <div class="trade-time">${formatDistanceToNow(new Date(trade.executedAt), { addSuffix: true })}</div>
          <div class="trade-date">${format(new Date(trade.executedAt), 'MMM d, yyyy')}</div>
        </td>
      </tr>
    `;
  };

  const renderMarketStats = (winners: MarketStats[], losers: MarketStats[], formatMoneyFn: (n: number) => string) => {
    const renderMarketItem = (market: MarketStats, isWinner: boolean) => {
      const imageHtml = market.image
        ? `<img src="${market.image}" alt="${market.question}" class="stats-item-image" />`
        : `<div class="stats-item-placeholder">${isWinner ? '🏆' : '📉'}</div>`;

      const marketUrl = market.marketSlug ? `https://polymarket.com/event/${market.marketSlug}` : '#';
      const pnlClass = market.totalPnL >= 0 ? 'positive' : 'negative';

      return `
        <div class="stats-item">
          ${imageHtml}
          <div class="stats-item-info">
            <a href="${marketUrl}" target="_blank" class="stats-item-question">${market.question}</a>
            <div class="stats-item-meta">${market.tradeCount} trade${market.tradeCount !== 1 ? 's' : ''} · ${market.winCount}W / ${market.lossCount}L</div>
          </div>
          <div class="stats-item-pnl ${pnlClass}">${formatMoneyFn(market.totalPnL)}</div>
        </div>
      `;
    };

    if (winners.length === 0 && losers.length === 0) {
      return '';
    }

    return `
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-header">
            <span class="stats-card-icon">🏆</span>
            <span class="stats-card-title winners">Top Winners by Market</span>
          </div>
          <div class="stats-list">
            ${winners.length > 0 ? winners.map((m) => renderMarketItem(m, true)).join('') : '<div class="stats-empty">No winning markets yet</div>'}
          </div>
        </div>
        
        <div class="stats-card">
          <div class="stats-card-header">
            <span class="stats-card-icon">📉</span>
            <span class="stats-card-title losers">Top Losers by Market</span>
          </div>
          <div class="stats-list">
            ${losers.length > 0 ? losers.map((m) => renderMarketItem(m, false)).join('') : '<div class="stats-empty">No losing markets yet</div>'}
          </div>
        </div>
      </div>
    `;
  };

  const renderOutcomeStats = (outcomes: OutcomeStats[], formatMoneyFn: (n: number) => string) => {
    if (outcomes.every((o) => o.tradeCount === 0)) {
      return '';
    }

    const renderOutcomeCard = (stats: OutcomeStats) => {
      const isYes = stats.outcome === 'Yes';
      const pnlColor = stats.totalPnL >= 0 ? '#10b981' : '#ef4444';

      return `
        <div class="outcome-card">
          <div class="outcome-header">
            <div class="outcome-badge ${isYes ? 'yes' : 'no'}">
              <span>${isYes ? '✓' : '✗'}</span>
              <span>${stats.outcome} Trades</span>
            </div>
            <div class="outcome-pnl" style="color: ${pnlColor};">${formatMoneyFn(stats.totalPnL)}</div>
          </div>
          <div class="outcome-stats-row">
            <div class="outcome-stat">
              <div class="outcome-stat-label">Trades</div>
              <div class="outcome-stat-value">${stats.tradeCount}</div>
            </div>
            <div class="outcome-stat">
              <div class="outcome-stat-label">Win Rate</div>
              <div class="outcome-stat-value">${stats.winRate.toFixed(1)}%</div>
            </div>
            <div class="outcome-stat">
              <div class="outcome-stat-label">Avg P&L</div>
              <div class="outcome-stat-value" style="color: ${stats.avgPnL >= 0 ? '#10b981' : '#ef4444'};">${formatMoneyFn(stats.avgPnL)}</div>
            </div>
            <div class="outcome-stat">
              <div class="outcome-stat-label">W / L</div>
              <div class="outcome-stat-value">${stats.winCount} / ${stats.lossCount}</div>
            </div>
          </div>
        </div>
      `;
    };

    return `
      <div class="outcome-grid">
        ${outcomes.map(renderOutcomeCard).join('')}
      </div>
    `;
  };

  const renderPriceRangeStats = (priceRangesByOutcome: PriceRangeStatsByOutcome, formatMoneyFn: (n: number) => string) => {
    if (priceRangesByOutcome.yes.length === 0 && priceRangesByOutcome.no.length === 0) {
      return '';
    }

    const getBarColor = (winRate: number) => {
      if (winRate >= 60) return 'linear-gradient(90deg, #10b981, #059669)';
      if (winRate >= 40) return 'linear-gradient(90deg, #f59e0b, #d97706)';
      return 'linear-gradient(90deg, #ef4444, #dc2626)';
    };

    const renderPriceRangeItem = (range: PriceRangeStats) => {
      const barWidth = (range.winRate / 100) * 100;
      const pnlColor = range.totalPnL >= 0 ? '#10b981' : '#ef4444';

      return `
        <div class="price-range-item">
          <div class="price-range-label">${range.rangeLabel}</div>
          <div class="price-range-bar-container">
            <div class="price-range-bar" style="width: ${barWidth}%; background: ${getBarColor(range.winRate)};">
              ${barWidth >= 15 ? `<span class="price-range-bar-value">${range.winRate.toFixed(0)}%</span>` : ''}
            </div>
          </div>
          <div class="price-range-stats">
            <div class="price-range-stat">
              <div class="price-range-stat-value">${range.tradeCount}</div>
              <div class="price-range-stat-label">Trades</div>
            </div>
            <div class="price-range-stat">
              <div class="price-range-stat-value">${range.winCount}/${range.lossCount}</div>
              <div class="price-range-stat-label">W/L</div>
            </div>
            <div class="price-range-stat">
              <div class="price-range-stat-value" style="color: ${pnlColor};">${formatMoneyFn(range.totalPnL)}</div>
              <div class="price-range-stat-label">P&L</div>
            </div>
          </div>
        </div>
      `;
    };

    const renderOutcomeSection = (ranges: PriceRangeStats[], outcome: 'Yes' | 'No') => {
      if (ranges.length === 0) {
        return `<div class="price-range-empty">No ${outcome} trades in any price range</div>`;
      }
      return `<div class="price-range-list">${ranges.map(renderPriceRangeItem).join('')}</div>`;
    };

    return `
      <div class="price-range-section">
        <div class="price-range-header">
          <div class="price-range-title">
            <span>🎯</span>
            <span>Win Rate by Entry Price</span>
          </div>
        </div>
        <div class="price-range-outcome-grid">
          <div class="price-range-outcome-card">
            <div class="price-range-outcome-header yes">
              <span>✓</span>
              <span>Yes Bets</span>
            </div>
            ${renderOutcomeSection(priceRangesByOutcome.yes, 'Yes')}
          </div>
          <div class="price-range-outcome-card">
            <div class="price-range-outcome-header no">
              <span>✗</span>
              <span>No Bets</span>
            </div>
            ${renderOutcomeSection(priceRangesByOutcome.no, 'No')}
          </div>
        </div>
      </div>
    `;
  };

  const totalPnLColor = report.totalUnrealizedPnL >= 0 ? '#10b981' : '#ef4444';
  const winRate = report.totalTrades > 0 ? ((report.winningTrades / report.totalTrades) * 100).toFixed(1) : '0';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Trade History | P&L Report</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        :root {
          --bg-primary: #0a0a0f;
          --bg-secondary: #12121a;
          --bg-tertiary: #1a1a24;
          --bg-card: #16161f;
          --border-color: #2a2a3a;
          --text-primary: #f0f0f5;
          --text-secondary: #8888a0;
          --text-muted: #5a5a70;
          --accent-green: #10b981;
          --accent-red: #ef4444;
          --accent-blue: #3b82f6;
          --accent-purple: #8b5cf6;
          --accent-orange: #f97316;
          --accent-cyan: #06b6d4;
        }
        
        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          line-height: 1.5;
        }
        
        /* Gradient background */
        .page-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(ellipse at 20% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
            var(--bg-primary);
          z-index: -1;
        }
        
        .container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 32px 24px;
        }
        
        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }
        
        .header-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .header-title h1 {
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--text-primary), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .header-title .logo {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        
        .header-timestamp {
          color: var(--text-muted);
          font-size: 14px;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Summary Cards */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        
        .summary-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }
        
        .summary-content {
          flex: 1;
          min-width: 0;
        }
        
        .summary-label {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .summary-value {
          font-size: 24px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Chart Section */
        .chart-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 32px;
        }
        
        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        
        .chart-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .chart-legend {
          display: flex;
          gap: 24px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        
        .legend-dot-pnl {
          background: var(--accent-cyan);
        }
        
        .legend-dot-winrate {
          background: var(--accent-purple);
        }
        
        .chart-container {
          position: relative;
          height: 300px;
          width: 100%;
        }
        
        /* Trades Table */
        .trades-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          overflow: hidden;
        }
        
        .trades-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .trades-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .trades-count {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .table-wrapper {
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        thead {
          background: var(--bg-tertiary);
        }
        
        th {
          padding: 14px 20px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          white-space: nowrap;
        }
        
        th:not(:first-child) {
          text-align: right;
        }
        
        .trade-row {
          border-bottom: 1px solid var(--border-color);
          transition: background 0.15s;
        }
        
        .trade-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        
        .trade-row:last-child {
          border-bottom: none;
        }
        
        .trade-cell {
          padding: 16px 20px;
          vertical-align: middle;
        }
        
        .trade-cell-right {
          text-align: right;
        }
        
        .trade-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .trade-image {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          object-fit: cover;
          flex-shrink: 0;
        }
        
        .trade-image-placeholder {
          width: 56px;
          height: 56px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .trade-details {
          min-width: 0;
          flex: 1;
        }
        
        .trade-question {
          font-weight: 500;
          color: var(--text-primary);
          text-decoration: none;
          display: block;
          margin-bottom: 8px;
          line-height: 1.4;
          max-width: 400px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .trade-question:hover {
          color: var(--accent-cyan);
        }
        
        .trade-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .trade-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .trade-shares {
          font-size: 16px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
        }
        
        .trade-shares-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        
        .trade-price {
          font-size: 16px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
        }
        
        .trade-price-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        
        .trade-cost {
          font-size: 15px;
          font-weight: 500;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-secondary);
        }
        
        .trade-pnl {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          padding: 8px 14px;
          border-radius: 10px;
          min-width: 100px;
        }
        
        .trade-pnl-amount {
          font-size: 15px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .trade-pnl-percent {
          font-size: 12px;
          font-weight: 500;
          opacity: 0.8;
        }
        
        .trade-time {
          font-size: 13px;
          color: var(--text-secondary);
        }
        
        .trade-date {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        
        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 40px;
          color: var(--text-muted);
        }
        
        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .empty-state-text {
          font-size: 16px;
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }
        
        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .stats-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          overflow: hidden;
        }
        
        .stats-card-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .stats-card-icon {
          font-size: 24px;
        }
        
        .stats-card-title {
          font-size: 16px;
          font-weight: 600;
        }
        
        .stats-card-title.winners {
          color: var(--accent-green);
        }
        
        .stats-card-title.losers {
          color: var(--accent-red);
        }
        
        .stats-list {
          padding: 8px 0;
        }
        
        .stats-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 24px;
          transition: background 0.15s;
        }
        
        .stats-item:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        
        .stats-item-image {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
        }
        
        .stats-item-placeholder {
          width: 40px;
          height: 40px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .stats-item-info {
          flex: 1;
          min-width: 0;
        }
        
        .stats-item-question {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-decoration: none;
          display: block;
        }
        
        .stats-item-question:hover {
          color: var(--accent-cyan);
        }
        
        .stats-item-meta {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        
        .stats-item-pnl {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          flex-shrink: 0;
        }
        
        .stats-item-pnl.positive {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent-green);
        }
        
        .stats-item-pnl.negative {
          background: rgba(239, 68, 68, 0.15);
          color: var(--accent-red);
        }
        
        .stats-empty {
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        
        /* Outcome Stats */
        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        
        @media (max-width: 768px) {
          .outcome-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .outcome-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .outcome-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .outcome-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 24px;
          font-size: 16px;
          font-weight: 600;
        }
        
        .outcome-badge.yes {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent-green);
        }
        
        .outcome-badge.no {
          background: rgba(239, 68, 68, 0.15);
          color: var(--accent-red);
        }
        
        .outcome-pnl {
          font-family: 'JetBrains Mono', monospace;
          font-size: 24px;
          font-weight: 600;
        }
        
        .outcome-stats-row {
          display: flex;
          gap: 24px;
        }
        
        .outcome-stat {
          flex: 1;
        }
        
        .outcome-stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .outcome-stat-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        /* Price Range Stats */
        .price-range-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 32px;
        }
        
        .price-range-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        
        .price-range-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .price-range-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .price-range-item {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .price-range-label {
          width: 70px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        
        .price-range-bar-container {
          flex: 1;
          height: 32px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          overflow: hidden;
          position: relative;
        }
        
        .price-range-bar {
          height: 100%;
          border-radius: 8px;
          transition: width 0.5s ease-out;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 12px;
        }
        
        .price-range-bar-value {
          font-size: 12px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        .price-range-stats {
          display: flex;
          gap: 16px;
          flex-shrink: 0;
          min-width: 200px;
        }
        
        .price-range-stat {
          text-align: right;
        }
        
        .price-range-stat-value {
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
        }
        
        .price-range-stat-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        
        .price-range-outcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }
        
        .price-range-outcome-card {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
        }
        
        .price-range-outcome-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .price-range-outcome-header.yes {
          color: var(--accent-green);
        }
        
        .price-range-outcome-header.no {
          color: var(--accent-red);
        }
        
        .price-range-empty {
          padding: 24px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        
        @media (max-width: 1024px) {
          .price-range-outcome-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .price-range-item {
            flex-wrap: wrap;
          }
          
          .price-range-stats {
            width: 100%;
            justify-content: space-around;
            margin-top: 8px;
          }
        }
        
        /* Footer */
        .footer {
          margin-top: 32px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        
        .footer a {
          color: var(--accent-cyan);
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        /* Responsive */
        @media (max-width: 1200px) {
          .trade-question {
            max-width: 300px;
          }
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 16px;
          }
          
          .header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
          
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .trade-question {
            max-width: 200px;
          }
        }
      </style>
    </head>
    <body>
      <div class="page-bg"></div>
      <div class="container">
        <header class="header">
          <div class="header-title">
            <div class="logo">📈</div>
            <h1>Trade History</h1>
          </div>
          <div class="header-timestamp">
            Last updated: ${format(new Date(), 'MMM d, yyyy HH:mm:ss')}
          </div>
        </header>
        
        <div class="summary-grid">
          ${renderSummaryCard('Total Trades', report.totalTrades.toString(), 'var(--accent-blue)', '📊')}
          ${renderSummaryCard('Total P&L', formatMoney(report.totalUnrealizedPnL), totalPnLColor, report.totalUnrealizedPnL >= 0 ? '📈' : '📉')}
          ${renderSummaryCard('Win Rate', `${winRate}%`, 'var(--accent-purple)', '🎯')}
          ${renderSummaryCard('Winning', report.winningTrades.toString(), 'var(--accent-green)', '✅')}
          ${renderSummaryCard('Losing', report.losingTrades.toString(), 'var(--accent-red)', '❌')}
          ${renderSummaryCard('Total Cost', `$${report.totalCost.toFixed(2)}`, 'var(--accent-orange)', '💰')}
        </div>
        
        ${
          report.chartData.length > 1
            ? `
        <div class="chart-section">
          <div class="chart-header">
            <div class="chart-title">
              <span>📊</span>
              <span>Performance Over Time</span>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <div class="legend-dot legend-dot-pnl"></div>
                <span>Cumulative P&L</span>
              </div>
              <div class="legend-item">
                <div class="legend-dot legend-dot-winrate"></div>
                <span>Win Rate %</span>
              </div>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="performanceChart"></canvas>
          </div>
        </div>
        `
            : ''
        }
        
        ${renderOutcomeStats(report.outcomeStats, formatMoney)}
        
        ${renderPriceRangeStats(report.priceRangeStats, formatMoney)}
        
        ${renderMarketStats(report.topWinnersByMarket, report.topLosersByMarket, formatMoney)}
        
        <div class="trades-section">
          <div class="trades-header">
            <div class="trades-title">
              <span>Trade Log</span>
              <span class="trades-count">${report.totalTrades} trades</span>
            </div>
          </div>
          
          ${
            report.trades.length === 0
              ? `
              <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No trades found</div>
              </div>
            `
              : `
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Shares</th>
                      <th>Price</th>
                      <th>Cost Basis</th>
                      <th>P&L</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${report.trades.map(renderTradeRow).join('')}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>
        
        <footer class="footer">
          <p>Powered by <a href="https://polymarket.com" target="_blank">Polymarket</a> CLOB API</p>
        </footer>
      </div>
      
      ${
        report.chartData.length > 1
          ? `
      <script>
        const chartData = ${JSON.stringify(report.chartData)};
        
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        const labels = chartData.map((d, i) => {
          const date = new Date(d.date);
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const day = date.getDate();
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return month + ' ' + day + ' ' + hours + ':' + minutes;
        });
        
        const pnlData = chartData.map(d => d.cumulativePnL);
        const winRateData = chartData.map(d => d.winRate);
        
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Cumulative P&L ($)',
                data: pnlData,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#0a0a0f',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                yAxisID: 'y',
              },
              {
                label: 'Win Rate (%)',
                data: winRateData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: false,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#0a0a0f',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                borderDash: [5, 5],
                yAxisID: 'y1',
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: '#1a1a24',
                titleColor: '#f0f0f5',
                bodyColor: '#8888a0',
                borderColor: '#2a2a3a',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                titleFont: {
                  family: "'Outfit', sans-serif",
                  size: 13,
                  weight: '600'
                },
                bodyFont: {
                  family: "'JetBrains Mono', monospace",
                  size: 12
                },
                callbacks: {
                  label: function(context) {
                    if (context.datasetIndex === 0) {
                      const value = context.parsed.y;
                      const sign = value >= 0 ? '+' : '';
                      return 'P&L: ' + sign + '$' + value.toFixed(2);
                    } else {
                      return 'Win Rate: ' + context.parsed.y.toFixed(1) + '%';
                    }
                  },
                  afterBody: function(tooltipItems) {
                    const index = tooltipItems[0].dataIndex;
                    return 'Trade #' + chartData[index].tradeCount;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  color: 'rgba(42, 42, 58, 0.5)',
                  drawBorder: false,
                },
                ticks: {
                  color: '#5a5a70',
                  font: {
                    family: "'JetBrains Mono', monospace",
                    size: 11
                  },
                  maxRotation: 45,
                  minRotation: 0,
                }
              },
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: {
                  color: 'rgba(42, 42, 58, 0.5)',
                  drawBorder: false,
                },
                ticks: {
                  color: '#06b6d4',
                  font: {
                    family: "'JetBrains Mono', monospace",
                    size: 11
                  },
                  callback: function(value) {
                    const sign = value >= 0 ? '+' : '';
                    return sign + '$' + value.toFixed(0);
                  }
                },
                title: {
                  display: true,
                  text: 'Cumulative P&L',
                  color: '#06b6d4',
                  font: {
                    family: "'Outfit', sans-serif",
                    size: 12,
                    weight: '500'
                  }
                }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                min: 0,
                max: 100,
                grid: {
                  drawOnChartArea: false,
                },
                ticks: {
                  color: '#8b5cf6',
                  font: {
                    family: "'JetBrains Mono', monospace",
                    size: 11
                  },
                  callback: function(value) {
                    return value + '%';
                  }
                },
                title: {
                  display: true,
                  text: 'Win Rate',
                  color: '#8b5cf6',
                  font: {
                    family: "'Outfit', sans-serif",
                    size: 12,
                    weight: '500'
                  }
                }
              }
            }
          }
        });
      </script>
      `
          : ''
      }
    </body>
    </html>
  `;
}
