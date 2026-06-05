namespace KnowledgeService.Application.Features.KnowledgeBases.Dtos;

public class KnowledgeStatsDto
{
    public int TotalKnowledgeBases { get; set; }
    public int TotalFiles { get; set; }
    public int DepartmentsUsingCount { get; set; }
    public int PdfFilesCount { get; set; }
    public List<KnowledgeBaseFileCountDto> FilesByKnowledgeBase { get; set; } = new();
    public DateTime? LastUpdatedAt { get; set; }
}

public class KnowledgeBaseFileCountDto
{
    public string KnowledgeBaseName { get; set; } = default!;
    public int FileCount { get; set; }
}
