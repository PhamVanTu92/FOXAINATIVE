namespace KnowledgeService.Application.Features.KnowledgeBases.Dtos;

public class KnowledgeStatsDto
{
    public int TotalKnowledgeBases { get; set; }
    public int TotalFiles { get; set; }
    public int DepartmentsUsingCount { get; set; }
    public DateTime? LastUpdatedAt { get; set; }
}
