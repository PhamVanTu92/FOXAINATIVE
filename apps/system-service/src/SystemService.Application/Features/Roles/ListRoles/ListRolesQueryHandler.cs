using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;

namespace SystemService.Application.Features.Roles.ListRoles;

public sealed class ListRolesQueryHandler(IRoleRepository roles) : IRequestHandler<ListRolesQuery, PagedResult<RoleDto>>
{
    public async Task<PagedResult<RoleDto>> Handle(ListRolesQuery request, CancellationToken cancellationToken)
    {
        var p = request.Pagination;
        var (items, total) = await roles.SearchAsync(
            p.Page,
            p.PageSize,
            p.Search,
            request.IncludeGrants,
            p.SortBy,
            p.SortOrder,
            cancellationToken);

        return new PagedResult<RoleDto>(
            items.Select(r => r.ToDto()).ToList(),
            p.Page,
            p.PageSize,
            total);
    }
}
