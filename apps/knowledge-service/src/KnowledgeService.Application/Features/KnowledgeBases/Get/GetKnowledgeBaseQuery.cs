using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Get;

public record GetKnowledgeBaseQuery(Guid Id) : IRequest<KnowledgeBaseDto>;
