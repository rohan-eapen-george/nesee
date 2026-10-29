# nesee

A working Indian stock discovery website powered by a real ridge-regression forecasting model. Built with Next.js, React and Tailwind, deployed to Vercel. The original Sites/Vinext preview tooling remains available. No brokerage integration or order execution.

## Run locally

Requires Node 22.13+ and npm; Vercel uses Node 24.

```sh
npm ci
npm run dev:vercel
```

Open http://localhost:3000. The original Sites preview can still be run with `npm run dev`.

## Features

- All NSE EQ-series common equities in the bundled official bhavcopy; default price ceiling ₹1,000. Search, price, sector and daily liquidity filters, sorting and pagination.
- Separate model radar ranks a bounded 24-symbol historical universe, restricted to shares ≤₹1,000 and daily turnover >₹1 crore. Coverage is shown. This is not an exchange-wide ML ranking.
- Per-stock forecasts for **10, 50 and 210 trading sessions**, labelled 10 days, 10 weeks and 10 months. These are approximate trading-period equivalents, not calendar-date deadlines.
- Three separately trained direct ridge models predict future adjusted log returns. Six features: 5/20/60-session returns, price vs 50-session average, 20-session volatility and relative volume. Fixed L2 penalty 25.
- Rolling-origin backtests fit scalers and model only on observations whose outcome was available by the origin. MAPE is compared with a no-price-change baseline. Overlapping evaluation windows are disclosed.
- An approximate 80% empirical residual range, historical errors and annualised volatility are shown. No promised accuracy or guaranteed gains.
- Persistent browser-local watchlist, model explanation and beginner education.
- Prices and histories are real, dated data. Missing histories/providers result in explicit errors; synthetic values are never substituted.

## Refresh data

```sh
python3 scripts/refresh-data.py
node scripts/precompute.mjs
node scripts/test-model.mjs
```

Python's refresh script uses system curl with standard certificate verification, retrieves NSE's equity master and recent completed bhavcopy, and downloads 24 historical series from Yahoo. The exact source and retrieval dates are stored in JSON. Run both refresh and precompute together before rebuilding/deploying.

At runtime `/api/stocks` attempts a more recent completed NSE bhavcopy hourly. It retains the known universe until the next full data refresh and falls back to the dated bundled snapshot when unavailable. `/api/forecast?symbol=ITC` serves model results for bundled histories; symbols without bundled histories fetch ten years from Yahoo and train on request. `&refresh=1` requests newer history and retrains; provider failures fall back to the dated existing series. Current Indian calendar-day bars are excluded to avoid incomplete daily labels. Runtime caching is per isolate, not durable storage.

The snapshot is included so the website can work even when public feeds throttle requests. It is daily data, not a live tick feed. Automated unattended refresh is not configured.

## Validation and deployment

```sh
npx tsc --noEmit
node scripts/test-model.mjs
node scripts/test-allocation.mjs
npm run build:vercel
```

