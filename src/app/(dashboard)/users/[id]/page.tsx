"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { ArrowBack, Business, Email, Forum, Person, Work } from "@mui/icons-material";
import { BarChart } from "@mui/x-charts";

import { apiClient } from "@/lib/api-client";
import { isAdminUser, normalizeAvatarUrl } from "@/lib/auth";
import { DEFAULTS } from "@/config";

type Project = { id: string; name: string; municipality: string };
type UserUsageTotals = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalQuestions: number;
};
type UserProjectUsage = UserUsageTotals & {
  projectId: string;
  projectName: string;
  municipality: string;
};
type UserDailyUsage = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  tokens: number;
  questions: number;
};
type UserUsage = {
  totals: UserUsageTotals;
  byProject: UserProjectUsage[];
  daily: UserDailyUsage[];
};
type UserDetail = {
  id: string;
  name: string;
  email: string;
  company?: string;
  role: string;
  status: string;
  lastActive?: string;
  createdAt: string;
  profileImage?: string | null;
  image?: string | null;
  projects: Project[];
  usage?: UserUsage;
};

function formatDate(value?: string) {
  if (!value) return "Never logged in";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function formatTokens(value?: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatDayShort(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function formatStatus(value?: string) {
  if (!value) return "Unknown";
  const normalized = value.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function getStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "active") return "success";
  if (normalizedStatus === "pending") return "primary";
  return "warning";
}

export default function UserDetailPage() {
  const theme = useTheme();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageDays, setUsageDays] = useState<number>(7);

  const userId = params?.id;

  useEffect(() => {
    if (!isAdminUser()) {
      router.replace(DEFAULTS.appRoot);
      return;
    }

    if (!userId) {
      setError("User not found.");
      setLoading(false);
      return;
    }

    const isFirstLoad = !user;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setUsageLoading(true);
    }
    setError(null);

    const loadUser = async () => {
      try {
        const data = await apiClient.get<any>(`/api/projects/admin/users/${userId}?days=${usageDays}`);
        setUser(data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load user details.");
      } finally {
        setLoading(false);
        setUsageLoading(false);
      }
    };

    void loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, userId, usageDays]);

  const detailItems = useMemo(
    () => [
      { label: "Email", value: user?.email || "-", icon: <Email fontSize="small" /> },
      { label: "Company", value: user?.company || "-", icon: <Business fontSize="small" /> },
      { label: "Role", value: user?.role === "admin" ? "Admin" : "Project user", icon: <Work fontSize="small" /> },
      { label: "Status", value: formatStatus(user?.status), icon: <Person fontSize="small" /> },
      { label: "Last active", value: formatDate(user?.lastActive), icon: <Person fontSize="small" /> },
      { label: "Joined", value: formatDate(user?.createdAt), icon: <Person fontSize="small" /> },
    ],
    [user],
  );

  if (!isAdminUser()) return null;

  return (
    <Box className="flex w-full flex-col gap-6">
      <Box className="flex flex-col gap-2">
        <Box className="flex items-center justify-between gap-3">
          <Breadcrumbs aria-label="breadcrumb">
            <Link href="/users" className="text-primary no-underline hover:underline">
              Users
            </Link>
            <Typography color="text.primary">User details</Typography>
          </Breadcrumbs>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push("/users")}
            variant="outlined"
            className="w-fit"
            sx={{
              borderColor: "divider",
              color: "text.primary",
              px: 2,
              py: 0.8,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              "&:hover": {
                borderColor: "primary.main",
                color: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            Back to users
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box className="flex justify-center py-16">
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !user ? (
        <Alert severity="warning">User not found.</Alert>
      ) : (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
              <CardContent className="flex flex-col items-center gap-5 p-5 md:p-6">
                <Box className="self-start">
                  <Chip
                    label={formatStatus(user.status)}
                    color={getStatusColor(user.status)}
                    size="small"
                  />
                </Box>
                <Avatar
                  alt={user.name}
                  src={user.profileImage ? normalizeAvatarUrl(user.profileImage) : undefined}
                  className="h-24 w-24 rounded-4xl"
                >
                  {user.name?.charAt(0) ?? "U"}
                </Avatar>
                <Box className="text-center">
                  <Typography variant="h4">{user.name}</Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {user.role === "admin" ? "Admin" : "Project user"}
                  </Typography>
                </Box>

                <Divider />

                <Box className="overflow-hidden rounded-3xl bg-background-paper w-full">
                  <Box className="flex items-center gap-2 p-4 text-text-secondary">
                    <Email fontSize="small" />
                    <Typography variant="body2">Email</Typography>
                  </Box>
                  <Box className="px-4 pb-4 pt-0">
                    <Typography className="font-semibold break-words">{user.email}</Typography>
                  </Box>
                  <Divider className="mx-4" />
                  <Box className="flex items-center gap-2 p-4 text-text-secondary">
                    <Business fontSize="small" />
                    <Typography variant="body2">Company</Typography>
                  </Box>
                  <Box className="px-4 pb-4 pt-0">
                    <Typography className="font-semibold">{user.company || "-"}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="body2" className="text-text-secondary">
                      Last active
                    </Typography>
                    <Typography className="font-semibold">{formatDate(user.lastActive)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="body2" className="text-text-secondary">
                      Joined
                    </Typography>
                    <Typography className="font-semibold">{formatDate(user.createdAt)}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Token usage totals */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="body2" className="text-text-secondary">
                      Input tokens
                    </Typography>
                    <Typography className="font-semibold">
                      {formatTokens(user.usage?.totals.totalInputTokens)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="body2" className="text-text-secondary">
                      Output tokens
                    </Typography>
                    <Typography className="font-semibold">
                      {formatTokens(user.usage?.totals.totalOutputTokens)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="body2" className="text-text-secondary">
                      Total questions
                    </Typography>
                    <Typography className="font-semibold">
                      {user.usage?.totals.totalQuestions ?? 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Token trend — selectable range */}
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Box className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Box className="flex flex-col gap-1">
                        <Typography variant="h6">
                          Token usage — {usageDays === 1 ? "Yesterday" : `Last ${usageDays} days`}
                        </Typography>
                        <Typography variant="body2" className="text-text-secondary">
                          Total: {formatTokens(user.usage?.daily.reduce((sum, d) => sum + d.tokens, 0))}
                        </Typography>
                      </Box>
                      <ToggleButtonGroup
                        size="small"
                        color="primary"
                        exclusive
                        value={usageDays}
                        onChange={(_e, value) => {
                          if (value !== null) setUsageDays(value);
                        }}
                      >
                        <ToggleButton value={1}>Yesterday</ToggleButton>
                        <ToggleButton value={7}>7 days</ToggleButton>
                        <ToggleButton value={15}>15 days</ToggleButton>
                        <ToggleButton value={30}>30 days</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    {usageLoading ? (
                      <Box className="flex items-center justify-center py-8">
                        <CircularProgress size={24} />
                      </Box>
                    ) : user.usage && user.usage.daily.some((d) => d.tokens > 0) ? (
                      <Box className="flex flex-col gap-4">
                        <Box sx={{ width: "100%" }}>
                          <BarChart
                            xAxis={[
                              {
                                scaleType: "band",
                                data: user.usage.daily.map((d) =>
                                  usageDays <= 7 ? formatDayShort(d.date) : formatDateShort(d.date),
                                ),
                                disableLine: true,
                                disableTicks: true,
                                tickLabelStyle: { fontSize: 11 },
                              },
                            ]}
                            yAxis={[
                              {
                                disableLine: true,
                                disableTicks: true,
                                min: 0,
                                width: 50,
                                valueFormatter: (v: number | null) =>
                                  typeof v === "number" ? formatTokens(v) : "-",
                              },
                            ]}
                            series={[
                              {
                                data: user.usage.daily.map((d) => d.tokens),
                                color: theme.palette.primary.main,
                                valueFormatter: (value, context) => {
                                  const safeValue = value ?? 0;
                                  return context.dataIndex !== undefined
                                    ? `${formatTokens(safeValue)} tokens · ${user.usage!.daily[context.dataIndex].questions} questions`
                                    : formatTokens(safeValue);
                                },
                                label: "Tokens",
                              },
                            ]}
                            height={260}
                            grid={{ horizontal: true }}
                            margin={{ top: 10, bottom: 10, left: 0, right: 10 }}
                            borderRadius={6}
                          />
                        </Box>
                      </Box>
                    ) : (
                      <Typography className="text-text-secondary">
                        No token usage in the {usageDays === 1 ? "selected day" : `last ${usageDays} days`}.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Per-project token breakdown */}
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="h6" className="mb-4">
                      Token usage by project — {usageDays === 1 ? "Yesterday" : `Last ${usageDays} days`}
                    </Typography>
                    {user.usage && user.usage.byProject.some((p) => p.totalTokens > 0) ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell className="font-semibold">Project</TableCell>
                              <TableCell className="font-semibold">Municipality</TableCell>
                              <TableCell align="right" className="font-semibold">Input tokens</TableCell>
                              <TableCell align="right" className="font-semibold">Output tokens</TableCell>
                              <TableCell align="right" className="font-semibold">Total tokens</TableCell>
                              <TableCell align="right" className="font-semibold">Questions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {user.usage.byProject
                              .slice()
                              .sort((a, b) => b.totalTokens - a.totalTokens)
                              .map((project) => (
                                <TableRow key={project.projectId}>
                                  <TableCell>
                                    <Link
                                      href={`/projects/${project.projectId}/dashboard`}
                                      className="text-primary no-underline hover:underline"
                                    >
                                      {project.projectName}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-text-secondary">
                                    {project.municipality || "-"}
                                  </TableCell>
                                  <TableCell align="right">{formatTokens(project.totalInputTokens)}</TableCell>
                                  <TableCell align="right">{formatTokens(project.totalOutputTokens)}</TableCell>
                                  <TableCell align="right" className="font-semibold">
                                    {formatTokens(project.totalTokens)}
                                  </TableCell>
                                  <TableCell align="right">{project.totalQuestions}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography className="text-text-secondary">No project token usage yet.</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" className="rounded-3xl border-divider bg-background-paper">
                  <CardContent className="p-5 md:p-6">
                    <Typography variant="h6" className="mb-4">
                      Assigned projects
                    </Typography>
                    {user.projects.length ? (
                      <Box className="grid gap-3 md:grid-cols-2">
                        {user.projects.map((project) => (
                          <Box
                            key={project.id}
                            className="flex items-center justify-between rounded-3xl border border-divider p-4 transition hover:bg-primary/10"
                          >
                            <Link
                              href={`/projects/${project.id}/dashboard`}
                              className="flex-1 text-sm font-medium text-primary no-underline"
                            >
                              <Typography className="font-semibold">{project.name}</Typography>
                              <Typography variant="body2" className="text-text-secondary">
                                {project.municipality}
                              </Typography>
                            </Link>
                            {isAdminUser() && (
                              <Tooltip title="View Ask AVA chat">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    router.push(
                                      `/projects/${project.id}/ask-ava?userId=${encodeURIComponent(user.id)}`,
                                    )
                                  }
                                  sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                                >
                                  <Forum fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography className="text-text-secondary">No projects assigned.</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
