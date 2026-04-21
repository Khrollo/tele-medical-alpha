"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Eye,
  X,
  Folder,
  Upload,
  HardDrive,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
} from "@/components/ui/clearing";
import {
  deleteDocumentAction,
  getDocumentSignedUrlAction,
  createDocumentAction,
} from "@/app/_actions/documents";
import { cn } from "@/app/_lib/utils/cn";

interface Document {
  id: string;
  patientId: string;
  visitId: string | null;
  filename: string;
  mimeType: string;
  size: string;
  storageUrl: string;
  uploadedAt: Date;
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentsContentProps {
  patientId: string;
  patientName: string;
  documents: Document[];
}

export function DocumentsContent({
  patientId,
  patientName,
  documents: initialDocuments,
}: DocumentsContentProps) {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<Document[]>(initialDocuments);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = React.useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const newDocuments: Document[] = [];

      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(file.type)) {
          toast.error(`File type not allowed: ${file.name}`);
          continue;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        // Upload file to server
        const formData = new FormData();
        formData.append("file", file);
        formData.append("patientId", patientId);

        const uploadResponse = await fetch("/api/upload/document", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || "Upload failed");
        }

        const uploadData = await uploadResponse.json();

        // Save document metadata to DB
        const result = await createDocumentAction({
          patientId,
          filename: file.name,
          mimeType: file.type,
          size: file.size.toString(),
          storageUrl: uploadData.storageUrl,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to save document");
        }

        if (result.document) {
          newDocuments.push(result.document as Document);
        }
      }

