// Loads the modules that register approval handlers, so a decision made from
// the approvals screens can always apply its change, even when the module's
// own pages haven't been opened yet. Add each module as it's connected.
import "@/features/stock/api/stock-api";
import "@/features/transfers/api/transfers-api";
