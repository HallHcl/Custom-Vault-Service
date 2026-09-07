import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpirationsSummary } from "@/hooks/useExpirations";

export default function CriticalExpirationsCard() {
  const navigate = useNavigate();
  const { data: summary, isLoading, isError } = useExpirationsSummary();

  const expiredCount = summary?.expired_count ?? 0;
  const criticalCount = summary?.critical_count ?? 0;
  const warningCount = summary?.warning_count ?? 0;

  const isCritical = expiredCount + criticalCount > 0;
  const isWarning = !isCritical && warningCount > 0;

  function handleClick() {
    navigate("/expirations?days_ahead=30");
  }

  let criticalMessage = "";
  if (expiredCount > 0 && criticalCount > 0) {
    criticalMessage = `${expiredCount} expired, ${criticalCount} critical (≤7 days)`;
  } else if (expiredCount > 0) {
    criticalMessage = `${expiredCount} expired`;
  } else if (criticalCount > 0) {
    criticalMessage = `${criticalCount} critical (≤7 days)`;
  }

  const warningMessage = `${warningCount} expiring within 30 days`;

  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-elev-2">
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Critical expirations &amp; lifecycle</CardTitle>
            <span className="flex items-center text-xs text-muted-foreground hover:text-foreground">
              View all
              <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading expiration status...</p>
          )}

          {!isLoading && isError && (
            <p className="text-sm text-muted-foreground">
              Couldn&rsquo;t load expiration status.
            </p>
          )}

          {!isLoading && !isError && (
            <>
              {isCritical ? (
                <div className="flex items-center gap-2 rounded-sm border border-danger-border bg-danger-tint px-3 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger-text" aria-hidden="true" />
                  <p className="text-sm font-medium text-danger-text">{criticalMessage}</p>
                </div>
              ) : isWarning ? (
                <div className="flex items-center gap-2 rounded-sm border border-warning-border bg-warning-tint px-3 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning-text" aria-hidden="true" />
                  <p className="text-sm font-medium text-warning-text">{warningMessage}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-sm border border-success-border bg-success-tint px-3 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" aria-hidden="true" />
                  <p className="text-sm text-success-text">
                    All expirations active &amp; compliant
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </button>
    </Card>
  );
}
