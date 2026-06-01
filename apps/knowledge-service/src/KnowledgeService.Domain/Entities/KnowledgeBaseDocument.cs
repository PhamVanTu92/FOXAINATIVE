namespace KnowledgeService.Domain.Entities;

/// <summary>Bảng nối nhiều-nhiều giữa KnowledgeBase và KnowledgeDocument.</summary>
public class KnowledgeBaseDocument
{
    public Guid KnowledgeBaseId { get; set; }
    public KnowledgeBase KnowledgeBase { get; set; } = default!;

    public Guid KnowledgeDocumentId { get; set; }
    public KnowledgeDocument KnowledgeDocument { get; set; } = default!;

    public DateTime CreatedAt { get; set; }
}
