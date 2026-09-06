import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/DetailPageShell";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { useClient } from "@/hooks/useClients";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading, isError, error, refetch } = useClient(id);

  // Falls back to "Home > Clients" while the client's name is still
  // loading, so the trail never shows a blank/placeholder segment.
  useBreadcrumbs(
    client
      ? [HOME_SEGMENT, { label: "Clients", href: "/clients" }, { label: client.name }]
      : [HOME_SEGMENT, { label: "Clients", href: "/clients" }]
  );

  return (
    <DetailPageShell
      backTo="/clients"
      backLabel="Back to clients"
      entity={client}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      loadingMessage="Loading client..."
      notFoundMessage="This client could not be found."
      main={(client) => (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h1>{client.name}</h1>
            </CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={client.status === "active" ? "success" : "neutral"}>
                {client.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {client.description ?? "No description provided."}
            </p>
          </CardContent>
        </Card>
      )}
    />
  );
}
