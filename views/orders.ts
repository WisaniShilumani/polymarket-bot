import { Side } from '@polymarket/clob-client';
import { formatDistanceToNow } from 'date-fns';

export function generateOrdersHTML(orders: { buyOrdersReport: any[]; sellOrdersReport: any[] }): string {
  const formatPriceCents = (price: number) => {
    return Math.round(price * 100);
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const formatHoursAgo = (hours: number) => {
    if (hours < 1) return '< 1 hour';
    if (hours === 1) return '1 hour';
    return `${Math.round(hours)} hours`;
  };

  const renderOrderRow = (order: any) => {
    const imageHtml = order.image
      ? `<img src="${order.image}" alt="${order.question}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;" />`
      : '<div style="width: 48px; height: 48px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 20px;">📊</div>';

    const outcomeColor = order.outcome === 'Yes' ? '#10b981' : '#ef4444';
    const profitLossColor = order.profitLoss >= 0 ? '#10b981' : '#333';

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px;">
          ${imageHtml}
        </td>
        <td style="padding: 16px;">
          <div style="font-weight: 500; color: #111827; margin-bottom: 8px;">${order.question}</div>
          <div style="display: flex; flex-direction: row; gap: 4px; align-items: center;">
            <div style="display: inline-block; background: ${outcomeColor}15; color: ${outcomeColor}; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 500;">
              ${order.side === Side.BUY ? 'Buying at' : 'Selling at'} ${formatPriceCents(order.averagePurchasePrice)}¢
            </div>
            <div style="color: #6b7280; font-size: 12px;">
              ${order.shares.toFixed(1)} shares
            </div>
          </div>
        </td>
        <td style="padding: 16px; text-align: right;">
          <div style="font-weight: 600; color: ${profitLossColor}; font-size: 16px; margin-bottom: 4px;">
            ${formatPriceCents(order.currentMarketPrice)}¢
          </div>
          <div style="color: #6b7280; font-size: 12px;">
            ${formatTimeAgo(order.createdAt)} (${formatHoursAgo(order.orderAge)})
          </div>
        </td>
      </tr>
    `;
  };

  const buyOrders = [...orders.buyOrdersReport].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sellOrders = [...orders.sellOrdersReport].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const renderOrderTable = (orderList: any[], emptyMessage: string) => {
    if (orderList.length === 0) {
      return `<div class="empty-state">${emptyMessage}</div>`;
    }
    return `
      <table>
        <thead>
          <tr>
            <th style="width: 60px;"></th>
            <th>Market</th>
            <th style="text-align: right; width: 200px;">Current Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderList.map(renderOrderRow).join('')}
        </tbody>
      </table>
    `;
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Orders Report</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f9fafb;
          padding: 24px;
          min-height: 100vh;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          color: #111827;
          margin-bottom: 24px;
          font-size: 28px;
          font-weight: 600;
        }
        .section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section-title {
          font-size: 20px;
          margin-bottom: 16px;
          color: #111827;
          font-weight: 600;
        }
        .buy-section .section-title {
          color: #10b981;
        }
        .sell-section .section-title {
          color: #ef4444;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead {
          background: #f9fafb;
        }
        th {
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tbody tr:hover {
          background: #f9fafb;
        }
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Orders</h1>
        
        ${
          buyOrders.length > 0
            ? `
              <div class="section buy-section">
                <h2 class="section-title">Buy Orders (${buyOrders.length})</h2>
                ${renderOrderTable(buyOrders, 'No buy orders found')}
              </div>
            `
            : ''
        }

        ${
          sellOrders.length > 0
            ? `
              <div class="section sell-section">
                <h2 class="section-title">Sell Orders (${sellOrders.length})</h2>
                ${renderOrderTable(sellOrders, 'No sell orders found')}
              </div>
            `
            : ''
        }
      </div>
    </body>
    </html>
  `;
}
