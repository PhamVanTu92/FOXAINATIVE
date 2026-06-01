using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeBases.List;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Dtos;

public class KnowledgeFileDto
{
    public Guid Id { get; set; }
    public List<KnowledgeBaseRefDto> KnowledgeBases { get; set; } = new();
    public string FileName { get; set; } = default!;
    public string FileType { get; set; } = default!;
    public decimal FileSizeMb { get; set; }
    public string? StoragePath { get; set; }
    public DateTime UploadedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<DepartmentRefDto> Permissions { get; set; } = new();
}

public class AllFilesResultDto
{
    public IReadOnlyList<KnowledgeFileDto> Items { get; set; } = Array.Empty<KnowledgeFileDto>();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public AllFileCountsDto Counts { get; set; } = new();
}

public class AllFileCountsDto
{
    public int Word { get; set; }
    public int Excel { get; set; }
    public int Pdf { get; set; }
    public int Image { get; set; }
    public int PowerPoint { get; set; }
    public int Text { get; set; }
    public int Total { get; set; }
}
