"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormLabel,
  Grid,
  IconButton,
  Input,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import FilePreviewDialog from "@/components/file-preview-dialog";
import { apiClient } from "@/lib/api-client";
import { isAdminUser } from "@/lib/auth";

const DATA_TYPES = [
  "Financial Snapshot",
  "Customer Allocation / Billing Data",
  "CIP Register",
  "Rate Table",
  "Demographics",
  "Budget / Audit Data",
  "Rate Resolution",
];

type UploadFile = {
  id: string;
  name: string;
  fileType: string;
  year?: string;
  uploadedBy: string;
  uploadedAt: string;
  status: "Processing" | "Completed" | "Failed";
  sizeBytes?: number;
};

type TemplateFile = {
  id: string;
  name: string;
  description: string;
  fileType: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
};

export default function DataPage() {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const isAdmin = isAdminUser();

  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [fileType, setFileType] = useState(DATA_TYPES[0]);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [previewFile, setPreviewFile] = useState<{ id: string; name: string } | null>(null);
  const handleOpenPreview = (fileId: string, fileName: string) => {
    setPreviewFile({ id: fileId, name: fileName });
  };
  const handleClosePreview = () => {
    setPreviewFile(null);
  };

  const [deleteFile, setDeleteFile] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const handleOpenDeleteConfirm = (fileId: string, fileName: string) => {
    setDeleteFile({ id: fileId, name: fileName });
  };
  const handleCloseDeleteConfirm = () => {
    if (deletingRef.current) return;
    setDeleteFile(null);
  };
  const handleConfirmDelete = async () => {
    if (!deleteFile || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/projects/${projectId}/data/${deleteFile.id}`);
      setSuccessMsg("File deleted successfully.");
      fetchUploadedFiles();
      setDeleteFile(null);
    } catch (err: any) {
      setError(err.message || "Delete failed");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const fetchUploadedFiles = useCallback(async () => {
    if (!projectId) return;
    setLoadingFiles(true);
    try {
      const data = await apiClient.get<UploadFile[]>(`/api/projects/${projectId}/data`);
      setUploads(data);
    } catch (err) {
      console.error("Failed to load project files:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, [projectId]);

  const fetchTemplates = useCallback(async () => {
    if (!projectId) return;
    setLoadingTemplates(true);
    try {
      const data = await apiClient.get<TemplateFile[]>(`/api/projects/${projectId}/templates`);
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUploadedFiles();
    fetchTemplates();
  }, [fetchUploadedFiles, fetchTemplates]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setError(null);
      setSuccessMsg(null);
      setPendingFile(acceptedFiles[0]);
    },
    [],
  );

  const handleRemovePendingFile = () => {
    setPendingFile(null);
  };

  const uploadingRef = useRef(false);
  const handleUploadPendingFile = async () => {
    if (!pendingFile || !projectId || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("fileType", fileType);
      if (year) {
        formData.append("year", year);
      }

      await apiClient.upload(`/api/projects/${projectId}/data`, formData);

      setSuccessMsg(`File "${pendingFile.name}" uploaded successfully!`);
      setPendingFile(null);
      fetchUploadedFiles();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  const handleDownloadTemplate = async (templateId: string, fileName: string) => {
    try {
      const res = await apiClient.raw<Response>(`/api/projects/${projectId}/templates/${templateId}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "Download failed");
    }
  };

  const handleDownloadUploadedFile = async (fileId: string, fileName: string) => {
    try {
      const res = await apiClient.raw<Response>(`/api/projects/${projectId}/data/${fileId}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "Download failed");
    }
  };

  const statusColor = (status: UploadFile["status"]) => {
    if (status === "Completed") return "success";
    if (status === "Processing") return "warning";
    return "error";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return dateStr;
    }
  };

  return (
    <Box className="flex w-full flex-col gap-6">
      <Box className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-500">
        <Typography variant="h4" component="h2">
          Data
        </Typography>
        <Typography variant="body1" className="text-text-secondary">
          Upload baseline data and download templates.
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          className="animate-in fade-in slide-in-from-top-2 duration-300"
        >
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert
          severity="success"
          onClose={() => setSuccessMsg(null)}
          className="animate-in fade-in slide-in-from-top-2 duration-300"
        >
          {successMsg}
        </Alert>
      )}

      {/* Upload Section (admin only) */}
      {isAdmin ? (
        <Card className="bg-background-paper shadow-darker-xs rounded-3xl transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
          <CardContent className="flex flex-col gap-4 p-5">
            <Typography variant="h6">Upload project data</Typography>
            <Box className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormControl className="outlined" variant="standard" size="small">
                <FormLabel className="mb-1.5">File type</FormLabel>
                <Select value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  {DATA_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl className="outlined" variant="standard" size="small">
                <FormLabel className="mb-1.5">Year</FormLabel>
                <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="YYYY" />
              </FormControl>
            </Box>

            {(!pendingFile || uploading) && (
              <Box
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                  isDragActive
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-grey-100 hover:border-primary hover:bg-grey-25"
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <Box className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                    <CircularProgress size={32} />
                    <Typography variant="body1">Uploading document...</Typography>
                  </Box>
                ) : (
                  <>
                    <CloudUploadIcon
                      color="action"
                      sx={{ fontSize: 36 }}
                      className={`transition-transform duration-300 ${isDragActive ? "scale-110" : ""}`}
                    />
                    <Typography variant="body1" className={isDragActive ? "text-primary" : "text-text-secondary"}>
                      {isDragActive ? "Drop the file here" : "Drag & drop a CSV, Excel, PDF, or Word file, or click to browse"}
                    </Typography>
                    <Typography variant="caption" className="text-text-secondary">
                      Supported formats: .csv, .xlsx, .pdf, .doc, .docx
                    </Typography>
                  </>
                )}
              </Box>
            )}

            {pendingFile && !uploading && (
              <Box className="bg-grey-25 flex flex-col gap-3 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Box className="flex items-center justify-between gap-2">
                  <Box className="flex flex-col gap-0.5 min-w-0">
                    <Typography variant="body1" className="text-text-primary font-semibold truncate">
                      {pendingFile.name}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary">
                      {fileType} {year ? `• ${year}` : ""} • {formatFileSize(pendingFile.size)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={handleRemovePendingFile}
                    title="Remove file"
                    className="transition-transform duration-200 hover:scale-110 flex-shrink-0"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box className="flex items-center gap-2">
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CloudUploadIcon />}
                    onClick={handleUploadPendingFile}
                    className="transition-transform duration-200 hover:scale-105"
                  >
                    Upload
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={handleRemovePendingFile}
                    className="transition-transform duration-200 hover:scale-105"
                  >
                    Remove
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" className="animate-in fade-in slide-in-from-top-2 duration-300">
          Only admins can upload data files to a project. Please contact an administrator if you need to add files.
        </Alert>
      )}

      {/* Uploaded Files Section */}
      <Card className="bg-background-paper shadow-darker-xs rounded-3xl transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
        <CardContent className="flex flex-col gap-4 p-5">
          <Typography variant="h6">Uploaded files</Typography>
          {loadingFiles ? (
            <Box className="flex items-center justify-center p-6">
              <CircularProgress size={28} />
            </Box>
          ) : uploads.length === 0 ? (
            <Typography variant="body2" className="text-text-secondary">
              No files uploaded yet. Select a file type and year above to upload project data.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {uploads.map((file, index) => (
                <Grid key={file.id} size={{ xs: 12, md: 6 }}>
                  <Box
                    className="bg-grey-25 flex h-full flex-col gap-2 rounded-2xl p-4 transition-all duration-300 hover:bg-grey-50 hover:shadow-sm hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${200 + index * 60}ms`, animationDuration: "400ms" }}
                  >
                    <Box className="flex items-center justify-between gap-2">
                      <Typography variant="body1" className="text-text-primary font-semibold truncate">
                        {file.name}
                      </Typography>
                      <Chip
                        label={file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                        size="small"
                        color={statusColor(file.status)}
                        className="flex-shrink-0 transition-transform duration-200 hover:scale-105"
                      />
                    </Box>
                    <Typography variant="body2" className="text-text-secondary">
                      {file.fileType} {file.year ? `• ${file.year}` : ""} • {file.uploadedBy} •{" "}
                      {formatDate(file.uploadedAt)} {file.sizeBytes ? `• ${formatFileSize(file.sizeBytes)}` : ""}
                    </Typography>
                    <Box className="mt-auto flex items-center gap-2 pt-1">
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleOpenPreview(file.id, file.name)}
                        className="transition-transform duration-200 hover:scale-105"
                      >
                        Preview
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadUploadedFile(file.id, file.name)}
                        className="transition-transform duration-200 hover:scale-105"
                      >
                        Download
                      </Button>
                      {isAdmin && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteConfirm(file.id, file.name)}
                          title="Delete file"
                          className="transition-transform duration-200 hover:scale-110"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Baseline Templates Section (admin only) */}
      {isAdmin && (
        <Card className="bg-background-paper shadow-darker-xs rounded-3xl transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200">
          <CardContent className="flex flex-col gap-4 p-5">
            <Typography variant="h6">Baseline templates</Typography>
          {loadingTemplates ? (
            <Box className="flex items-center justify-center p-6">
              <CircularProgress size={28} />
            </Box>
          ) : templates.length === 0 ? (
            <Typography variant="body2" className="text-text-secondary">
              No templates available.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {templates.map((template, index) => (
                <Grid key={template.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <Box
                    className="bg-grey-25 flex h-full flex-col gap-2 rounded-2xl p-4 transition-all duration-300 hover:bg-grey-50 hover:shadow-sm hover:-translate-y-0.5 animate-in fade-in zoom-in-95"
                    style={{ animationDelay: `${250 + index * 60}ms`, animationDuration: "400ms" }}
                  >
                    <Typography variant="body1" className="text-text-primary font-semibold">
                      {template.name}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary flex-1">
                      {template.description}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<DownloadIcon />}
                      className="mt-auto w-fit transition-transform duration-200 hover:scale-105"
                      onClick={() => handleDownloadTemplate(template.id, template.originalName)}
                    >
                      Download
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
          </CardContent>
        </Card>
      )}

      <FilePreviewDialog
        open={Boolean(previewFile)}
        fileId={previewFile?.id ?? null}
        fileName={previewFile?.name ?? ""}
        projectId={projectId}
        onClose={handleClosePreview}
      />

      <Dialog
        open={Boolean(deleteFile)}
        onClose={handleCloseDeleteConfirm}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: { className: "rounded-3xl" },
        }}
      >
        <DialogTitle>Delete file?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteFile?.name}</strong>? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions className="px-4 pb-4">
          <Button onClick={handleCloseDeleteConfirm} disabled={deleting} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
