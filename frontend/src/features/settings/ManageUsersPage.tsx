import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { useAuth } from "@/features/auth/useAuth";
import { useTheme } from "@/features/theme/ThemeProvider";
import { usePeople } from "@/hooks/usePeople";
import { toast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import type { Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ManageUsersPage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Manage users" }]);
  const { user, updateLinkedPerson } = useAuth();
  const { theme, setTheme, isSaving } = useTheme();
  const { data: people = [], isLoading: isLoadingPeople } = usePeople({ per_page: 100 });

  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [isUpdatingPerson, setIsUpdatingPerson] = useState(false);

  const isAdmin = user?.roles.includes("admin") ?? false;

  useEffect(() => {
    if (user?.peopleId) {
      setSelectedPersonId(user.peopleId);
    }
  }, [user?.peopleId]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  async function handleSaveLinkedPerson() {
    if (!selectedPersonId || selectedPersonId === user?.peopleId) return;
    setIsUpdatingPerson(true);
    try {
      await updateLinkedPerson(selectedPersonId);
      toast({
        title: "Linked person updated",
        description: "User account identity has been reassigned successfully.",
      });
    } catch (err) {
      toast({
        title: "Failed to update linked person",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPerson(false);
    }
  }

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
          <CardTitle>Linked Person</CardTitle>
          <CardDescription>
            This user account is associated with a Person in the directory. Actions taken in the system
            (such as creating resources, versions, and audit entries) are attributed to this identity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-subtle p-3 text-sm">
            <span className="text-muted-foreground">Currently linked to:</span>
            <div className="flex items-center gap-2 font-medium">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>{user?.person?.name ?? "No person linked"}</span>
              {user?.person?.email && (
                <span className="font-normal text-muted-foreground">({user.person.email})</span>
              )}
            </div>
          </div>

          {isAdmin ? (
            <div className="space-y-3 border-t border-border pt-4">
              <label htmlFor="select-person" className="block text-sm font-medium">
                Change linked person
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedPersonId}
                  onValueChange={setSelectedPersonId}
                  disabled={isUpdatingPerson || isLoadingPeople}
                >
                  <SelectTrigger id="select-person" aria-label="Select person to link" className="w-full sm:w-[320px]">
                    <SelectValue placeholder={isLoadingPeople ? "Loading directory..." : "Select person..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.email ? `(${p.email})` : `(${p.type.replace("_", " ")})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  disabled={!selectedPersonId || selectedPersonId === user?.peopleId || isUpdatingPerson}
                  onClick={handleSaveLinkedPerson}
                >
                  {isUpdatingPerson ? "Saving..." : "Save changes"}
                </Button>
              </div>

              {selectedPerson && selectedPerson.id !== user?.peopleId && (
                <p className="text-xs text-muted-foreground">
                  Note: If &ldquo;{selectedPerson.name}&rdquo; is currently associated with another user account, saving will transfer the link to this account.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only system administrators can reassign or change the linked person.
            </p>
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
