using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Get;

public record GetDocumentQuery(Guid Id) : IRequest<KnowledgeDocumentDetailDto>;
