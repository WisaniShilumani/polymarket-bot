## Polymarket Arbitrage Bot

### How it works

1. Main node.js process runs
2. It checks if wallet has enough collateral to make orders
3. It fetches open events, trade and orders
4. It filters out events with existing orders
5. It then checks for arbitrage opportunities by calculating the cost vs the payout
6. If an arbitrage exist, we validate if we can purchase the orders based on our parameters (max order size, min ROI etc)
7. If the validation passes, we check if the order book can take our orders
8. If the order book can take our order, we check to see if the orders are mutually exclusive (e.g. does one of them have to resolve to true?)
9. If all of the above is true, we begin executing orders, sorted by profitability
10. To execute, we first confirm our account balance and the order books again (since more than 1s has elapsed)
11. We then place the orders, sorted to place the most difficult order first
12. If one of the orders fail, we cancel all of them
