using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.List;

public record ListDocumentsQuery(
    Guid? KnowledgeBaseId,
    string? Status,
    string? Search,
    int Page = 1,
    int PageSize = 20
) : IRequest<PagedResult<KnowledgeDocumentDto>>;
