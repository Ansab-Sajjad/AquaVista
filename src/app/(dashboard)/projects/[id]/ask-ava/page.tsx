"use client";

import dayjs from "dayjs";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AccountTree, ArrowBack, AutoAwesome, Check, ContentCopy, Fullscreen, FullscreenExit, PushPin, Science, WarningAmber } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AvaChart from "@/components/ask-ava/ava-chart";
import AvaMarkdown from "@/components/ask-ava/ava-markdown";
import AvaTable from "@/components/ask-ava/ava-table";
import { useAvaUsage } from "@/components/ask-ava/ava-usage-context";
import type { AvaMessage, AvaSource, AvaTableData, AvaUsage, StartupQuestion } from "@/components/ask-ava/types";
import { useTypewriter } from "@/hooks/use-typewriter";
import { apiClient, API_BASE_URL } from "@/lib/api-client";
import { AquaVista } from "@/lib/AquaVista";
import { getStoredAuthUser, isAdminUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ChatRecord = {
  _id: string;
  title: string;
  messages: (Omit<AvaMessage, "id"> & { createdAt?: string; _id?: string })[];
};

/** Normalizes sources from the backend (may be stored as [Mixed] array or single object). */
function normalizeSources(value: unknown): AvaSource[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as AvaSource[];
  return [value as AvaSource];
}

/** Two-letter initials for the user avatar (matches the theme's user menu). */
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Collapsible panel showing how each number was computed (Item 6). */
function EvidenceTracePanel({ traces }: { traces: AvaMessage["evidenceTrace"] }) {
  const [expanded, setExpanded] = useState(false);
  if (!traces || traces.length === 0) return null;
  return (
    <Box className="animate-in fade-in mt-1 duration-300">
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        className="text-text-secondary"
        startIcon={<Science fontSize="small" />}
        sx={{ textTransform: "none", fontSize: "0.75rem" }}
      >
        {expanded ? "Hide evidence" : `Show evidence (${traces.length})`}
      </Button>
      {expanded ? (
        <Box className="mt-1 flex flex-col gap-1.5 rounded-lg bg-bg-secondary p-2">
          {traces.map((trace, i) => (
            <Box key={i} className="flex flex-col gap-0.5 border-l-2 border-primary/30 pl-2">
              <Typography variant="caption" className="font-medium text-text-primary">
                {trace.op} · {trace.fileName}
              </Typography>
              {trace.filterDescription ? (
                <Typography variant="caption" className="text-text-secondary">
                  Filter: {trace.filterDescription}
                </Typography>
              ) : null}
              <Typography variant="caption" className="text-text-secondary">
                Matched rows: {trace.matchedRows}
                {trace.valueColumn ? ` · Value column: ${trace.valueColumn}` : ""}
                {trace.groupByColumn ? ` · Grouped by: ${trace.groupByColumn}` : ""}
              </Typography>
              {trace.yearColumns && trace.yearColumns.length > 0 ? (
                <Typography variant="caption" className="text-text-secondary">
                  Year columns: {trace.yearColumns.join(", ")}
                </Typography>
              ) : null}
              {trace.notes ? (
                <Typography variant="caption" className="text-text-secondary italic">
                  {trace.notes}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

/** Collapsible panel showing the structured plan (Item 7). */
function PlanPreviewPanel({ plan }: { plan: AvaMessage["plan"] }) {
  const [expanded, setExpanded] = useState(false);
  if (!plan || !plan.steps || plan.steps.length === 0) return null;
  return (
    <Box className="animate-in fade-in mt-1 duration-300">
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        className="text-text-secondary"
        startIcon={<AccountTree fontSize="small" />}
        sx={{ textTransform: "none", fontSize: "0.75rem" }}
      >
        {expanded ? "Hide plan" : `Show plan (${plan.steps.length} steps · ${plan.mode})`}
      </Button>
      {expanded ? (
        <Box className="mt-1 flex flex-col gap-1.5 rounded-lg bg-bg-secondary p-2">
          <Typography variant="caption" className="text-text-secondary">
            {plan.rationale}
          </Typography>
          {plan.steps.map((step, i) => (
            <Box key={i} className="flex flex-col gap-0.5 border-l-2 border-primary/30 pl-2">
              <Typography variant="caption" className="font-medium text-text-primary">
                {i + 1}. {step.op} — {step.label}
              </Typography>
              {step.filter ? (
                <Typography variant="caption" className="text-text-secondary">
                  Filter: {step.filter.column} = &quot;{step.filter.equals}&quot;
                </Typography>
              ) : null}
              {step.valueColumn ? (
                <Typography variant="caption" className="text-text-secondary">
                  Value: {step.valueColumn}
                  {step.groupBy ? ` · Grouped by: ${step.groupBy}` : ""}
                </Typography>
              ) : null}
              {step.yearColumns && step.yearColumns.length > 0 ? (
                <Typography variant="caption" className="text-text-secondary">
                  Years: {step.yearColumns.join(", ")}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

// The Mongoose schema stores `tableData` as `[Schema.Types.Mixed]`, so a single
// table object gets persisted/returned as an array with one element. Normalize
// it back to a flat list of table objects so AvaTable can render each one.
function normalizeTableData(value: AvaTableData | AvaTableData[] | undefined): AvaTableData[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (entry) => entry && (Array.isArray(entry.columns) || Array.isArray(entry.rows)),
    );
  }
  return [value];
}

const WELCOME_MESSAGE: AvaMessage = {
  id: "welcome",
  role: "assistant",
  content: `Hi, I'm ${AquaVista.assistantName} — your ${AquaVista.assistantFullName}. Ask me anything about this project's uploaded data and municipal finance. I'll stay grounded in the data and tell you when I don't know.`,
};

export default function AskAvaPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = (params?.id as string) || "";
  const requestedUserId = searchParams.get("userId");
  const [messages, setMessages] = useState<AvaMessage[]>([WELCOME_MESSAGE]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("New conversation");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "groq" | "ollama" | "openai">("openai");
  const [startupQuestions, setStartupQuestions] = useState<StartupQuestion[]>([]);
  const [viewedUserName, setViewedUserName] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const typewriter = useTypewriter();
  const { reset: resetTypewriter, enqueue: enqueueTypewriter } = typewriter;

  // Track messages being streamed via SSE (separate from typewriter animation).
  // While a message ID is in this set, render as plain text (not markdown) since
  // the content is incomplete and markdown rendering would look broken mid-stream.
  const [streamingMessageIds, setStreamingMessageIds] = useState<Set<string>>(new Set());
  const isMessageStreaming = useCallback(
    (id: string) => streamingMessageIds.has(id) || typewriter.isStreaming(id),
    [streamingMessageIds, typewriter],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminUser();
  const authUser = getStoredAuthUser();
  const userInitials = initials(String(authUser?.name || authUser?.email || "You"));
  const isAdminViewingUser = Boolean(requestedUserId) && isAdmin;
  const { usage, setUsage } = useAvaUsage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typewriter.progress]);

  const fetchStartupQuestions = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiClient.get<StartupQuestion[]>(
        `/api/projects/${encodeURIComponent(projectId)}/ava/startup-questions`,
      );
      setStartupQuestions(data);
    } catch {
      // Non-critical; ignore
    }
  }, [projectId]);

  const fetchProjectName = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiClient.get<any>(`/api/projects/${encodeURIComponent(projectId)}`);
      setProjectName(data.name || null);
    } catch {
      // Non-critical; ignore
    }
  }, [projectId]);

  const fetchViewedUser = useCallback(async () => {
    if (!requestedUserId) return;
    try {
      const data = await apiClient.get<any>(`/api/projects/admin/users/${encodeURIComponent(requestedUserId)}`);
      setViewedUserName(data.name || data.email || "this user");
    } catch {
      // Non-critical; ignore
    }
  }, [requestedUserId]);

  const loadChat = useCallback(
    async (selectedChatId: string, title: string) => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);
      resetTypewriter();

      try {
        const chat = await apiClient.get<ChatRecord>(
          `/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(selectedChatId)}${requestedUserId ? `?userId=${encodeURIComponent(requestedUserId)}` : ""}`,
        );

        setChatId(selectedChatId);
        setChatTitle(title);

        const persistedMessages: AvaMessage[] = chat.messages.map((message, index) => ({
          id: message._id || `${message.role}-${index}-${message.createdAt?.toString() ?? Date.now().toString()}`,
          role: message.role,
          content: message.content,
          type: message.type,
          title: message.title,
          tableData: message.tableData,
          chartData: message.chartData,
          warnings: message.warnings,
          sources: message.sources,
          plan: message.plan,
          evidenceTrace: message.evidenceTrace,
          costUsd: message.costUsd,
          model: message.model,
          createdAt: message.createdAt,
        }));

        if (persistedMessages.length > 0) {
          setMessages(persistedMessages);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }

        // Fetch pinned message ids for this chat
        try {
          const pinnedData = await apiClient.get<{ pinnedMessageIds: string[] }>(
            `/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(selectedChatId)}/pinned-messages`,
          );
          setPinnedMessageIds(new Set(pinnedData.pinnedMessageIds || []));
        } catch (err) {
          console.error("Failed to load pinned chat status:", err);
          // Continue without pinned state
        }
      } catch (err) {
        console.error(err);
        setError("Unable to load Ask AVA conversation. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, requestedUserId, resetTypewriter],
  );

  useEffect(() => {
    async function fetchChat() {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const chats = await apiClient.get<any[]>(
          `/api/projects/${encodeURIComponent(projectId)}/ava/chats${requestedUserId ? `?userId=${encodeURIComponent(requestedUserId)}` : ""}`,
        );

        let selectedChat = chats[0];

        if (!selectedChat) {
          if (isAdminViewingUser) {
            setChatId(null);
            setChatTitle("No conversation found");
            setMessages([WELCOME_MESSAGE]);
            setError("No Ask AVA conversations were found for this user in this project yet.");
            return;
          }

          selectedChat = await apiClient.post<any>(`/api/projects/${encodeURIComponent(projectId)}/ava/chats`, {
            title: "Ask AVA conversation",
          });
        }

        if (!selectedChat) {
          throw new Error("No Ask AVA chat available");
        }

        await loadChat(selectedChat._id, selectedChat.title || "New conversation");
      } catch (err) {
        console.error(err);
        setError("Unable to load Ask AVA. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchChat();
  }, [projectId, isAdminViewingUser, requestedUserId, loadChat]);

  // Load startup questions + viewed user name on mount (usage is fetched by the shared AvaUsageProvider)
  useEffect(() => {
    if (!isAdminViewingUser) {
      void fetchStartupQuestions();
      void fetchProjectName();
    } else {
      void fetchViewedUser();
    }
  }, [fetchStartupQuestions, fetchProjectName, fetchViewedUser, isAdminViewingUser]);

  const sendMessage = async (overrideContent?: string) => {
    if (isAdminViewingUser) {
      setError("This view is read-only. You can review the selected user's Ask AVA history here.");
      return;
    }

    if (usage?.limitReached) return;

    const contentToSend = (overrideContent ?? input).trim();
    if (!contentToSend || isThinking || !projectId || !chatId) return;

    const userMessage: AvaMessage = { id: String(Date.now()), role: "user", content: contentToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);
    setError(null);

    // Create a placeholder assistant message that we'll update as deltas arrive
    const assistantId = String(Date.now() + 1);
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
    setStreamingMessageIds((prev) => new Set(prev).add(assistantId));

    try {
      // Use the streaming SSE endpoint for real-time narrative streaming
      const streamUrl = `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(chatId)}/messages/stream`;
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentToSend, provider: selectedProvider }),
        credentials: "include",
      });

      if (!response.ok || !response.body) {
        // Fall back to non-streaming endpoint if streaming fails
        const errorText = await response.text().catch(() => "");
        throw new Error(`Stream failed (${response.status}): ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let finalMessage: (AvaMessage & { _id?: string }) | null = null;
      let finalUsage: AvaUsage | undefined;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? ""; // keep incomplete event

        for (const event of events) {
          const lines = event.split("\n");
          let eventType = "";
          let eventData = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }
          if (!eventType || !eventData) continue;

          try {
            const parsed = JSON.parse(eventData);
            if (eventType === "delta" && parsed.text) {
              accumulatedText += parsed.text;
              // Update the placeholder message with accumulated text
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText } : m)),
              );
            } else if (eventType === "done") {
              // Final event — replace placeholder with the complete validated message
              if (parsed.messages) {
                const assistantMessages = parsed.messages.filter((item: AvaMessage & { _id?: string }) => item.role === "assistant");
                if (assistantMessages.length > 0) {
                  finalMessage = assistantMessages[0];
                }
              }
              if (parsed.usage) finalUsage = parsed.usage;
            } else if (eventType === "error") {
              throw new Error(parsed.message || "AVA streaming error");
            }
          } catch (e) {
            // If it's our thrown error, re-throw
            if (e instanceof Error && e.message.includes("streaming error")) throw e;
            // Otherwise ignore JSON parse errors on partial data
          }
        }
      }

      // Replace the placeholder with the final validated message
      if (finalMessage) {
        const mapped: AvaMessage = {
          id: finalMessage._id || assistantId,
          role: "assistant",
          content: finalMessage.content,
          type: finalMessage.type,
          title: finalMessage.title,
          tableData: finalMessage.tableData,
          chartData: finalMessage.chartData,
          warnings: finalMessage.warnings,
          sources: normalizeSources(finalMessage.sources),
          plan: finalMessage.plan,
          evidenceTrace: finalMessage.evidenceTrace,
          costUsd: finalMessage.costUsd,
          model: finalMessage.model,
          createdAt: finalMessage.createdAt || new Date().toISOString(),
        };
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? mapped : m)));
      }
      // Remove from streaming set — content is now final, render as markdown
      setStreamingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(assistantId);
        return next;
      });
      if (finalUsage) setUsage(finalUsage);
    } catch (err: any) {
      console.error(err);
      // Remove the placeholder message and streaming state on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setStreamingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(assistantId);
        return next;
      });
      if (err?.status === 429 && err?.data?.usage) {
        setUsage(err.data.usage);
      }
      setError(err?.message || "AVA is temporarily unavailable. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const handlePin = async (message: AvaMessage) => {
    if (!projectId || !chatId) return;

    const isCurrentlyPinned = pinnedMessageIds.has(message.id);

    if (isCurrentlyPinned) {
      try {
        await apiClient.delete(
          `/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(message.id)}/unpin`,
        );
        setPinnedMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        await apiClient.post(
          `/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(message.id)}/pin`,
          {
            content: message.content,
            type: message.type || "narrative",
            title: message.title || "AquaVista Assistant",
            tableData: message.tableData,
            chartData: message.chartData,
          },
        );
        setPinnedMessageIds((prev) => new Set(prev).add(message.id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCopy = async (message: AvaMessage) => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const inputDisabled = isLoading || !chatId || isAdminViewingUser || Boolean(usage?.limitReached);
  const showStartupIntro = !isAdminViewingUser && messages.length <= 1 && startupQuestions.length > 0;
  const usagePercent = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <Box className="flex w-full flex-col gap-4 sm:h-[calc(100vh-10.5rem)] md:h-[calc(100vh-11.5rem)]">
      <Box className="animate-in fade-in slide-in-from-top-2 flex shrink-0 items-center justify-between duration-500">
        <Box>
          <Typography variant="h4" component="h2">
            Ask {AquaVista.assistantName}
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            {chatTitle}
          </Typography>
        </Box>
        <Box className="flex items-center gap-2">
          {!isAdminViewingUser && usage ? (
            <Box className="w-40 sm:w-48">
              <Box className="mb-0.5 flex items-center justify-between">
                <Typography variant="caption" className="text-text-secondary font-medium">
                  Ask AVA usage
                </Typography>
                <Typography
                  variant="caption"
                  className={cn("font-semibold", usage.limitReached ? "text-error" : "text-text-secondary")}
                >
                  {usage.used}/{usage.limit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={usagePercent}
                color={usage.limitReached ? "error" : usagePercent >= 80 ? "warning" : "primary"}
                className="rounded-full"
                sx={{ height: 6, borderRadius: 999 }}
              />
            </Box>
          ) : null}
          {isAdminViewingUser && (
            <Button
              startIcon={<ArrowBack />}
              onClick={() =>
                router.push(requestedUserId ? `/users/${requestedUserId}` : `/projects/${projectId}/users`)
              }
              variant="outlined"
              className="w-fit transition-transform duration-200 hover:scale-105"
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
              Back to Users
            </Button>
          )}
        </Box>
      </Box>

      {isMaximized && (
        <Box
          onClick={() => setIsMaximized(false)}
          className="animate-in fade-in fixed inset-0 z-[1299] bg-black/40 backdrop-blur-sm duration-200"
        />
      )}

      <Card
        className={cn(
          "bg-background-paper shadow-darker-xs animate-in fade-in slide-in-from-bottom-3 relative flex flex-col rounded-3xl transition-all delay-100 duration-300 duration-500 hover:shadow-md",
          isMaximized
            ? "fixed inset-3 z-[1300] h-auto w-auto shadow-2xl"
            : cn(
                "sm:h-auto sm:min-h-0 sm:flex-1",
                isAdminViewingUser ? "h-[calc(100vh-12rem)]" : "h-[calc(100vh-22rem)]",
              ),
        )}
      >
        {/* Chat header bar */}
        <Box className="border-grey-50 flex flex-none items-center justify-between border-b px-5 py-3">
          <Box className="flex items-center gap-2.5">
            <Avatar className="bg-primary/10 text-primary h-9 w-9">
              <AutoAwesome fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" className="leading-tight font-bold">
                {AquaVista.assistantName}
              </Typography>
              <Typography variant="caption" className="text-text-secondary flex items-center gap-1.5">
                <span className="bg-success inline-block h-1.5 w-1.5 rounded-full" />
                {AquaVista.assistantFullName}
              </Typography>
            </Box>
          </Box>
          <Tooltip title={isMaximized ? "Exit full view" : "Expand chat to full view"}>
            <IconButton
              size="small"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="transition-transform duration-200 hover:scale-110"
              sx={{
                color: "text.secondary",
                "&:hover": { color: "primary.main" },
              }}
            >
              {isMaximized ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-5 pt-4">
          {isAdminViewingUser ? (
            <Box className="text-text-secondary text-sm">
              Viewing chats for {viewedUserName || "this user"}. This panel is read-only.
            </Box>
          ) : null}

          {/* Usage limit reached banner */}
          {!isAdminViewingUser && usage?.limitReached ? (
            <Alert severity="warning">
              You have reached your Ask AVA usage limit for today. Please contact your Admin or try again later.
            </Alert>
          ) : null}

          <Box className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
            {isLoading ? (
              <Box className="bg-grey-50 text-text-secondary animate-in fade-in rounded-3xl p-6 text-center duration-300">
                <Typography>Loading Ask AVA conversation...</Typography>
              </Box>
            ) : null}

            {error ? (
              <Box className="bg-error/10 text-error animate-in fade-in slide-in-from-top-2 rounded-3xl p-4 duration-300">
                <Typography>{error}</Typography>
              </Box>
            ) : null}

            {/* First-visit empty state: show startup questions (if configured for this
                project) instead of the generic welcome message. */}
            {showStartupIntro ? (
              <Box className="animate-in fade-in flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center duration-500">
                <Box className="bg-primary/10 text-primary mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                  <AutoAwesome fontSize="medium" />
                </Box>
                <Typography variant="h6" className="text-primary font-bold">
                  Ask {AquaVista.assistantName} about {projectName || "this project"}
                </Typography>
                <Typography variant="body2" className="text-text-secondary mb-2">
                  Review financial, billing, and CIP data. Try a question to get started.
                </Typography>
                <Box className="flex flex-col items-center gap-2">
                  {startupQuestions.map((question, index) => (
                    <Chip
                      key={question._id || index}
                      label={question.text}
                      variant="outlined"
                      color="primary"
                      clickable
                      onClick={() => void sendMessage(question.text)}
                      disabled={isThinking || inputDisabled}
                      className="animate-in fade-in zoom-in-95 transition-all duration-200 hover:scale-105 hover:shadow-sm"
                      style={{ animationDelay: `${200 + index * 50}ms`, animationDuration: "300ms" }}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              messages.map((message, index) => (
                <Box
                  key={message.id}
                  className={cn(
                    "animate-in fade-in flex w-full items-start gap-2.5",
                    message.role === "user" ? "slide-in-from-right flex-row-reverse" : "slide-in-from-left-2",
                  )}
                  style={{ animationDelay: `${index * 50}ms`, animationDuration: "400ms" }}
                >
                  {message.role === "user" ? (
                    <Avatar className="bg-grey-200 text-text-primary mt-1 h-9 w-9 flex-none text-xs font-semibold">
                      {userInitials}
                    </Avatar>
                  ) : (
                    <Avatar className="bg-primary/10 text-primary mt-1 h-9 w-9 flex-none">
                      <AutoAwesome fontSize="small" />
                    </Avatar>
                  )}

                  <Box
                    className={cn(
                      "rounded-3xl px-5 py-3 transition-all duration-200",
                      message.role === "user"
                        ? "bg-primary max-w-[80%] rounded-tr-sm text-white hover:shadow-md"
                        : "bg-grey-50 text-text-primary hover:bg-grey-100 min-w-0 flex-1 rounded-tl-sm",
                    )}
                  >
                    {message.role === "assistant" && (
                      <Box className="mb-2 flex items-center gap-2">
                        <Typography variant="caption" className="text-primary font-semibold">
                          {message.title || "AquaVista Assistant"}
                        </Typography>
                      </Box>
                    )}
                    {message.content ? (
                      message.role === "assistant" && !isMessageStreaming(message.id) ? (
                        <AvaMarkdown content={message.content} />
                      ) : (
                        <Typography
                          variant="body2"
                          className={cn(
                            "leading-relaxed whitespace-pre-wrap",
                            message.role === "user" ? "text-white" : "text-text-primary",
                          )}
                        >
                          {message.role === "assistant"
                            ? typewriter.getDisplayedContent(message.id, message.content)
                            : message.content}
                          {message.role === "assistant" && (typewriter.isTyping(message.id) || isMessageStreaming(message.id)) && (
                            <span className="av-typing-cursor" aria-hidden="true">
                              &nbsp;
                            </span>
                          )}
                        </Typography>
                      )
                    ) : null}

                    {/* Render the structured table(s) whenever tableData is present,
                        regardless of message.type — some backend responses attach
                        tableData without setting type to "table". The Mongoose
                        schema stores tableData as [Mixed], so a single table may
                        arrive wrapped in an array; normalize before rendering. */}
                    {message.role === "assistant" &&
                    message.tableData &&
                    !isMessageStreaming(message.id) ? (
                      <Box className="animate-in fade-in slide-in-from-bottom-2 mt-2 flex flex-col gap-2 overflow-hidden rounded-xl duration-300">
                        {normalizeTableData(message.tableData).map((table, tableIndex) => (
                          <AvaTable key={tableIndex} data={table} />
                        ))}
                      </Box>
                    ) : null}

                    {message.role === "assistant" && message.chartData && !isMessageStreaming(message.id) ? (
                      <Box className="animate-in fade-in slide-in-from-bottom-2 mt-2 overflow-hidden rounded-xl duration-300">
                        <AvaChart data={message.chartData} />
                      </Box>
                    ) : null}

                    {/* Warnings — non-fatal caveats surfaced from the number guard
                        (unmatched figures, missing data, stale assumptions). */}
                    {message.role === "assistant" &&
                    message.warnings &&
                    message.warnings.length > 0 &&
                    !isMessageStreaming(message.id) ? (
                      <Box className="animate-in fade-in mt-2 flex flex-col gap-1 duration-300">
                        {message.warnings.map((warning, warningIndex) => (
                          <Alert key={warningIndex} severity="warning" icon={<WarningAmber fontSize="small" />}>
                            <Typography variant="caption">{warning}</Typography>
                          </Alert>
                        ))}
                      </Box>
                    ) : null}

                    {/* Sources — provenance list showing which files backed the answer. */}
                    {message.role === "assistant" &&
                    message.sources &&
                    message.sources.length > 0 &&
                    !isMessageStreaming(message.id) ? (
                      <Box className="animate-in fade-in mt-2 flex flex-wrap items-center gap-1 duration-300">
                        <Typography variant="caption" className="text-text-secondary">
                          Sources:
                        </Typography>
                        {message.sources.map((source, sourceIndex) => (
                          <Chip
                            key={sourceIndex}
                            label={source.fileName}
                            size="small"
                            variant="outlined"
                            className="text-text-secondary"
                            title={`${source.fileType}${source.year ? ` · ${source.year}` : ""}`}
                          />
                        ))}
                      </Box>
                    ) : null}

                    {/* Evidence trace (Item 6) — collapsible panel showing how each
                        number was computed. Click to expand for transparency. */}
                    {message.role === "assistant" &&
                    message.evidenceTrace &&
                    message.evidenceTrace.length > 0 &&
                    !isMessageStreaming(message.id) ? (
                      <EvidenceTracePanel traces={message.evidenceTrace} />
                    ) : null}

                    {/* Plan preview (Item 7) — collapsible panel showing the structured
                        plan the LLM produced. Useful for debugging and transparency. */}
                    {message.role === "assistant" &&
                    message.plan &&
                    message.plan.steps &&
                    message.plan.steps.length > 0 &&
                    !isMessageStreaming(message.id) ? (
                      <PlanPreviewPanel plan={message.plan} />
                    ) : null}

                    {/* Cost + model info (Item 3) — small footer showing the model
                        used and the USD cost of this response. */}
                    {message.role === "assistant" &&
                    message.id !== "welcome" &&
                    !isMessageStreaming(message.id) &&
                    (message.costUsd != null || message.model) ? (
                      <Box className="animate-in fade-in mt-1 flex flex-row items-center gap-2 duration-300">
                        {message.model ? (
                          <Typography variant="caption" className="text-text-secondary opacity-60">
                            {message.model}
                          </Typography>
                        ) : null}
                        {message.costUsd != null && message.costUsd > 0 ? (
                          <Typography variant="caption" className="text-text-secondary opacity-60">
                            · ${message.costUsd.toFixed(4)}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}

                    {/* Response actions — copy, pin, timestamp. Consistent row under every
                        AVA response (revealed once the typewriter finishes). */}
                    {message.role === "assistant" && message.id !== "welcome" && !isMessageStreaming(message.id) ? (
                      <Box className="animate-in fade-in mt-3 flex flex-row items-center gap-0.5 duration-300">
                        {message.content ? (
                          <Tooltip title={copiedMessageId === message.id ? "Copied" : "Copy response"} arrow>
                            <IconButton
                              size="small"
                              aria-label="Copy response"
                              onClick={() => void handleCopy(message)}
                            >
                              {copiedMessageId === message.id ? (
                                <Check fontSize="small" className="text-success" />
                              ) : (
                                <ContentCopy fontSize="small" className="text-text-secondary" />
                              )}
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {!isAdminViewingUser ? (
                          <Tooltip
                            title={
                              pinnedMessageIds.has(message.id)
                                ? "Unpin from Dashboard"
                                : isAdmin
                                  ? "Pin to Dashboard for all project members"
                                  : "Pin to Dashboard (visible only to you)"
                            }
                            arrow
                          >
                            <IconButton size="small" aria-label="Pin to Dashboard" onClick={() => handlePin(message)}>
                              <PushPin
                                fontSize="small"
                                className={cn(
                                  "transition-colors duration-200",
                                  pinnedMessageIds.has(message.id) ? "text-primary" : "text-text-secondary",
                                )}
                              />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {message.createdAt ? (
                          <Typography
                            variant="body2"
                            className="text-text-disabled ml-1 text-xs"
                            title={dayjs(message.createdAt).format("MMM D, YYYY h:mm A")}
                          >
                            {dayjs(message.createdAt).format("h:mm A")}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              ))
            )}

            {isThinking && (
              <Box className="animate-in fade-in slide-in-from-left-2 flex w-full items-start gap-2.5 duration-300">
                <Avatar className="bg-primary/10 text-primary mt-1 h-9 w-9 flex-none">
                  <AutoAwesome fontSize="small" />
                </Avatar>
                <Box className="bg-grey-50 text-text-primary flex items-center gap-1.5 rounded-3xl rounded-tl-sm px-5 py-4">
                  <Box className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full" />
                  <Box className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                  <Box className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                  <Typography variant="body2" component="span" className="text-text-secondary ml-1 italic">
                    AVA is analysing the data…
                  </Typography>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {!isAdminViewingUser ? (
            <Box className="border-grey-50 mt-auto flex flex-none flex-col gap-1.5 border-t pt-3">
              <Box className="flex items-center gap-2">
                <FormControl sx={{ minWidth: { xs: 150, sm: 200 } }}>
                  <Select
                    value={selectedProvider}
                    onChange={(event: SelectChangeEvent<"gemini" | "groq" | "ollama" | "openai">) => {
                      setSelectedProvider(event.target.value);
                    }}
                    className="rounded-2xl"
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": { borderRadius: "1rem" },
                    }}
                  >
                    <MenuItem value="gemini">⚡ Google Gemini</MenuItem>
                    <MenuItem value="groq">🚀 Groq - Llama 3.3</MenuItem>
                    <MenuItem value="openai">🤖 OpenAI - GPT-4o</MenuItem>
                    <MenuItem value="ollama">🦙 Ollama / OpenRouter - DeepSeek R1</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  multiline={false}
                  maxRows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    usage?.limitReached
                      ? "Ask AVA usage limit reached for today"
                      : "Ask AVA about revenue, expenses, customer classes, rates..."
                  }
                  slotProps={{ input: { className: "rounded-2xl transition-all duration-200 focus-within:shadow-md" } }}
                  disabled={inputDisabled}
                />
                <Button
                  variant="contained"
                  onClick={() => void sendMessage()}
                  disabled={
                    !input.trim() ||
                    isThinking ||
                    isLoading ||
                    !chatId ||
                    isAdminViewingUser ||
                    Boolean(usage?.limitReached)
                  }
                  className="h-14 px-6 transition-transform duration-200 hover:scale-105 disabled:scale-100"
                >
                  Send
                </Button>
              </Box>
              <Typography variant="caption" className="text-text-secondary text-center">
                <strong>Ground rules:</strong> {AquaVista.assistantName} answers questions based on this project&apos;s{" "}
                {AquaVista.terminology.baselineData.toLowerCase()}. It avoids speculation, cites source files, and asks
                for clarification when the data is incomplete.
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
