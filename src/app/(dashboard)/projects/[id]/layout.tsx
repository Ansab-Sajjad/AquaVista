"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";

import { Box, Button, Typography } from "@mui/material";

import { AvaUsageProvider } from "@/components/ask-ava/ava-usage-context";
import NiChartPie from "@/icons/nexture/ni-chart-pie";
import NiDatabase from "@/icons/nexture/ni-database";
import NiHome from "@/icons/nexture/ni-home";
import NiRobot from "@/icons/nexture/ni-robot";
import NiSettings from "@/icons/nexture/ni-settings";
import NiUsers from "@/icons/nexture/ni-users";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { isAdminUser } from "@/lib/auth";

const PROJECT_TABS = [
  { id: "overview", label: "Overview", icon: NiHome, href: (id: string) => `/projects/${id}/overview` },
  { id: "dashboard", label: "Dashboard", icon: NiChartPie, href: (id: string) => `/projects/${id}/dashboard` },
  { id: "data", label: "Data", icon: NiDatabase, href: (id: string) => `/projects/${id}/data` },
  { id: "ask-ava", label: "Ask AVA", icon: NiRobot, href: (id: string) => `/projects/${id}/ask-ava` },
  {
    id: "chat-settings",
    label: "Chat Settings",
    icon: NiSettings,
    href: (id: string) => `/projects/${id}/chat-settings`,
    adminOnly: true,
  },
  { id: "users", label: "Users", icon: NiUsers, href: (id: string) => `/projects/${id}/users`, adminOnly: true },
];

type Project = {
  id: string;
  name: string;
  municipality: string;
  description?: string;
  teamCount: number;
  lastUpdated?: string | null;
};

export default function ProjectLayout({ children }: PropsWithChildren) {
  const params = useParams();
  const projectId = (params?.id as string) || "";

  return (
    <AvaUsageProvider projectId={projectId}>
      <ProjectLayoutContent projectId={projectId}>{children}</ProjectLayoutContent>
    </AvaUsageProvider>
  );
}

function ProjectLayoutContent({ projectId, children }: PropsWithChildren<{ projectId: string }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = isAdminUser();
  const isAdminViewingUser = Boolean(searchParams.get("userId")) && isAdmin;
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;

      try {
        const data = await apiClient.get<any>(`/api/projects/${projectId}`);

        if (data) {
          setProject({
            id: data.id || data._id,
            name: data.name,
            municipality: data.municipality,
            description: data.description,
            teamCount: data.teamCount ?? 0,
            lastUpdated: data.lastUpdated || data.updatedAt,
          });
        }
      } catch {
        // Silently fail - project name will just not show
      }
    };

    void loadProject();
  }, [projectId]);

  const VISIBLE_TABS = PROJECT_TABS.filter((tab) => !tab.adminOnly || isAdmin);

  const activeTab =
    isAdminViewingUser
      ? "users"
      : PROJECT_TABS.find((tab) => pathname.includes(`/projects/${projectId}/${tab.id}`))?.id || "dashboard";

  return (
    <Box className="flex w-full flex-col gap-4 sm:flex-row sm:items-stretch">
      {!isAdminViewingUser && (
        <Box className="bg-background-paper shadow-darker-xs flex w-full shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl p-4 transform-gpu will-change-transform sm:sticky sm:top-[5.5rem] sm:h-[calc(100vh-7.5rem)] sm:w-56 sm:self-start md:top-24 md:h-[calc(100vh-8.5rem)]">
          <Typography variant="caption" className="text-primary mb-1 px-2.5 font-semibold uppercase">
            {project?.name || "Project"}
          </Typography>
          {VISIBLE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                component={Link}
                href={tab.href(projectId)}
                variant="text"
                size="large"
                color="text-primary"
                className={cn(
                  "full-width-button group hover:bg-grey-25 px-4",
                  isActive && "active text-primary! bg-grey-25!",
                )}
                startIcon={<Icon variant={isActive ? "contained" : "outlined"} size="medium" />}
              >
                {tab.label}
              </Button>
            );
          })}
        </Box>
      )}

      <Box
        className={cn(
          "bg-background-paper outline-grey-50 w-full min-w-0 flex-1 rounded-2xl p-4 shadow-xs outline outline-offset-0 sm:p-6",
        )}
      >
        {children}
      </Box>
    </Box>
  );
}
