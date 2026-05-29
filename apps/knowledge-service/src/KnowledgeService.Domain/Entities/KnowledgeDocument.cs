using KnowledgeService.Domain.Common;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Domain.Entities;

public class KnowledgeDocument : BaseEntity, IAggregateRoot
{
    public Guid KnowledgeBaseId { get; set; }
    public string KnowledgeBaseName { get; set; } = default!;
    public string Title { get; set; } = default!;
    public FileType FileType { get; set; }
    public decimal FileSizeMb { get; set; }
    public string? StoragePath { get; set; }
    public Guid? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }
    public DocumentStatus Status { get; set; }
    public string CurrentVersion { get; set; } = "v1.0";
    public int VersionCount { get; set; } = 1;

    public ICollection<KnowledgeDocumentVersion> Versions { get; set; } = new List<KnowledgeDocumentVersion>();

    public static KnowledgeDocument Create(
        Guid knowledgeBaseId,
        string knowledgeBaseName,
        string title,
        FileType fileType,
        decimal fileSizeMb,
        string? contentSummary,
        string? note,
        Guid? uploadedBy,
        string? storagePath = null)
    {
        var doc = new KnowledgeDocument
        {
            KnowledgeBaseId = knowledgeBaseId,
            KnowledgeBaseName = knowledgeBaseName,
            Title = title,
            FileType = fileType,
            FileSizeMb = fileSizeMb,
            StoragePath = storagePath,
            UploadedBy = uploadedBy,
            UploadedAt = DateTime.UtcNow,
            Status = DocumentStatus.Draft,
            CurrentVersion = "v1.0",
            VersionCount = 1,
        };

        doc.Versions.Add(new KnowledgeDocumentVersion
        {
            DocumentId = doc.Id,
            VersionNumber = "v1.0",
            ChangeNote = note ?? "Phiên bản đầu tiên",
            ContentSummary = contentSummary,
            Status = DocumentStatus.Draft,
            CreatedBy = uploadedBy,
        });

        return doc;
    }

    public void SubmitForReview()
    {
        if (Status != DocumentStatus.Draft)
            throw new InvalidOperationException($"Không thể gửi duyệt tài liệu đang ở trạng thái '{Status}'.");
        Status = DocumentStatus.Review;
    }

    public void Approve()
    {
        if (Status != DocumentStatus.Review)
            throw new InvalidOperationException($"Không thể phê duyệt tài liệu đang ở trạng thái '{Status}'.");
        Status = DocumentStatus.Approved;
    }

    public void ReturnToDraft()
    {
        if (Status != DocumentStatus.Review)
            throw new InvalidOperationException("Chỉ tài liệu đang Review mới được trả về Draft.");
        Status = DocumentStatus.Draft;
    }

    public void RequestRevision(string revisionNote)
    {
        if (Status != DocumentStatus.Review)
            throw new InvalidOperationException("Chỉ tài liệu đang Review mới được yêu cầu chỉnh sửa.");
        Status = DocumentStatus.Draft;
    }

    public void Archive()
    {
        if (Status != DocumentStatus.Approved)
            throw new InvalidOperationException("Chỉ tài liệu đã Approved mới có thể Archive.");
        Status = DocumentStatus.Archived;
    }

    public void Rollback()
    {
        Status = Status switch
        {
            DocumentStatus.Review   => DocumentStatus.Draft,
            DocumentStatus.Approved => DocumentStatus.Review,
            DocumentStatus.Archived => DocumentStatus.Approved,
            _ => throw new InvalidOperationException("Không thể Rollback tài liệu đang ở trạng thái Draft."),
        };
    }

    public KnowledgeDocumentVersion CreateNewVersion(string changeNote, string? contentSummary, Guid? createdBy)
    {
        var next = IncrementVersion(CurrentVersion);

        var version = new KnowledgeDocumentVersion
        {
            DocumentId = Id,
            VersionNumber = next,
            ChangeNote = changeNote,
            ContentSummary = contentSummary,
            Status = DocumentStatus.Draft,
            CreatedBy = createdBy,
        };

        CurrentVersion = next;
        Status = DocumentStatus.Draft;
        VersionCount++;

        return version;
    }

    private static string IncrementVersion(string current)
    {
        var trimmed = current.TrimStart('v');
        var parts = trimmed.Split('.');
        if (parts.Length == 2 &&
            int.TryParse(parts[0], out var major) &&
            int.TryParse(parts[1], out var minor))
            return $"v{major}.{minor + 1}";
        return $"{current}.1";
    }
}
