using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Stats;

public record GetStatsQuery : IRequest<KnowledgeStatsDto>;
