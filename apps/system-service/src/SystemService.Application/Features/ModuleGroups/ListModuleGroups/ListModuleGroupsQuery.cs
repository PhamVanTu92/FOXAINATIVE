using MediatR;
using SystemService.Application.Features.ModuleGroups.Dtos;

namespace SystemService.Application.Features.ModuleGroups.ListModuleGroups;

/// <summary>
/// Trả về toàn bộ tree group → modules (sort theo SortOrder).
/// Frontend dùng để render row group + module rows trong UI grid phân quyền.
/// </summary>
public sealed record ListModuleGroupsQuery(bool ActiveOnly) : IRequest<IReadOnlyList<ModuleGroupDto>>;
