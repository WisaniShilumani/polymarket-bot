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

### Strategy 2

I've come to the realisation that I'm seeking a 2% discount per match to make a discount. The issue with this, is that I have to fill
3 orders, and wait for matches to happen to realise that gain. I have also experienced losses in times where I wasn't able to fulfill all 3 orders.

This strategy is ultimately not so different from buying a volatile asset at X price, and selling it at 1.02X; except that it comes with a guarantee that
the price will go up, granted all 3 orders are filled.

The best outcome I can have here is if I have an API that's ahead of Polymarket's predictions; and I can use that to fill orders, and sell when the price is up.

The second best outcome is to use price momentum to know when to buy at a certain price, and then sell it at the increased price.
