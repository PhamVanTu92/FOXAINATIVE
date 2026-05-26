using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Approve;

public record ApproveDocumentCommand(Guid Id) : IRequest<KnowledgeDocumentDto>;
