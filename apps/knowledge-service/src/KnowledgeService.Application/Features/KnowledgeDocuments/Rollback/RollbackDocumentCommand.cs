using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Rollback;

public record RollbackDocumentCommand(Guid Id) : IRequest<KnowledgeDocumentDto>;
