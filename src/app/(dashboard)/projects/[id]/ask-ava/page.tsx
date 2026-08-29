"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowBack, AutoAwesome, Fullscreen, FullscreenExit, PushPin } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from "@mui/material";

import AvaChart from "@/components/ask-ava/ava-chart";
import AvaMarkdown from "@/components/ask-ava/ava-markdown";
import AvaTable from "@/components/ask-ava/ava-table";
import { useAvaUsage } from "@/components/ask-ava/ava-usage-context";
import type { AvaMessage, AvaUsage, StartupQuestion } from "@/components/ask-ava/types";
import { useTypewriter } from "@/hooks/use-typewriter";
import { AquaVista } from "@/lib/AquaVista";
import { apiClient } from "@/lib/api-client";
import { isAdminUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ChatRecord = {
  _id: string;
  title: string;
  messages: (Omit<AvaMessage, "id"> & { createdAt?: string; _id?: string })[];
};

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
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "groq" | "ollama">("gemini");
  const [startupQuestions, setStartupQuestions] = useState<StartupQuestion[]>([]);
  const [viewedUserName, setViewedUserName] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const typewriter = useTypewriter();
  const { reset: resetTypewriter, enqueue: enqueueTypewriter } = typewriter;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminUser();
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

    try {
      const payload = await apiClient.post<{ messages: (AvaMessage & { _id?: string })[]; usage?: AvaUsage }>(
        `/api/projects/${encodeURIComponent(projectId)}/ava/chats/${encodeURIComponent(chatId)}/messages`,
        { content: contentToSend, provider: selectedProvider },
      );
      const assistantMessages = payload.messages.filter((item) => item.role === "assistant");
      const mappedAssistant = assistantMessages.map((item, index) => ({
        id: item._id || `${Date.now()}-${index}`,
        role: item.role,
        content: item.content,
        type: item.type,
        title: item.title,
        tableData: item.tableData,
        chartData: item.chartData,
      }));
      setMessages((prev) => [...prev, ...mappedAssistant]);
      typewriter.enqueue(mappedAssistant.map((m) => ({ id: m.id, content: m.content })));
      if (payload.usage) setUsage(payload.usage);
    } catch (err: any) {
      console.error(err);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const inputDisabled = isLoading || !chatId || isAdminViewingUser || Boolean(usage?.limitReached);
  const showStartupIntro = !isAdminViewingUser && messages.length <= 1 && startupQuestions.length > 0;

  return (
    <Box className="flex w-full flex-col gap-4">
      <Box className="animate-in fade-in slide-in-from-top-2 flex items-center justify-between duration-500">
        <Box>
          <Typography variant="h4" component="h2">
            Ask {AquaVista.assistantName}
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            {chatTitle}
          </Typography>
        </Box>
        <Box className="flex items-center gap-2">
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
            : isAdminViewingUser
              ? "h-[calc(100vh-12rem)]"
              : "h-[calc(100vh-22rem)]",
        )}
      >
        <Box className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <IconButton
            size="small"
            onClick={() => setIsMaximized((prev) => !prev)}
            title={isMaximized ? "Exit full view" : "Expand chat to full view"}
            className="transition-transform duration-200 hover:scale-110"
            sx={{
              color: "text.secondary",
              "&:hover": { color: "primary.main" },
            }}
          >
            {isMaximized ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        </Box>
        <CardContent className="flex h-full flex-col gap-4 p-5">
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

          <Box className="flex-1 space-y-4 overflow-y-auto pr-2">
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
                    "animate-in fade-in flex w-full",
                    message.role === "user" ? "slide-in-from-right justify-end" : "slide-in-from-left-2 justify-start",
                  )}
                  style={{ animationDelay: `${index * 50}ms`, animationDuration: "400ms" }}
                >
                  <Box
                    className={cn(
                      "max-w-[80%] rounded-3xl px-5 py-3 transition-all duration-200",
                      message.role === "user"
                        ? "bg-primary rounded-br-sm text-white hover:shadow-md"
                        : "bg-grey-50 text-text-primary hover:bg-grey-100 rounded-bl-sm",
                    )}
                  >
                    {message.role === "assistant" && (
                      <Box className="mb-2 flex items-center gap-2">
                        <Typography variant="caption" className="text-primary font-semibold">
                          {message.title || "AquaVista Assistant"}
                        </Typography>
                        {message.id !== "welcome" && !isAdminViewingUser && (
                          <IconButton
                            size="small"
                            className="h-6 w-6 transition-transform duration-200 hover:scale-110"
                            onClick={() => handlePin(message)}
                            title={
                              pinnedMessageIds.has(message.id)
                                ? "Unpin from Dashboard"
                                : isAdmin
                                  ? "Pin to Dashboard for all project members"
                                  : "Pin to Dashboard (visible only to you)"
                            }
                          >
                            <PushPin
                              className={cn(
                                "transition-colors duration-200",
                                pinnedMessageIds.has(message.id) ? "text-primary" : "text-text-secondary",
                              )}
                              fontSize="small"
                            />
                          </IconButton>
                        )}
                      </Box>
                    )}
                    {message.content ? (
                      message.role === "assistant" && !typewriter.isStreaming(message.id) ? (
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
                          {message.role === "assistant" && typewriter.isTyping(message.id) && (
                            <span className="av-typing-cursor" aria-hidden="true">
                              &nbsp;
                            </span>
                          )}
                        </Typography>
                      )
                    ) : null}

                    {message.role === "assistant" &&
                    message.type === "table" &&
                    message.tableData &&
                    !typewriter.isTyping(message.id) &&
                    (Array.isArray(message.tableData.columns) || Array.isArray(message.tableData.rows)) ? (
                      <Box className="animate-in fade-in slide-in-from-bottom-2 mt-2 overflow-hidden rounded-xl duration-300">
                        <AvaTable data={message.tableData} />
                      </Box>
                    ) : null}

                    {message.role === "assistant" &&
                    message.type === "chart" &&
                    message.chartData &&
                    !typewriter.isTyping(message.id) ? (
                      <Box className="animate-in fade-in slide-in-from-bottom-2 mt-2 overflow-hidden rounded-xl duration-300">
                        <AvaChart data={message.chartData} />
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              ))
            )}

            {isThinking && (
              <Box className="animate-in fade-in slide-in-from-left-2 flex w-full justify-start duration-300">
                <Box className="bg-grey-50 text-text-primary rounded-3xl rounded-bl-sm px-5 py-3">
                  <Typography variant="body2">AVA is thinking...</Typography>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {!isAdminViewingUser ? (
            <Box className="mt-auto flex flex-col gap-1 pt-2">
              <Box className="flex items-center gap-2">
                <FormControl sx={{ minWidth: { xs: 150, sm: 200 } }} size="small">
                  <Select
                    value={selectedProvider}
                    onChange={(event: SelectChangeEvent<"gemini" | "groq" | "ollama">) => {
                      setSelectedProvider(event.target.value);
                    }}
                    className="rounded-2xl"
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": { borderRadius: "1rem" },
                    }}
                  >
                    <MenuItem value="gemini">⚡ Google Gemini</MenuItem>
                    <MenuItem value="groq">🚀 Groq - Llama 3.3</MenuItem>
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
