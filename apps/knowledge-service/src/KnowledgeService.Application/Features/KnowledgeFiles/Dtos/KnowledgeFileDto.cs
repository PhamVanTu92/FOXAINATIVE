using KnowledgeService.Application.Features.KnowledgeBases.Dtos;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Dtos;

public class KnowledgeFileDto
{
    public Guid Id { get; set; }
    public Guid KnowledgeBaseId { get; set; }
    public string FileName { get; set; } = default!;
    public string FileType { get; set; } = default!;
    public decimal FileSizeMb { get; set; }
    public string? StoragePath { get; set; }
    public DateTime UploadedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<DepartmentRefDto> Permissions { get; set; } = new();
}
