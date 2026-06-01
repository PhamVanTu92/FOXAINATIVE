using KnowledgeService.Application.Features.KnowledgeBases.Dtos;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;

public class KnowledgeDocumentDto
{
    public Guid Id { get; set; }
    public List<KnowledgeBaseRefDto> KnowledgeBases { get; set; } = new();
    public string Title { get; set; } = default!;
    public string FileType { get; set; } = default!;
    public decimal FileSizeMb { get; set; }
    public string? StoragePath { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }
    public string Status { get; set; } = default!;
    public string CurrentVersion { get; set; } = default!;
    public int VersionCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
