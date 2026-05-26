namespace KnowledgeService.Application.Features.KnowledgeBases.Dtos;

public class KnowledgeBaseDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public Guid ManagingDepartmentId { get; set; }
    public string ManagingDepartmentName { get; set; } = default!;
    public List<DepartmentRefDto> Permissions { get; set; } = new();
    public FileCountsDto FileCounts { get; set; } = new();
    public int TotalFiles { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class FileCountsDto
{
    public int Word { get; set; }
    public int Excel { get; set; }
    public int Pdf { get; set; }
    public int Image { get; set; }
}

public class DepartmentRefDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = default!;
}
