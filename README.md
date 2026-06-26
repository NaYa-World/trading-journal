# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Absolutely! Let's break down exactly how you would use each of these features on a daily basis:

1. Calendar Heatmap (Consistency Tracker)
How it works: Imagine a visual grid where each square represents a day of the month. How you use it: You don't have to do any extra work! When you log trades, the grid automatically updates. If you finish the day with a net profit, the square turns bright green. If you lose money, it turns red. If you took the day off, it stays grey. The Value: The goal of professional trading is consistency, not just one lucky big trade. Looking at a calendar and seeing 18 green squares and 3 red squares builds immense psychological confidence. It immediately exposes if you are revenge trading on certain days of the week (like "Red Fridays").

2. Position Size Calculator (Risk Management)
How it works: A small widget permanently attached to the side of your "Add Trade" screen. How you use it:

You set your total capital (e.g., $5,000) and say "I never want to lose more than 2% ($100) per trade."
You type in your planned Entry Price (e.g., $65,000) and your planned Stop Loss Price (e.g., $64,000).
The dashboard instantly spits out: "Buy exactly 0.1 BTC." The Value: Instead of guessing how much leverage or quantity to use and accidentally risking 15% of your account on a bad trade, you will mathematically never blow up your account.
3. CSV Data Export & Advanced Filtering
How it works: A powerful search/filter bar and a Download button. How you use it: If you want to know "How profitable am I specifically trading Solana breakouts on weekends?", you just select those filters and your entire dashboard (Equity Curve, Profit Factor, Win Rate) instantly recalculates for only those trades. Then, you click "Export to CSV" and a file downloads directly to your Mac. The Value: You can back up your precious trade data so you never lose it, and you can open it in Microsoft Excel or Google Sheets to do advanced math, share it with a mentor, or use it for tax purposes.

4. Interactive Candlestick Charts
How it works: Actual interactive charts (like TradingView) embedded right inside your dashboard. How you use it: Right now, you just have a table of numbers and a link. With this feature, you click on a past trade in the Finished Trades table, and a chart pops open. The app automatically draws a green dot on the candle where you entered, and a red dot on the candle where you exited. The Value: You can visually see why a trade failed months after you took it. You might look at the chart and instantly realize, "Wow, my stop loss was way too tight, it wicked me out and then pumped."

5. Automated Exchange Sync (API Keys)
How it works: A settings menu where you securely paste a "Read-Only" API key from Binance or Bitget. How you use it: You completely stop using the "Add Trade" modal. When you take a trade on your phone using the Binance app, your custom dashboard detects it within seconds. It automatically figures out the Entry, Exit, Fees, and calculates the PnL and Equity Curve without you touching the keyboard. All you have to do is log in, select the trade, and add your "Setup" and "Mistake" notes. The Value: It saves you hundreds of hours of manual data entry and guarantees there are zero math or typo errors in your journal.