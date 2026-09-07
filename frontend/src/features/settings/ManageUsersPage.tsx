import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { useAuth } from "@/features/auth/useAuth";
import { useTheme } from "@/features/theme/ThemeProvider";
import type { Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ManageUsersPage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Manage users" }]);
  const { user } = useAuth();
  const { theme, setTheme, isSaving } = useTheme();

  return (
    <div className="space-y-6">
      <PageHeader title="Manage users" />

      <Card>
        <CardHeader>
          <CardTitle>Signed in as</CardTitle>
          <CardDescription>
            User administration (inviting users, editing roles) requires backend
            endpoints that are not yet implemented — this page currently reflects
            only the authenticated session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Username</dt>
                <dd>{user.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="flex gap-1">
                  {user.roles.length === 0 ? (
                    <span>None</span>
                  ) : (
                    user.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {role}
                      </Badge>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Not signed in.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose the appearance of the workspace. This preference is saved to
            your account and follows you across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Theme" className="flex gap-2">
            {THEME_OPTIONS.map((option) => {
              const selected = theme === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  variant={selected ? "default" : "outline"}
                  disabled={isSaving}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