Production uses the existing Vercel project `nesee` in the `rohan8` team and serves [nesee.live](https://nesee.live). The private GitHub repository is [rohan-eapen-george/nesee](https://github.com/rohan-eapen-george/nesee). Pushes to `main` deploy to production automatically; other branches and pull requests get preview deployments. Test locally before pushing to `main`. No separate GitHub Actions deployment workflow or Vercel token is required.

## Limits

This is a research prototype, not a validated investment adviser. Most price-only models may fail to outperform a no-change baseline; the UI says so for each horizon. News, fundamentals, valuations and macroeconomic inputs are absent. Long-horizon errors can be large. Historical validation does not prove future accuracy. The forecast curve between the last observed price and the endpoint is illustrative interpolation, not individually predicted daily prices.

Yahoo adjusted prices account for distributions and splits; model returns are anchored to the latest unadjusted closing price to form scenarios. Data revisions and corporate-action artifacts remain possible. Range residuals come from correlated overlapping backtests and are not formally calibrated. Fees, taxes and dividends received are not simulated.

BSE-only shares, SME and non-EQ securities are excluded. Sector labels are curated for selected companies; others display “Other sectors.” No model is shown when there is insufficient history. Data-source availability and terms must be evaluated before commercial use.

Sources: [NSE official reports](https://www.nseindia.com/all-reports), [NSE equity master](https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv), [Yahoo historical data](https://finance.yahoo.com/), [SEBI investor education](https://investor.sebi.gov.in/).

## Budget allocation planner

The home-page summary dashboard has been replaced by **Get started → How much can you invest? → Build my plans**. The input is a total investment budget, independent of the share-price filter in the stock browser. The nesee brand replaces Nivesh; existing watchlist entries are read from the old local-storage key for continuity.

`POST /api/allocate` accepts JSON `{ "amount": 1000, "chargesAllowance": 0 }`. Amounts are validated between ₹1 and ₹1,00,000, with paise precision. An optional flat charges allowance must be smaller than the budget.

For each horizon, the allocator maximises the model-estimated rupee gain with exact unbounded integer knapsack dynamic programming. Whole shares only, no borrowing/shorting, cash permitted. Costs are integer paise, with exact gcd scaling; the rolling value buffer and reused backtrack storage bound memory. A cash-only allocation wins when no affordable positive prediction exists, or projected gains do not cover the allowance. The optimizer has no concentration limits; that is explicitly shown when a plan concentrates more than 70% of its budget in one company.

Allocation coverage is the bundled model universe (24 stocks initially), restricted to NSE equities priced at ₹1,000 or less and with daily turnover over ₹1 crore. Each stock's forecast must match the official market closing date; stale forecasts are refreshed or excluded. Missing horizons are excluded separately. **Optimality applies only to these forecast inputs and constraints, not the whole exchange or actual future returns.** Models that failed to beat the baseline are not excluded automatically; the plan warns when it includes them.

Every horizon is a separate alternative using the same budget, not one-third of the budget or a sequence of trades. Plans show symbols, quantities, prices, share costs, unspent cash, allowance, projected value and gain. Upper/lower per-stock model ranges are summed as favourable/downside scenarios. These are not joint portfolio confidence intervals, calibrated probabilities, maximum possible gains, or maximum possible losses. Fees/taxes are excluded unless the user enters an allowance. Cash earns zero.

```sh
node scripts/test-allocation.mjs
```

This checks the solver against exhaustive enumeration, a case where greedy ROI fails, negative forecasts, unaffordable shares, paise precision, allowances, cash, input bounds, and budget conservation across real-data horizons. A ₹1 lakh benchmark is included.

## Deploy to Vercel with nesee.live

The app is ready for native Next.js hosting on Vercel. `vercel.json` selects the Next.js framework, `npm ci`, and `npm run build:vercel`. Existing Sites/Vinext scripts remain available for the original preview; Vercel does not use the Cloudflare Worker entrypoint.

```sh
npm run build:vercel
npm run start:vercel
```

All three API routes use the Node.js runtime, dynamic responses, and a 60-second maximum duration. The real historical data, ridge model and integer allocation solver run on the server. No API keys are needed for the current public-data sources.

The existing Vercel project is connected to the private GitHub repository `rohan-eapen-george/nesee`. Push reviewed changes to `main` to update `nesee.live`; use a separate branch for preview deployments. Vercel builds the committed source with `npm run build:vercel`, including the local fonts, logos and model data. Check the resulting deployment reaches `READY` before considering a release complete. The domain is already configured; routine deployments do not require DNS changes.

`.vercelignore` excludes credentials, local environment files, prior build outputs, `.openai`, and generated artifacts from the upload. The old pending custom-domain attachment was removed from Sites when Vercel was selected; no Namecheap DNS records were changed.

Historical series are stored losslessly compressed in `data/histories-packed.json` for deployment; the server decodes them with Node.js zlib. `scripts/precompute.mjs` regenerates this packed copy, and the packer verifies byte-for-byte equality. Raw histories remain available locally for refresh and model tests.

## Company logos

The local stock UI uses a shared `StockLogo` component in research cards, the stock table, individual forecasts, and whole-share allocations. Assets are served from `public/stock-logos/`, so browsing does not make third-party image requests. The first catalog pass provides 2,064 matched company logos, including all 24 modelled stocks; the other 292 stocks keep their initials. An image-load error also falls back to initials.

Identity matching uses the official [NSE equity master](https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv) and the [ISIN-indexed Indian Listed Company Logos API](https://company-logo.shareperks.in/). A logo is accepted only with the official ISIN and an equivalent NSE/BSE ticker (punctuation differences normalised). Missing entries and mismatches are not substituted with guesses. `data/stock-logos-audit.json` records sources, retrieval dates, identity checks, hashes, and unavailable entries. Companies own their respective logos and trademarks.

```sh
python3 scripts/refresh-logos.py
# Re-fetch existing logos to check for rebrands:
python3 scripts/refresh-logos.py --refresh
```

The importer checks SVGs for active content, external references and unreasonable size, and adds a viewBox where needed for consistent scaling. The logo map is imported once by the shared client component; images are lazy-loaded except the three prominent research cards. These assets are committed with the application and deployed with it.

### Typography

The UI uses self-hosted Plus Jakarta Sans (variable weights 200–800), loaded through `next/font/local` with `display: swap`. Font files and their OFL license live in `app/fonts/`. `app/typography.css` defines a single responsive type scale: 12–13px supporting labels, 14–16px UI and body text, 24–30px headings, and larger financial values. Secondary text uses darker greens, numerical values use tabular figures, and chart axes use HTML labels so they stay readable as the plot resizes. Layout rules remain in `app/globals.css`.
