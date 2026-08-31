"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MoreVert, Visibility } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Select,
  SelectProps,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRowSpacingParams, type GridSortModel } from "@mui/x-data-grid";

import { DataGridPaginationFullPage } from "@/components/data-grid/data-grid-pagination";
import { DEFAULTS } from "@/config";
import NiArrowDown from "@/icons/nexture/ni-arrow-down";
import NiArrowUp from "@/icons/nexture/ni-arrow-up";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronLeftRightSmall from "@/icons/nexture/ni-chevron-left-right-small";
import NiCols from "@/icons/nexture/ni-cols";
import NiCross from "@/icons/nexture/ni-cross";
import NiEllipsisVertical from "@/icons/nexture/ni-ellipsis-vertical";
import NiEyeInactive from "@/icons/nexture/ni-eye-inactive";
import NiFilter from "@/icons/nexture/ni-filter";
import NiFilterPlus from "@/icons/nexture/ni-filter-plus";
import NiSearch from "@/icons/nexture/ni-search";
import { apiClient } from "@/lib/api-client";
import { isAdminUser, normalizeAvatarUrl } from "@/lib/auth";

type Project = { id: string; name: string; municipality: string };
type UserUsage = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalQuestions: number;
};
type User = {
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
type ViewMode = "list" | "grid";
type RoleFilter = "all" | "admin" | "project-user";
type StatusFilter = "all" | "active" | "inactive" | "pending";

const ROWS_PER_PAGE = 10;

function formatDate(value?: string) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function formatStatus(value?: string) {
  if (!value) return "Unknown";
  const normalized = value.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function getRoleKey(role: string) {
  return role === "admin" ? "admin" : "project-user";
}

function getStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "active") return "success";
  if (normalizedStatus === "pending") return "primary";
  return "warning";
}

