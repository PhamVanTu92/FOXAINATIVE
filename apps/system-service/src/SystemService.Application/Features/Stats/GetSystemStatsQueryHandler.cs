using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Stats.Dtos;

namespace SystemService.Application.Features.Stats;

public sealed class GetSystemStatsQueryHandler(IUserRepository repo)
    : IRequestHandler<GetSystemStatsQuery, SystemStatsDto>
{
    public async Task<SystemStatsDto> Handle(GetSystemStatsQuery request, CancellationToken ct)
    {
        var (totalUsers, activeUsers, totalRoles, usersByDept) = await repo.GetSystemStatsAsync(ct);

        return new SystemStatsDto(
            totalUsers,
            activeUsers,
            totalRoles,
            usersByDept.Select(x => new DepartmentUserCountDto(x.DepartmentName, x.UserCount)).ToList());
    }
}
