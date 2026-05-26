namespace KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;

public class KnowledgeDocumentVersionDto
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public string VersionNumber { get; set; } = default!;
    public string ChangeNote { get; set; } = default!;
    public string? ContentSummary { get; set; }
    public string Status { get; set; } = default!;
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
