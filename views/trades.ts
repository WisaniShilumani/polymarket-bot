import { Side } from '@polymarket/clob-client';
import { formatDistanceToNow, format } from 'date-fns';
import {
  TIME_FILTER_OPTIONS,
  type TradesReportSummary,
  type TradeReport,
  type MarketStats,
  type OutcomeStats,
  type PriceRangeStats,
  type PriceRangeStatsByOutcome,
  type HoldTimeStats,
  type RiskAdjustedMetrics,
  type DrawdownStats,
  type StreakStats,
  type TemporalPerformance,
  type TradeSizeAnalysis,
  type ConsecutiveAnalysis,
  type VolumeCorrelation,
} from '../services/reporting/trades';

export function generateTradesHTML(report: TradesReportSummary & { selectedFilter: string }): string {
  const formatPriceCents = (price: number) => Math.round(price * 100);
  const formatMoney = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${amount.toFixed(2)}`;
  };
  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };
  const formatRatio = (ratio: number) => {
    if (!isFinite(ratio)) return '∞';
    return ratio.toFixed(2);
  };
  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
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

  const renderMiniCard = (label: string, value: string, color: string = 'var(--text-primary)') => `
    <div class="mini-card">
      <div class="mini-label">${label}</div>
      <div class="mini-value" style="color: ${color};">${value}</div>
    </div>
  `;

  // ============================================================================
  // RISK-ADJUSTED METRICS SECTION
  // ============================================================================
  const renderRiskMetrics = (metrics: RiskAdjustedMetrics, drawdown: DrawdownStats, grossProfit: number, grossLoss: number) => {
    const sharpeColor = metrics.sharpeRatio >= 1 ? '#10b981' : metrics.sharpeRatio >= 0.5 ? '#f59e0b' : '#ef4444';
    const profitFactorColor = metrics.profitFactor >= 1.5 ? '#10b981' : metrics.profitFactor >= 1 ? '#f59e0b' : '#ef4444';
    const expectancyColor = metrics.expectancy >= 0 ? '#10b981' : '#ef4444';

    return `
      <div class="analytics-section">
        <div class="analytics-header">
          <span class="analytics-icon">📊</span>
          <span class="analytics-title">Risk-Adjusted Performance</span>
        </div>
        <div class="metrics-grid">
          <div class="metric-card highlight">
            <div class="metric-icon">⚖️</div>
            <div class="metric-info">
              <div class="metric-label">Sharpe Ratio</div>
              <div class="metric-value" style="color: ${sharpeColor};">${formatRatio(metrics.sharpeRatio)}</div>
              <div class="metric-hint">${metrics.sharpeRatio >= 1 ? 'Excellent' : metrics.sharpeRatio >= 0.5 ? 'Good' : 'Needs work'}</div>
            </div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-icon">🎯</div>
            <div class="metric-info">
              <div class="metric-label">Sortino Ratio</div>
              <div class="metric-value">${formatRatio(metrics.sortinoRatio)}</div>
              <div class="metric-hint">Downside risk adjusted</div>
            </div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-icon">💰</div>
            <div class="metric-info">
              <div class="metric-label">Profit Factor</div>
              <div class="metric-value" style="color: ${profitFactorColor};">${formatRatio(metrics.profitFactor)}</div>
              <div class="metric-hint">${metrics.profitFactor >= 1.5 ? 'Strong edge' : metrics.profitFactor >= 1 ? 'Slight edge' : 'No edge'}</div>
            </div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-icon">📈</div>
            <div class="metric-info">
              <div class="metric-label">Expectancy</div>
              <div class="metric-value" style="color: ${expectancyColor};">${formatMoney(metrics.expectancy)}</div>
              <div class="metric-hint">Expected per trade</div>
            </div>
          </div>
        </div>
        <div class="metrics-row">
          ${renderMiniCard('Payoff Ratio', formatRatio(metrics.payoffRatio), metrics.payoffRatio >= 1 ? '#10b981' : '#ef4444')}
          ${renderMiniCard('Kelly %', `${(metrics.kellyFraction * 100).toFixed(1)}%`, '#8b5cf6')}
          ${renderMiniCard('Calmar Ratio', formatRatio(metrics.calmarRatio))}
          ${renderMiniCard('Return σ', `$${metrics.returnStdDev.toFixed(2)}`)}
          ${renderMiniCard('Downside σ', `$${metrics.downsideDeviation.toFixed(2)}`)}
          ${renderMiniCard('Gross Profit', formatMoney(grossProfit), '#10b981')}
          ${renderMiniCard('Gross Loss', formatMoney(-grossLoss), '#ef4444')}
          ${renderMiniCard('Recovery Factor', formatRatio(drawdown.recoveryFactor))}
        </div>
      </div>
    `;
  };

  // ============================================================================
  // DRAWDOWN SECTION
  // ============================================================================
  const renderDrawdownStats = (stats: DrawdownStats) => {
    const drawdownColor = stats.currentDrawdown > 0 ? '#ef4444' : '#10b981';
    const maxDrawdownPercent = stats.maxDrawdownPercent.toFixed(1);

    return `
      <div class="analytics-section">
        <div class="analytics-header">
          <span class="analytics-icon">📉</span>
          <span class="analytics-title">Drawdown Analysis</span>
          ${stats.isInDrawdown ? '<span class="status-badge warning">In Drawdown</span>' : '<span class="status-badge success">At Peak</span>'}
        </div>
        <div class="drawdown-grid">
          <div class="drawdown-card ${stats.isInDrawdown ? 'warning' : ''}">
            <div class="drawdown-label">Current Drawdown</div>
            <div class="drawdown-value" style="color: ${drawdownColor};">
              ${stats.currentDrawdown > 0 ? '-' : ''}$${stats.currentDrawdown.toFixed(2)}
            </div>
            <div class="drawdown-sub">${stats.currentDrawdownPercent.toFixed(1)}% from peak</div>
          </div>
          <div class="drawdown-card danger">
            <div class="drawdown-label">Max Drawdown</div>
            <div class="drawdown-value" style="color: #ef4444;">
              -$${stats.maxDrawdown.toFixed(2)}
            </div>
            <div class="drawdown-sub">${maxDrawdownPercent}% decline</div>
          </div>
          <div class="drawdown-card">
            <div class="drawdown-label">Max DD Duration</div>
            <div class="drawdown-value">${formatHours(stats.maxDrawdownDuration)}</div>
            <div class="drawdown-sub">Time in drawdown</div>
          </div>
          <div class="drawdown-card">
            <div class="drawdown-label">Drawdown Periods</div>
            <div class="drawdown-value">${stats.drawdownHistory.length}</div>
            <div class="drawdown-sub">Historical drawdowns</div>
          </div>
        </div>
      </div>
    `;
  };

  // ============================================================================
  // HOLD TIME SECTION
  // ============================================================================
  const renderHoldTimeStats = (stats: HoldTimeStats) => {
    const buckets = [
      { key: '0-1h', label: '< 1 hour', ...stats.holdDurationDistribution['0-1h'] },
      { key: '1-6h', label: '1-6 hours', ...stats.holdDurationDistribution['1-6h'] },
      { key: '6-24h', label: '6-24 hours', ...stats.holdDurationDistribution['6-24h'] },
      { key: '1-7d', label: '1-7 days', ...stats.holdDurationDistribution['1-7d'] },
      { key: '7d+', label: '7+ days', ...stats.holdDurationDistribution['7d+'] },
    ].filter((b) => b.count > 0);

    const maxCount = Math.max(...buckets.map((b) => b.count), 1);

    const renderBucket = (bucket: (typeof buckets)[0]) => {
      const barWidth = (bucket.count / maxCount) * 100;
      const pnlColor = bucket.avgPnL >= 0 ? '#10b981' : '#ef4444';
      const winRateColor = bucket.winRate >= 60 ? '#10b981' : bucket.winRate >= 40 ? '#f59e0b' : '#ef4444';

      return `
        <div class="hold-time-row">
          <div class="hold-time-label">${bucket.label}</div>
          <div class="hold-time-bar-container">
            <div class="hold-time-bar" style="width: ${barWidth}%;">
              <span class="hold-time-count">${bucket.count}</span>
            </div>
          </div>
          <div class="hold-time-stats">
            <span class="hold-stat" style="color: ${winRateColor};">${bucket.winRate.toFixed(0)}% win</span>
            <span class="hold-stat" style="color: ${pnlColor};">${formatMoney(bucket.avgPnL)} avg</span>
          </div>
        </div>
      `;
    };

    if (buckets.length === 0) {
      return '';
    }

    return `
      <div class="analytics-section">
        <div class="analytics-header">
          <span class="analytics-icon">⏱️</span>
          <span class="analytics-title">Hold Time Analysis</span>
        </div>
        <div class="hold-time-summary">
          ${renderMiniCard('Avg Hold', formatHours(stats.avgHoldDurationHours), '#3b82f6')}
          ${renderMiniCard('Median Hold', formatHours(stats.medianHoldDurationHours), '#8b5cf6')}
          ${renderMiniCard('Min Hold', formatHours(stats.minHoldDurationHours))}
          ${renderMiniCard('Max Hold', formatHours(stats.maxHoldDurationHours))}
        </div>
        <div class="hold-time-chart">
          ${buckets.map(renderBucket).join('')}
        </div>
      </div>
    `;
  };

  // ============================================================================
  // STREAK STATS SECTION
  // ============================================================================
  const renderStreakStats = (stats: StreakStats) => {
    const streakColor = stats.currentStreakType === 'win' ? '#10b981' : stats.currentStreakType === 'loss' ? '#ef4444' : 'var(--text-muted)';
    const streakIcon = stats.currentStreakType === 'win' ? '🔥' : stats.currentStreakType === 'loss' ? '❄️' : '➖';
    const streakText =
      stats.currentStreakType === 'win'
        ? `${stats.currentStreak} wins`
        : stats.currentStreakType === 'loss'
        ? `${Math.abs(stats.currentStreak)} losses`
        : 'No streak';

    return `
      <div class="analytics-section compact">
        <div class="analytics-header">
          <span class="analytics-icon">🎰</span>
          <span class="analytics-title">Streak Analysis</span>
        </div>
        <div class="streak-grid">
          <div class="streak-card current" style="border-color: ${streakColor};">
            <div class="streak-icon">${streakIcon}</div>
            <div class="streak-info">
              <div class="streak-label">Current Streak</div>
              <div class="streak-value" style="color: ${streakColor};">${streakText}</div>
            </div>
          </div>
          <div class="streak-card">
            <div class="streak-icon">🏆</div>
            <div class="streak-info">
              <div class="streak-label">Best Win Streak</div>
              <div class="streak-value" style="color: #10b981;">${stats.longestWinStreak} wins</div>
            </div>
          </div>
          <div class="streak-card">
            <div class="streak-icon">💀</div>
            <div class="streak-info">
              <div class="streak-label">Worst Loss Streak</div>
              <div class="streak-value" style="color: #ef4444;">${stats.longestLossStreak} losses</div>
            </div>
          </div>
          <div class="streak-card">
            <div class="streak-info">
              <div class="streak-label">Avg Streaks</div>
              <div class="streak-value">
                <span style="color: #10b981;">${stats.avgWinStreak.toFixed(1)}W</span> / 
                <span style="color: #ef4444;">${stats.avgLossStreak.toFixed(1)}L</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ============================================================================
  // TEMPORAL PERFORMANCE (HEATMAPS)
  // ============================================================================
  const renderTemporalPerformance = (temporal: TemporalPerformance) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const getHeatColor = (winRate: number, count: number) => {
      if (count === 0) return 'var(--bg-tertiary)';
      if (winRate >= 70) return 'rgba(16, 185, 129, 0.8)';
      if (winRate >= 55) return 'rgba(16, 185, 129, 0.4)';
      if (winRate >= 45) return 'rgba(245, 158, 11, 0.4)';
      if (winRate >= 30) return 'rgba(239, 68, 68, 0.4)';
      return 'rgba(239, 68, 68, 0.8)';
    };

    const renderHourHeatmap = () => {
      const cells = hours.map((h) => {
        const data = temporal.hourOfDay[h] || { count: 0, winRate: 0, avgPnL: 0 };
        const color = getHeatColor(data.winRate, data.count);
        const tooltip =
          data.count > 0 ? `${h}:00 - ${data.count} trades, ${data.winRate.toFixed(0)}% win, ${formatMoney(data.avgPnL)} avg` : `${h}:00 - No trades`;
        return `<div class="heat-cell" style="background: ${color};" title="${tooltip}">${data.count > 0 ? data.count : ''}</div>`;
      });

      return `
        <div class="heatmap-container">
          <div class="heatmap-title">By Hour of Day</div>
          <div class="hour-labels">
            ${hours
              .filter((h) => h % 3 === 0)
              .map((h) => `<span>${h}</span>`)
              .join('')}
          </div>
          <div class="hour-heatmap">${cells.join('')}</div>
        </div>
      `;
    };

    const renderDayChart = () => {
      const maxCount = Math.max(...days.map((d) => temporal.dayOfWeek[d]?.count || 0), 1);

      return `
        <div class="day-chart-container">
          <div class="heatmap-title">By Day of Week</div>
          <div class="day-bars">
            ${days
              .map((day) => {
                const data = temporal.dayOfWeek[day] || { count: 0, winRate: 0, avgPnL: 0 };
                const height = (data.count / maxCount) * 100;
                const color = getHeatColor(data.winRate, data.count);
                return `
                <div class="day-bar-wrapper">
                  <div class="day-bar" style="height: ${height}%; background: ${color};">
                    ${data.count > 0 ? `<span class="day-count">${data.count}</span>` : ''}
                  </div>
                  <div class="day-label">${day.slice(0, 3)}</div>
                  ${
                    data.count > 0
                      ? `<div class="day-winrate" style="color: ${data.winRate >= 50 ? '#10b981' : '#ef4444'};">${data.winRate.toFixed(0)}%</div>`
                      : ''
                  }
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;
    };

    return `
      <div class="analytics-section">
        <div class="analytics-header">
          <span class="analytics-icon">🕐</span>
          <span class="analytics-title">Temporal Performance</span>
        </div>
        <div class="temporal-grid">
          ${renderHourHeatmap()}
          ${renderDayChart()}
        </div>
        <div class="heatmap-legend">
          <span>Win Rate:</span>
          <div class="legend-scale">
            <div class="legend-item" style="background: rgba(239, 68, 68, 0.8);">< 30%</div>
            <div class="legend-item" style="background: rgba(239, 68, 68, 0.4);">30-45%</div>
            <div class="legend-item" style="background: rgba(245, 158, 11, 0.4);">45-55%</div>
            <div class="legend-item" style="background: rgba(16, 185, 129, 0.4);">55-70%</div>
            <div class="legend-item" style="background: rgba(16, 185, 129, 0.8);">70%+</div>
          </div>
        </div>
      </div>
    `;
  };

  // ============================================================================
  // TRADE SIZE ANALYSIS
  // ============================================================================
  const renderTradeSizeAnalysis = (analysis: TradeSizeAnalysis) => {
    if (analysis.buckets.length === 0) return '';

    const maxPnL = Math.max(...analysis.buckets.map((b) => Math.abs(b.totalPnL)), 1);

    return `
      <div class="analytics-section">
        <div class="analytics-header">
          <span class="analytics-icon">📏</span>
          <span class="analytics-title">Performance by Trade Size</span>
          ${analysis.optimalSizeRange ? `<span class="optimal-badge">Optimal: ${analysis.optimalSizeRange}</span>` : ''}
        </div>
        <div class="size-chart">
          ${analysis.buckets
            .map((bucket) => {
              const pnlColor = bucket.totalPnL >= 0 ? '#10b981' : '#ef4444';
              const barHeight = (Math.abs(bucket.totalPnL) / maxPnL) * 100;
              const isOptimal = bucket.sizeRange === analysis.optimalSizeRange;

              return `
              <div class="size-bar-wrapper ${isOptimal ? 'optimal' : ''}">
                <div class="size-pnl" style="color: ${pnlColor};">${formatMoney(bucket.totalPnL)}</div>
                <div class="size-bar-container">
                  <div class="size-bar ${bucket.totalPnL >= 0 ? 'positive' : 'negative'}" 
                       style="height: ${barHeight}%; background: ${pnlColor};">
                  </div>
                </div>
                <div class="size-label">${bucket.sizeRange}</div>
                <div class="size-meta">
                  <span>${bucket.tradeCount} trades</span>
                  <span style="color: ${bucket.winRate >= 50 ? '#10b981' : '#ef4444'};">${bucket.winRate.toFixed(0)}% win</span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  };

  // ============================================================================
  // TRADING ACTIVITY SECTION
  // ============================================================================
  const renderTradingActivity = (activity: ConsecutiveAnalysis) => {
    return `
      <div class="analytics-section compact">
        <div class="analytics-header">
          <span class="analytics-icon">📅</span>
          <span class="analytics-title">Trading Activity</span>
        </div>
        <div class="activity-grid">
          ${renderMiniCard('Trades/Day', activity.avgTradesPerDay.toFixed(1), '#3b82f6')}
          ${renderMiniCard('Trades/Week', activity.avgTradesPerWeek.toFixed(1), '#8b5cf6')}
          ${renderMiniCard('Active Days', `${activity.tradingDays}/${activity.totalDaysInPeriod}`, '#06b6d4')}
          ${renderMiniCard('Frequency', `${(activity.tradingFrequency * 100).toFixed(0)}%`, '#f59e0b')}
          ${renderMiniCard('Most Active Day', activity.mostActiveDay, '#10b981')}
          ${renderMiniCard('Most Active Hour', `${activity.mostActiveHour}:00`, '#ec4899')}
        </div>
      </div>
    `;
  };

  // ============================================================================
  // VOLUME CORRELATION SECTION
  // ============================================================================
  const renderVolumeCorrelation = (correlation: VolumeCorrelation) => {
    if (correlation.buckets.length === 0) return '';

    const correlationStrength = Math.abs(correlation.correlationCoefficient);
    const correlationLabel = correlationStrength >= 0.7 ? 'Strong' : correlationStrength >= 0.3 ? 'Moderate' : 'Weak';
    const correlationDirection = correlation.correlationCoefficient >= 0 ? 'positive' : 'negative';

    return `
      <div class="analytics-section compact">
        <div class="analytics-header">
          <span class="analytics-icon">📊</span>
          <span class="analytics-title">Size vs P&L Correlation</span>
          <span class="correlation-badge ${correlationDirection}">
            ${correlationLabel} ${correlationDirection} (${correlation.correlationCoefficient.toFixed(3)})
          </span>
        </div>
        <div class="correlation-table">
          <table>
            <thead>
              <tr>
                <th>Size Range</th>
                <th>Trades</th>
                <th>Win Rate</th>
                <th>Avg P&L</th>
                <th>Total P&L</th>
              </tr>
            </thead>
            <tbody>
              ${correlation.buckets
                .map(
                  (bucket) => `
                <tr>
                  <td>${bucket.volumeRange} shares</td>
                  <td>${bucket.tradeCount}</td>
                  <td style="color: ${bucket.winRate >= 50 ? '#10b981' : '#ef4444'};">${bucket.winRate.toFixed(1)}%</td>
                  <td style="color: ${bucket.avgPnL >= 0 ? '#10b981' : '#ef4444'};">${formatMoney(bucket.avgPnL)}</td>
                  <td style="color: ${bucket.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${formatMoney(bucket.totalPnL)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // ============================================================================
  // EXISTING RENDER FUNCTIONS
  // ============================================================================

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
                ${trade.holdDurationHours !== null ? `<span class="trade-badge hold-badge">⏱️ ${formatHours(trade.holdDurationHours)}</span>` : ''}
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
          <div class="trade-time">${format(new Date(trade.executedAt), 'MMM d, yyyy HH:mm:ss X')}</div>
          <div class="trade-date">${formatDistanceToNow(new Date(trade.executedAt), { addSuffix: true })}</div>
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

  const totalPnLColor = report.totalRealizedPnL >= 0 ? '#10b981' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Trade Analytics | Polymarket Bot</title>
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
        
        .header-controls {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        
        .filter-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .filter-label {
          font-size: 14px;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        
        .filter-select {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 14px;
          font-family: 'Outfit', sans-serif;
          color: var(--text-primary);
          cursor: pointer;
          min-width: 160px;
          transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238888a0' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }
        
        .filter-select:hover {
          border-color: var(--accent-purple);
        }
        
        .filter-select:focus {
          outline: none;
          border-color: var(--accent-purple);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
        }
        
        .filter-select option {
          background: var(--bg-secondary);
          color: var(--text-primary);
          padding: 8px;
        }
        
        /* Summary Cards */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .summary-value {
          font-size: 22px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Analytics Sections */
        .analytics-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
        }
        
        .analytics-section.compact {
          padding: 20px;
        }
        
        .analytics-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        
        .analytics-icon {
          font-size: 24px;
        }
        
        .analytics-title {
          font-size: 18px;
          font-weight: 600;
          flex: 1;
        }
        
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .status-badge.success {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent-green);
        }
        
        .status-badge.warning {
          background: rgba(239, 68, 68, 0.15);
          color: var(--accent-red);
        }
        
        .optimal-badge {
          background: rgba(139, 92, 246, 0.15);
          color: var(--accent-purple);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .correlation-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .correlation-badge.positive {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent-green);
        }
        
        .correlation-badge.negative {
          background: rgba(239, 68, 68, 0.15);
          color: var(--accent-red);
        }
        
        /* Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .metric-card {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .metric-card.highlight {
          border: 1px solid var(--border-color);
        }
        
        .metric-icon {
          font-size: 28px;
        }
        
        .metric-info {
          flex: 1;
        }
        
        .metric-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 2px;
        }
        
        .metric-value {
          font-size: 22px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .metric-hint {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        
        .metrics-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        
        /* Mini Cards */
        .mini-card {
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 12px 16px;
          min-width: 100px;
        }
        
        .mini-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .mini-value {
          font-size: 16px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Drawdown */
        .drawdown-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        
        .drawdown-card {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        
        .drawdown-card.warning {
          border: 1px solid var(--accent-red);
        }
        
        .drawdown-card.danger {
          background: rgba(239, 68, 68, 0.1);
        }
        
        .drawdown-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        
        .drawdown-value {
          font-size: 28px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .drawdown-sub {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        
        /* Hold Time */
        .hold-time-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .hold-time-chart {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .hold-time-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .hold-time-label {
          width: 90px;
          font-size: 13px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        
        .hold-time-bar-container {
          flex: 1;
          height: 28px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          overflow: hidden;
        }
        
        .hold-time-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          min-width: 30px;
        }
        
        .hold-time-count {
          font-size: 12px;
          font-weight: 600;
          color: white;
        }
        
        .hold-time-stats {
          display: flex;
          gap: 16px;
          min-width: 160px;
          justify-content: flex-end;
        }
        
        .hold-stat {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Streak */
        .streak-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        
        .streak-card {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .streak-card.current {
          border: 2px solid;
        }
        
        .streak-icon {
          font-size: 24px;
        }
        
        .streak-info {
          flex: 1;
        }
        
        .streak-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        
        .streak-value {
          font-size: 16px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Temporal Heatmaps */
        .temporal-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        
        @media (max-width: 900px) {
          .temporal-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .heatmap-container, .day-chart-container {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
        }
        
        .heatmap-title {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          font-weight: 500;
        }
        
        .hour-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 0 4px;
        }
        
        .hour-labels span {
          font-size: 10px;
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
        }
        
        .hour-heatmap {
          display: grid;
          grid-template-columns: repeat(24, 1fr);
          gap: 2px;
        }
        
        .heat-cell {
          aspect-ratio: 1;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 600;
          color: white;
          cursor: default;
        }
        
        .day-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 120px;
          gap: 8px;
        }
        
        .day-bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }
        
        .day-bar-wrapper.optimal .day-bar {
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
        }
        
        .day-bar {
          flex: 1;
          width: 100%;
          border-radius: 4px 4px 0 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 4px;
          min-height: 4px;
        }
        
        .day-count {
          font-size: 10px;
          font-weight: 600;
          color: white;
        }
        
        .day-label {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 6px;
        }
        
        .day-winrate {
          font-size: 10px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }
        
        .heatmap-legend {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .legend-scale {
          display: flex;
          gap: 4px;
        }
        
        .legend-item {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          color: white;
        }
        
        /* Trade Size Chart */
        .size-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 200px;
          gap: 16px;
          padding-top: 40px;
        }
        
        .size-bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          max-width: 120px;
        }
        
        .size-bar-wrapper.optimal {
          background: rgba(139, 92, 246, 0.1);
          border-radius: 8px;
          padding: 8px;
          margin: -8px;
        }
        
        .size-pnl {
          font-size: 13px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          margin-bottom: 8px;
        }
        
        .size-bar-container {
          flex: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        
        .size-bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          min-height: 4px;
        }
        
        .size-label {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 8px;
          text-align: center;
        }
        
        .size-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-top: 4px;
        }
        
        .size-meta span {
          font-size: 10px;
          color: var(--text-muted);
        }
        
        /* Activity Grid */
        .activity-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        
        /* Correlation Table */
        .correlation-table {
          overflow-x: auto;
        }
        
        .correlation-table table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .correlation-table th,
        .correlation-table td {
          padding: 12px 16px;
          text-align: left;
          font-size: 13px;
        }
        
        .correlation-table th {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .correlation-table td {
          border-bottom: 1px solid var(--border-color);
          font-family: 'JetBrains Mono', monospace;
        }
        
        /* Chart Section */
        .chart-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
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
        
        .trade-badge.hold-badge {
          background: rgba(139, 92, 246, 0.15);
          color: var(--accent-purple);
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
          margin-bottom: 24px;
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
          margin-bottom: 24px;
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
          margin-bottom: 24px;
        }
        
        .price-range-header {
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
        }
        
        .price-range-bar {
          height: 100%;
          border-radius: 8px;
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
          
          .price-range-item {
            flex-wrap: wrap;
          }
          
          .price-range-stats {
            width: 100%;
            justify-content: space-around;
            margin-top: 8px;
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
            <h1>Trade Analytics</h1>
          </div>
          <div class="header-controls">
            <div class="filter-container">
              <label for="timeFilter" class="filter-label">📅 Time Range:</label>
              <select id="timeFilter" class="filter-select" onchange="handleFilterChange(this.value)">
                <option value="all" ${report.selectedFilter === 'all' ? 'selected' : ''}>All Time</option>
                ${TIME_FILTER_OPTIONS.map(
                  (opt) => `<option value="${opt.value}" ${report.selectedFilter === opt.value ? 'selected' : ''}>${opt.label}</option>`,
                ).join('')}
              </select>
            </div>
            <div class="header-timestamp">
              Last updated: ${format(new Date(), 'MMM d, yyyy HH:mm:ss')}
            </div>
          </div>
        </header>
        
        <div class="summary-grid">
          ${renderSummaryCard('Total P&L', formatMoney(report.totalRealizedPnL), totalPnLColor, report.totalRealizedPnL >= 0 ? '📈' : '📉')}
          ${renderSummaryCard('Win Rate', `${report.winRate.toFixed(1)}%`, 'var(--accent-purple)', '🎯')}
          ${renderSummaryCard('Total Trades', report.totalTrades.toString(), 'var(--accent-blue)', '📊')}
          ${renderSummaryCard('Winning', report.winningTrades.toString(), 'var(--accent-green)', '✅')}
          ${renderSummaryCard('Losing', report.losingTrades.toString(), 'var(--accent-red)', '❌')}
          ${renderSummaryCard('Avg P&L', formatMoney(report.avgPnLPerTrade), report.avgPnLPerTrade >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', '📊')}
          ${renderSummaryCard('Avg Win', report.winningTrades > 0 ? formatMoney(report.avgWinSize) : 'N/A', 'var(--accent-green)', '💰')}
          ${renderSummaryCard('Avg Loss', report.losingTrades > 0 ? formatMoney(-report.avgLossSize) : 'N/A', 'var(--accent-red)', '💸')}
        </div>
        
        ${renderRiskMetrics(report.riskAdjustedMetrics, report.drawdownStats, report.grossProfit, report.grossLoss)}
        
        ${renderDrawdownStats(report.drawdownStats)}
        
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
                <span>Win Rate (last 3)</span>
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
        
        ${renderHoldTimeStats(report.holdTimeStats)}
        
        ${renderStreakStats(report.streakStats)}
        
        ${renderTemporalPerformance(report.temporalPerformance)}
        
        ${renderTradeSizeAnalysis(report.tradeSizeAnalysis)}
        
        ${renderTradingActivity(report.consecutiveAnalysis)}
        
        ${renderVolumeCorrelation(report.volumeCorrelation)}
        
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
                      return 'Win Rate (last 3): ' + context.parsed.y.toFixed(1) + '%';
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
                  text: 'Win Rate (3)',
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
      <script>
        function handleFilterChange(value) {
          const url = new URL(window.location.href);
          if (value === 'all') {
            url.searchParams.delete('filter');
          } else {
            url.searchParams.set('filter', value);
          }
          // Show loading state
          document.body.style.opacity = '0.6';
          document.body.style.pointerEvents = 'none';
          window.location.href = url.toString();
        }
      </script>
    </body>
    </html>
  `;
}
