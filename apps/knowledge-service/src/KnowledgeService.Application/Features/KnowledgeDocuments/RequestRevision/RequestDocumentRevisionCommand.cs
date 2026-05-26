using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.RequestRevision;

public record RequestDocumentRevisionCommand(Guid Id, string RevisionNote) : IRequest<KnowledgeDocumentDto>;
