// Barrel export: re-exports every component so App.jsx has a single clean import.
export { default as Sidebar } from "./shared/Sidebar.jsx";
export { default as TopNav } from "./shared/TopNav.jsx";
export { default as BottomNav } from "./shared/BottomNav.jsx";
export { default as ProfileManagerModal } from "./modals/ProfileManagerModal.jsx";
export { default as AddTradeModal } from "./modals/AddTradeModal.jsx";
export { default as EditTradeModal } from "./modals/EditTradeModal.jsx";
export { default as CSVImportModal } from "./modals/CSVImportModal.jsx";
export { default as TradeLog } from "./views/TradeLog.jsx";
export { default as TradeSummary } from "./views/TradeSummary.jsx";
export { default as RiskCalculator } from "./views/RiskCalculator.jsx";
export { default as TradingCalendar } from "./views/TradingCalendar.jsx";
export { default as Analytics } from "./views/Analytics.jsx";
export {
  Tag, CoinIcon, InfoDot, Card, ML, MV,
  Placeholder, EmptyState, Skeleton, SemiGauge, DonutGauge, MaskedDateInput,
  Sparkline, WinLossRatioBar,
} from "./shared/index.jsx";

