import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchRegistrationStatus, useAuth } from "./useAuth";
import type { RegistrationStatus } from "./useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRegistrationStatus()
      .then((status) => {
        setRegStatus(status);
        if (!status.isOpen && mode === "register") {
          setMode("login");
        }
      })
      .catch(() => {
        setRegStatus(null);
      });
  }, [mode]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate("/overview", { replace: true });
    } catch {
      setError("Invalid username or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      await register(trimmedUser, password);
      // Navigate to /settings/manage-users directly after registration as requested
      navigate("/settings/manage-users", { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center">
          <span className="text-xl font-bold tracking-tight text-foreground">
            QQM
          </span>
          <span className="mt-2 h-0.5 w-10 bg-brand" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h1>{mode === "login" ? "Sign in" : "Create admin account"}</h1>
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access the client & project workspace."
                : `Register a new admin account (${regStatus?.remainingSlots ?? 0} slots remaining).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>

                {regStatus?.isOpen && (
                  <div className="mt-4 pt-3 border-t border-border/50 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError(null);
                        setPassword("");
                        setConfirmPassword("");
                      }}
                      className="text-xs text-brand hover:underline font-medium cursor-pointer"
                    >
                      Need an account? Register new admin ({regStatus.remainingSlots} slot{regStatus.remainingSlots === 1 ? "" : "s"} left)
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-confirm-password">Confirm Password</Label>
                  <Input
                    id="reg-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Register & Link profile"}
                </Button>

                <div className="mt-4 pt-3 border-t border-border/50 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium cursor-pointer"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
