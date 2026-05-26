using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.CreateVersion;

public record CreateDocumentVersionCommand(
    Guid Id,
    string ChangeNote,
    string? ContentSummary,
    Guid? CreatedBy
) : IRequest<KnowledgeDocumentDetailDto>;
