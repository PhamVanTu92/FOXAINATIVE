namespace KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;

public class KnowledgeDocumentDetailDto : KnowledgeDocumentDto
{
    public List<KnowledgeDocumentVersionDto> Versions { get; set; } = new();
}