      if (newDocuments.length > 0) {
        setDocuments((prev) => {
          const next = [...newDocuments, ...prev];
          next.sort(
            (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );
          return next;
        });
        toast.success(
          `Successfully uploaded ${newDocuments.length} document${newDocuments.length > 1 ? "s" : ""}`
        );
        setShowUploadModal(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string, storageUrl: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    setIsDeleting(documentId);
    try {
      const result = await deleteDocumentAction(documentId, storageUrl);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete document");
      }
      setDocuments((prev) => prev.filter((document) => document.id !== documentId));
      toast.success("Document deleted successfully");
      router.refresh();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePreview = async (document: Document) => {
    setIsLoadingPreview(true);
    setPreviewDocument(document);
    try {
      const result = await getDocumentSignedUrlAction(document.storageUrl);
      if (!result.success || !result.signedUrl) {
        throw new Error(result.error || "Failed to get preview URL");
      }
      setPreviewUrl(result.signedUrl);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load preview"
      );
      setPreviewDocument(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async (document: Document) => {
    setIsDownloading(document.id);
    try {
      const result = await getDocumentSignedUrlAction(document.storageUrl);
      if (!result.success || !result.signedUrl) {
        throw new Error(result.error || "Failed to get download URL");
      }

      // Open in new tab for viewing/downloading
      window.open(result.signedUrl, "_blank");
      toast.success("Opening document...");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download document"
      );
    } finally {
      setIsDownloading(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const formatFileSize = (size: string | number) => {
    const bytes = typeof size === "string" ? parseInt(size, 10) : size;
    if (isNaN(bytes)) return "Unknown size";

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
  };

  // Summary metrics
  const totalDocs = documents.length;
  const imageCount = documents.filter((d) => d.mimeType.startsWith("image/")).length;
  const pdfCount = documents.filter((d) => d.mimeType === "application/pdf").length;
  const totalBytes = documents.reduce((acc, d) => acc + (parseInt(d.size, 10) || 0), 0);

  const summaryMetrics: Array<{
    k: string;
    v: string | number;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    tone: string;
  }> = [
    { k: "Total documents", v: totalDocs, icon: Folder, tone: "var(--ink-3)" },
    { k: "Images", v: imageCount, icon: ImageIcon, tone: "var(--info)" },
    { k: "PDFs", v: pdfCount, icon: FileText, tone: "var(--critical)" },
    {
      k: "Storage used",
      v: formatFileSize(totalBytes),
      icon: HardDrive,
      tone: "var(--ink-3)",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Documents"
        title="Documents"
        subtitle={`Manage documents for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowUploadModal(true)}
          >
            Upload
          </Btn>
        }
      />

      {/* Summary strip */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {summaryMetrics.map((m, i, arr) => {
          const Icon = m.icon;
          return (
            <div
              key={m.k}
              className="flex flex-col gap-1.5 px-5 py-4"
              style={{
                borderRight:
                  i < arr.length - 1 ? "1px solid var(--line)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                >
                  {m.k}
                </div>
                <Icon className="h-3.5 w-3.5" style={{ color: m.tone }} />
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                {m.v}
              </div>
            </div>
          );
        })}
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <ClearingCard>
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Folder className="h-8 w-8" style={{ color: "var(--ink-3)" }} />
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No documents uploaded
            </p>
            <Btn
              kind="soft"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowUploadModal(true)}
            >
              Upload first document
            </Btn>
          </div>
        </ClearingCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => {
            const isPreviewable = canPreview(document.mimeType);
            return (
              <ClearingCard key={document.id} pad={0}>
                <div
                  className={cn(
                    "flex flex-col gap-3 p-4",
                    isPreviewable && "cursor-pointer"
                  )}
                  onClick={() => isPreviewable && handlePreview(document)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          background: "var(--paper-2)",
                          color: "var(--ink-2)",
                        }}
                      >
                        {getFileIcon(document.mimeType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="mono truncate text-[12.5px] font-medium"
                          style={{ color: "var(--ink)" }}
                          title={document.filename}
                        >
                          {document.filename}
                        </p>
                        <p
                          className="mono mt-1 text-[10.5px]"
                          style={{ color: "var(--ink-3)" }}
                        >
                          {formatDate(document.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isPreviewable && (
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                          style={{ color: "var(--ink-2)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(document);
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "var(--paper-3)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "transparent";
                          }}
                          disabled={
                            isLoadingPreview && previewDocument?.id === document.id
                          }
                          title="Preview"
                          aria-label="Preview"
                        >
                          {isLoadingPreview && previewDocument?.id === document.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                        style={{ color: "var(--ink-2)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(document);
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "var(--paper-3)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                        disabled={isDownloading === document.id}
                        title="Download"
                        aria-label="Download"
                      >
                        {isDownloading === document.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                        style={{ color: "var(--critical)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(document.id, document.storageUrl);
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "var(--critical-soft)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                        }}
                        disabled={isDeleting === document.id}
                        title="Delete"
                        aria-label="Delete"
                      >
                        {isDeleting === document.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2 pt-2"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <Pill tone="neutral">
                      <span className="mono">{formatFileSize(document.size)}</span>
                    </Pill>
                    {document.visitId && (
                      <Pill tone="ok" dot>
                        Visit document
                      </Pill>
                    )}
                  </div>
                </div>
              </ClearingCard>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog
        open={showUploadModal}
        onOpenChange={(open) => {
          setShowUploadModal(open);
          if (!open && fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Upload a document for this patient. Supported formats: Images (JPEG,
              PNG, GIF, WebP), PDF, Word documents (DOC, DOCX). Max size: 10MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select file(s)</Label>
              <Input
                id="file-upload"
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                disabled={isUploading}
                className={cn(isUploading && "opacity-50 cursor-not-allowed")}
              />
              {isUploading && (
                <p
                  className="text-[12.5px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  Uploading... Please wait.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Btn
              kind="ghost"
              type="button"
              onClick={() => {
                setShowUploadModal(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={isUploading}
            >
              Cancel
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog
        open={!!previewDocument}
        onOpenChange={(open) => !open && handleClosePreview()}
      >
        <DialogContent className="sm:max-w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 flex flex-col">
          {previewDocument && (
            <>
              <DialogHeader
                className="px-6 pt-6 pb-4 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="mono text-[14px] truncate">
                      {previewDocument.filename}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      <span className="mono">
                        {formatFileSize(previewDocument.size)} •{" "}
                        {formatDate(previewDocument.uploadedAt)}
                      </span>
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Btn
                      kind="ghost"
                      size="sm"
                      icon={
                        isDownloading === previewDocument.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() => handleDownload(previewDocument)}
                      disabled={isDownloading === previewDocument.id}
                    >
                      Download
                    </Btn>
                    <button
                      type="button"
                      onClick={handleClosePreview}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ color: "var(--ink-2)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--paper-3)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "transparent";
                      }}
                      title="Close"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </DialogHeader>
              <div
                className="flex-1 overflow-auto p-6 min-h-0"
                style={{ background: "var(--paper-2)" }}
              >
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent mx-auto mb-4" />
                      <p
                        className="text-[13px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        Loading preview...
                      </p>
                    </div>
                  </div>
                ) : previewUrl ? (
                  previewDocument.mimeType.startsWith("image/") ? (
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={previewDocument.filename}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  ) : previewDocument.mimeType === "application/pdf" ? (
                    <div className="w-full h-full min-h-[600px]">
                      <iframe
                        src={previewUrl}
                        className="w-full h-full min-h-[600px] border-0 rounded-lg"
                        title={previewDocument.filename}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                      <div className="text-center">
                        <File
                          className="h-12 w-12 mx-auto mb-4"
                          style={{ color: "var(--ink-3)" }}
                        />
                        <p
                          className="text-[13px] mb-4"
                          style={{ color: "var(--ink-3)" }}
                        >
                          Preview not available for this file type
                        </p>
                        <Btn
                          kind="accent"
                          icon={<Upload className="h-3.5 w-3.5" />}
                          onClick={() => handleDownload(previewDocument)}
                        >
                          Download to view
                        </Btn>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent mx-auto mb-4" />
                      <p
                        className="text-[13px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        Loading preview...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
