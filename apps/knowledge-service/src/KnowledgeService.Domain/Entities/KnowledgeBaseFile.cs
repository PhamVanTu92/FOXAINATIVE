namespace KnowledgeService.Domain.Entities;

/// <summary>Bảng nối nhiều-nhiều giữa KnowledgeBase và KnowledgeFile.</summary>
public class KnowledgeBaseFile
{
    public Guid KnowledgeBaseId { get; set; }
    public KnowledgeBase KnowledgeBase { get; set; } = default!;

    public Guid KnowledgeFileId { get; set; }
    public KnowledgeFile KnowledgeFile { get; set; } = default!;

    public DateTime CreatedAt { get; set; }
}
