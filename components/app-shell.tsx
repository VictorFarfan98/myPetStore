"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppShellClient } from "./app-shell-client";

export function AppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string>();

  useEffect(() => {
    fetch("/api/current-profile")
      .then((response) => response.json())
      .then((profile: { rol?: string }) => setRole(profile.rol))
      .catch(() => undefined);
  }, []);

  return <AppShellClient role={role}>{children}</AppShellClient>;
}