function formatTokens(value?: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; userId: string } | null>(null);

  const orderedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      return 0;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return orderedUsers.filter((user) => {
      const searchableText = [
        user.name,
        user.email,
        user.company,
        user.role,
        user.projects.map((project) => project.name).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || getRoleKey(user.role) === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, orderedUsers]);

  const sortedUsers = useMemo(() => {
    if (!sortModel.length) return [...filteredUsers];

    return [...filteredUsers].sort((a, b) => {
      const { field, sort } = sortModel[0];
      const valueA = String(a[field as keyof User] ?? "").toLowerCase();
      const valueB = String(b[field as keyof User] ?? "").toLowerCase();
      return sort === "desc" ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
    });
  }, [filteredUsers, sortModel]);

  const paginatedUsers = useMemo(() => {
    const startIndex = page * ROWS_PER_PAGE;
    return sortedUsers.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [page, sortedUsers]);
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / ROWS_PER_PAGE));

  const handleResetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(0);
    setSortModel([]);
  };

  const getRowSpacing = useCallback((params: GridRowSpacingParams) => {
    return {
      top: params.isFirstVisible ? 0 : 3,
      bottom: 3,
    };
  }, []);

  const columns: GridColDef<User>[] = [
    {
      field: "avatar",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar
          src={normalizeAvatarUrl(params.row.profileImage || params.row.image || undefined)}
          alt={params.row.name}
          sx={{ width: 32, height: 32 }}
        >
          {params.row.name?.charAt(0) ?? "U"}
        </Avatar>
      ),
    },
    {
      field: "name",
      headerName: "User",
      minWidth: 220,
      flex: 1.2,
      renderCell: (params) => (
        <Box className="flex flex-col py-2">
          <Typography className="font-semibold">{params.row.name}</Typography>
          <Typography variant="body2" className="text-text-secondary">
            {params.row.email}
          </Typography>
        </Box>
      ),
    },
    {
      field: "company",
      headerName: "Company",
      minWidth: 160,
      flex: 1,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "role",
      headerName: "Role",
      minWidth: 140,
      flex: 0.8,
      renderCell: (params) => (
        <Chip label={params.value === "admin" ? "Admin" : "Project user"} size="small" variant="outlined" />
      ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.8,
      renderCell: (params) => (
        <Chip label={formatStatus(params.value)} size="small" color={getStatusColor(params.value)} />
      ),
    },
    {
      field: "projects",
      headerName: "Projects",
      minWidth: 240,
      flex: 1.3,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const projects = params.row.projects;
        const visibleProjects = projects.slice(0, 2);
        const remainingCount = projects.length - visibleProjects.length;

        return (
          <Box className="flex max-w-full flex-wrap items-center gap-1 py-2">
            {projects.length ? (
              <>
                {visibleProjects.map((project: Project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}/dashboard`}
                    className="border-divider text-primary hover:bg-primary/10 rounded-full border px-2.5 py-1 text-xs font-medium no-underline transition"
                  >
                    {project.name}
                  </Link>
                ))}
                {remainingCount > 0 && (
                  <Chip label={`+${remainingCount}`} size="small" variant="outlined" />
                )}
              </>
            ) : (
              <Typography variant="body2" className="text-text-secondary">
                No projects
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "usage",
      headerName: "Tokens used",
      minWidth: 150,
      flex: 1,
      sortable: true,
      filterable: false,
      sortComparator: (a, b) => (a?.totalTokens ?? 0) - (b?.totalTokens ?? 0),
      renderCell: (params) => {
        const usage = params.row.usage as UserUsage | undefined;
        const total = usage?.totalTokens ?? 0;
        return (
          <Tooltip
            title={
              total > 0
                ? `Input: ${formatTokens(usage?.totalInputTokens)} · Output: ${formatTokens(usage?.totalOutputTokens)} · Questions: ${usage?.totalQuestions ?? 0}`
                : "No usage yet"
            }
            arrow
          >
            <Box className="flex flex-col py-2">
              <Typography className="font-semibold">{formatTokens(total)}</Typography>
              <Typography variant="body2" className="text-text-secondary">
                {usage?.totalQuestions ?? 0} questions
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: "actions",
      headerName: "Action",
      minWidth: 90,
      align: "left",
      headerAlign: "left",
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box className="flex items-center py-2">
          <IconButton
            size="small"
            aria-label={`Actions for ${params.row.name}`}
            onClick={(event) => setMenuAnchor({ el: event.currentTarget, userId: params.row.id })}
            sx={{
              color: "text.secondary",
              transition: "all 0.2s ease",
              "&:hover": {
                color: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  useEffect(() => {
    setPage(0);
  }, [searchTerm, roleFilter, statusFilter]);

  const loadUsers = useCallback(async () => {
    if (!isAdminUser()) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<any[]>(`/api/projects/admin/users`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUser()) {
      router.replace(DEFAULTS.appRoot);
      return;
    }
    void loadUsers();
  }, [loadUsers, router]);

  if (!isAdminUser()) return null;

  return (
    <Box className="flex w-full flex-col gap-6">
      <Box>
        <Typography variant="h2" component="h1">
          Users
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          Review user access, account status, and project assignments.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Card className="bg-background-paper shadow-darker-xs rounded-3xl">
        <CardContent className="flex flex-col gap-4 p-4 md:p-6">
          <Box className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* filters - shown in both views */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} className="flex-1 flex-wrap gap-2 md:gap-3">
              <TextField
                label="Search users"
                placeholder="Name, email, company, project"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                size="small"
                className="min-w-[260px]"
              />
              <FormControl size="small" className="min-w-[180px]">
                <InputLabel id="role-filter-label">Role</InputLabel>
                <Select
                  labelId="role-filter-label"
                  value={roleFilter}
                  label="Role"
                  onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                >
                  <MenuItem value="all">All roles</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="project-user">Project user</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" className="min-w-[180px]">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  label="Status"
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <MenuItem value="all">All status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} className="flex-wrap gap-2">
              <ToggleButtonGroup
                color="primary"
                size="small"
                value={viewMode}
                exclusive
                onChange={(_event, nextView) => {
                  if (nextView) setViewMode(nextView);
                }}
              >
                <ToggleButton value="list">List view</ToggleButton>
                <ToggleButton value="grid">Grid view</ToggleButton>
              </ToggleButtonGroup>
              <Button variant="surface" onClick={handleResetFilters}>
                Reset filters
              </Button>
            </Stack>
          </Box>

          {loading ? (
            <Box className="flex items-center justify-center py-16">
              <CircularProgress size={28} />
            </Box>
          ) : viewMode === "list" ? (
            <Box className="w-full overflow-hidden">
              <DataGrid
                rows={sortedUsers}
                columns={columns}
                getRowId={(row) => row.id}
                autoHeight
                disableRowSelectionOnClick
                getRowSpacing={getRowSpacing}
                rowHeight={48}
                columnHeaderHeight={40}
                className="full-page dense border-none"
                pagination
                pageSizeOptions={[10, 20, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: ROWS_PER_PAGE } },
                }}
                sortModel={sortModel}
                onSortModelChange={(model) => setSortModel(model)}
                sx={{
                  "& .MuiTablePagination-displayedRows": { display: "none" },
                }}
                slotProps={{
                  panel: { className: "mt-1!" },
                  main: { className: "overflow-visible" },
                }}
                slots={{
                  basePagination: DataGridPaginationFullPage,
                  columnSortedDescendingIcon: () => <NiArrowDown size="small" />,
                  columnSortedAscendingIcon: () => <NiArrowUp size="small" />,
                  columnFilteredIcon: () => <NiFilterPlus size="small" />,
                  columnReorderIcon: () => <NiChevronLeftRightSmall size="small" />,
                  columnMenuIcon: () => <NiEllipsisVertical size="small" />,
                  columnMenuSortAscendingIcon: NiArrowUp,
                  columnMenuSortDescendingIcon: NiArrowDown,
                  columnMenuFilterIcon: NiFilter,
                  columnMenuHideIcon: NiEyeInactive,
                  columnMenuClearIcon: NiCross,
                  columnMenuManageColumnsIcon: NiCols,
                  filterPanelDeleteIcon: NiCross,
                  filterPanelRemoveAllIcon: NiBinEmpty,
                  quickFilterIcon: () => <NiSearch size="medium" />,
                  quickFilterClearIcon: () => <NiCross size="medium" />,
                  baseButton: (props) => <Button {...props} variant="pastel" color="grey" />,
                  baseSelect: (props: any) => {
                    const propsCasted = props as SelectProps;
                    return (
                      <FormControl size="small" variant="outlined">
                        <InputLabel>{propsCasted.label}</InputLabel>
                        <Select
                          {...propsCasted}
                          IconComponent={NiChevronDownSmall}
                          MenuProps={{ className: "outlined" }}
                        />
                      </FormControl>
                    );
                  },
                }}
              />
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {!loading && viewMode === "grid" && (
        <Box className="flex flex-col gap-4">
          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedUsers.length === 0 ? (
              <Box className="bg-background-paper shadow-darker-xs animate-in fade-in zoom-in-95 col-span-full flex flex-col items-center justify-center gap-2 rounded-4xl p-12 text-center duration-500">
                <Typography variant="body1" className="text-text-secondary">
                  No users match the current filters.
                </Typography>
              </Box>
            ) : (
              paginatedUsers.map((user, index) => (
                <Box
                  key={user.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${150 + index * 75}ms` }}
                >
                  <Card
                    onClick={() => router.push(`/users/${user.id}`)}
                    className="h-full w-full cursor-pointer rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
                    sx={{
                      background:
                        "linear-gradient(145deg, hsl(var(--background-paper) / 0.92), hsl(var(--background-paper) / 0.78))",
                      backdropFilter: "blur(4px)",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
                    }}
                  >
                    <CardContent className="flex h-full flex-col gap-4 p-6">
                      <Box className="flex items-start justify-between gap-2">
                        <Box className="flex items-center gap-3">
                          <Avatar
                            alt={user.name}
                            src={normalizeAvatarUrl(user.profileImage || user.image || undefined)}
                            sx={{ width: 48, height: 48 }}
                          >
                            {user.name?.charAt(0) ?? "U"}
                          </Avatar>
                          <Box className="flex flex-col gap-1">
                            <Typography className="font-semibold">{user.name}</Typography>
                            <Typography variant="body2" className="text-text-secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip label={formatStatus(user.status)} size="small" color={getStatusColor(user.status)} />
                      </Box>

                      <Box className="flex flex-wrap gap-2">
                        <Chip
                          label={user.role === "admin" ? "Admin" : "Project user"}
                          size="small"
                          variant="outlined"
                        />
                        <Chip label={user.company || "-"} size="small" variant="outlined" />
                      </Box>

                      <Box className="flex flex-col gap-1">
                        <Typography variant="body2" className="font-semibold">
                          Projects
                        </Typography>
                        {user.projects.length ? (
                          <Box className="flex flex-wrap items-center gap-1">
                            {user.projects.slice(0, 2).map((project) => (
                              <Link
                                key={project.id}
                                href={`/projects/${project.id}/dashboard`}
                                onClick={(event) => event.stopPropagation()}
                                className="border-divider text-primary hover:bg-primary/10 rounded-full border px-2.5 py-1 text-xs font-medium no-underline transition"
                              >
                                {project.name}
                              </Link>
                            ))}
                            {user.projects.length > 2 && (
                              <Chip
                                label={`+${user.projects.length - 2}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" className="text-text-secondary">
                            No projects
                          </Typography>
                        )}
                      </Box>

                      <Box className="flex items-center gap-4">
                        <Box className="flex flex-col">
                          <Typography variant="body2" className="text-text-secondary">
                            Tokens used
                          </Typography>
                          <Typography className="font-semibold">
                            {formatTokens(user.usage?.totalTokens)}
                          </Typography>
                        </Box>
                        <Box className="flex flex-col">
                          <Typography variant="body2" className="text-text-secondary">
                            Questions
                          </Typography>
                          <Typography className="font-semibold">
                            {user.usage?.totalQuestions ?? 0}
                          </Typography>
                        </Box>
                      </Box>

                      <Box className="mt-auto flex justify-end">
                        <Button
                          size="small"
                          variant="pastel"
                          startIcon={<Visibility fontSize="small" />}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/users/${user.id}`);
                          }}
                          className="transition-transform duration-200 hover:scale-105"
                        >
                          View
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))
            )}
          </Box>
          {sortedUsers.length > ROWS_PER_PAGE && (
            <Box className="flex justify-center">
              <Pagination
                count={pageCount}
                page={page + 1}
                onChange={(_event, nextPage) => setPage(nextPage - 1)}
                siblingCount={1}
                boundaryCount={1}
              />
            </Box>
          )}
        </Box>
      )}

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { elevation: 2, sx: { minWidth: 180, borderRadius: 2 } } }}
      >
        <MenuItem
          onClick={() => {
            router.push(`/users/${menuAnchor!.userId}`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>View User</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
