"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppShellClient } from "./app-shell-client";

export function AppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string>();
  const [userName, setUserName] = useState<string>();

  useEffect(() => {
    fetch("/api/current-profile")
      .then((response) => response.json())
      .then((profile: { rol?: string; nombre?: string }) => { setRole(profile.rol); setUserName(profile.nombre); })
      .catch(() => undefined);
  }, []);

  return <AppShellClient role={role} userName={userName}>{children}</AppShellClient>;
}
