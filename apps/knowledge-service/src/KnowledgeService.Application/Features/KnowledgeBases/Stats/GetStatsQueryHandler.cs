using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Stats;

public class GetStatsQueryHandler : IRequestHandler<GetStatsQuery, KnowledgeStatsDto>
{
    private readonly IKnowledgeBaseRepository _repo;

    public GetStatsQueryHandler(IKnowledgeBaseRepository repo) => _repo = repo;

    public async Task<KnowledgeStatsDto> Handle(GetStatsQuery query, CancellationToken ct)
    {
        var (totalBases, totalFiles, departmentsUsing, lastUpdatedAt) = await _repo.GetStatsAsync(ct);

        return new KnowledgeStatsDto
        {
            TotalKnowledgeBases = totalBases,
            TotalFiles = totalFiles,
            DepartmentsUsingCount = departmentsUsing,
            LastUpdatedAt = lastUpdatedAt
        };
    }
}
