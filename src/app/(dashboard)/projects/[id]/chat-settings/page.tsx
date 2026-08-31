"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Add, ArrowDownward, ArrowUpward, AutoAwesome, Delete, Replay, Save } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import type { StartupQuestion } from "@/components/ask-ava/types";
import { apiClient } from "@/lib/api-client";
import { isAdminUser } from "@/lib/auth";

export default function ChatSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) || "";
  const [original, setOriginal] = useState<StartupQuestion[]>([]);
  const [drafts, setDrafts] = useState<StartupQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Redirect non-admins away — tab is hidden but guard direct URL access too
  useEffect(() => {
    if (!isAdminUser()) {
      router.replace(`/projects/${projectId}/dashboard`);
    }
  }, [projectId, router]);

  const fetchStartupQuestions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<StartupQuestion[]>(
        `/api/projects/${encodeURIComponent(projectId)}/ava/startup-questions`,
      );
      const normalized = data.map((q, i) => ({ ...q, order: q.order ?? i }));
      setOriginal(normalized);
      setDrafts(normalized);
    } catch {
      setError("Failed to load startup questions. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchStartupQuestions();
  }, [fetchStartupQuestions]);

  const isDirty = useMemo(
    () =>
      drafts.length !== original.length || drafts.some((q, i) => q.text !== original[i]?.text),
    [drafts, original],
  );

  const hasEmptyQuestion = drafts.some((q) => !q.text.trim());

  const addQuestion = () => {
    setSaved(false);
    setDrafts((prev) => [...prev, { text: "", order: prev.length }]);
  };

  const updateText = (index: number, text: string) => {
    setSaved(false);
    setDrafts((prev) => prev.map((q, i) => (i === index ? { ...q, text } : q)));
  };

  const removeQuestion = (index: number) => {
    setSaved(false);
    setDrafts((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setSaved(false);
    setDrafts((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((q, i) => ({ ...q, order: i }));
    });
  };

  const discardChanges = () => {
    setDrafts(original);
    setError(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = drafts.filter((q) => q.text.trim()).map((q, i) => ({ ...q, order: i }));
      const savedQuestions = await apiClient.put<StartupQuestion[]>(
        `/api/projects/${encodeURIComponent(projectId)}/ava/startup-questions`,
        { questions: payload },
      );
      const normalized = savedQuestions.map((q, i) => ({ ...q, order: q.order ?? i }));
      setOriginal(normalized);
      setDrafts(normalized);
      setSaved(true);
    } catch {
      setError("Failed to save startup questions. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="flex w-full flex-col gap-4">
      {/* Page header */}
      <Box className="animate-in fade-in slide-in-from-top-2 flex items-center justify-between duration-500">
        <Box>
          <Typography variant="h4" component="h2">
            Chat Settings
          </Typography>
          <Typography variant="body1" className="text-text-secondary">
            Configure the Ask AVA chat experience for this project
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" onClose={() => setSaved(false)}>
          Startup questions saved successfully.
        </Alert>
      )}

      {/* Startup questions card */}
      <Card className="bg-background-paper shadow-darker-xs animate-in fade-in slide-in-from-bottom-3 rounded-3xl duration-500">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <Box className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
            <Box className="flex items-start gap-3">
              <Box className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-full">
                <AutoAwesome fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" component="h3" className="font-bold">
                  Startup Questions
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  These suggested questions appear when project users open Ask AVA with an empty conversation. Add,
                  edit, reorder, or remove them below.
                </Typography>
              </Box>
            </Box>
            <Chip
              label={`${drafts.length} question${drafts.length === 1 ? "" : "s"}`}
              size="small"
              variant="outlined"
              color="primary"
              className="w-fit flex-none"
            />
          </Box>

          <Divider />

          {loading ? (
            <Box className="flex items-center justify-center gap-2 py-10">
              <CircularProgress size={20} />
              <Typography variant="body2" className="text-text-secondary">
                Loading startup questions...
              </Typography>
            </Box>
          ) : drafts.length === 0 ? (
            <Box className="bg-grey-25 flex flex-col items-center gap-2 rounded-2xl px-4 py-10 text-center">
              <Typography variant="body1" className="font-semibold">
                No startup questions yet
              </Typography>
              <Typography variant="body2" className="text-text-secondary mb-1">
                Add a few suggested questions to help users get started with Ask AVA.
              </Typography>
              <Button onClick={addQuestion} variant="outlined" size="small" startIcon={<Add />}>
                Add your first question
              </Button>
            </Box>
          ) : (
            <Box className="flex flex-col gap-2">
              {drafts.map((q, index) => (
                <Box
                  key={index}
                  className="bg-grey-25 hover:bg-grey-50 flex items-center gap-2 rounded-2xl p-2 pl-3 transition-colors duration-200 sm:gap-3"
                >
                  <Typography
                    variant="caption"
                    className="bg-primary/10 text-primary flex h-6 w-6 flex-none items-center justify-center rounded-full font-bold"
                  >
                    {index + 1}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={q.text}
                    onChange={(e) => updateText(index, e.target.value)}
                    placeholder="Enter a startup question, e.g. What is the total budget for this year?"
                    error={!q.text.trim()}
                  />
                  <Box className="flex flex-none items-center">
                    <Tooltip title="Move up">
                      <span>
                        <IconButton size="small" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === drafts.length - 1}
                        >
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete question">
                      <IconButton
                        size="small"
                        onClick={() => removeQuestion(index)}
                        sx={{ "&:hover": { color: "error.main" } }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {!loading && (
            <>
              <Divider />
              <Box className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={addQuestion} variant="outlined" size="small" startIcon={<Add />} className="w-fit">
                  Add question
                </Button>
                <Box className="flex items-center gap-2">
                  {hasEmptyQuestion && (
                    <Typography variant="caption" className="text-warning">
                      Empty questions will be removed on save.
                    </Typography>
                  )}
                  <Button
                    onClick={discardChanges}
                    variant="text"
                    color="grey"
                    size="small"
                    startIcon={<Replay />}
                    disabled={!isDirty || saving}
                  >
                    Discard changes
                  </Button>
                  <Button
                    onClick={handleSave}
                    variant="contained"
                    size="small"
                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
                    disabled={!isDirty || saving}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
