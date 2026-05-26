using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.ReturnToDraft;

public record ReturnDocumentToDraftCommand(Guid Id) : IRequest<KnowledgeDocumentDto>;
