namespace SystemService.Application.Features.Stats.Dtos;

public sealed record SystemStatsDto(
    int TotalUsers,
    int ActiveUsers,
    int TotalRoles,
    IReadOnlyList<DepartmentUserCountDto> UsersByDepartment);

public sealed record DepartmentUserCountDto(
    string DepartmentName,
    int UserCount);
