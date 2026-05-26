using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.ListVersions;

public record ListDocumentVersionsQuery(Guid DocumentId) : IRequest<List<KnowledgeDocumentVersionDto>>;
