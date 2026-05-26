using KnowledgeService.Domain.Common;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Domain.Entities;

public class KnowledgeDocumentVersion : BaseEntity
{
    public Guid DocumentId { get; set; }
    public KnowledgeDocument Document { get; set; } = default!;

    public string VersionNumber { get; set; } = default!;
    public string ChangeNote { get; set; } = default!;
    public string? ContentSummary { get; set; }
    public DocumentStatus Status { get; set; }
    public Guid? CreatedBy { get; set; }
}
