using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.ListUsersByOrg;

public sealed class ListUsersByOrgQueryHandler(
    IOrganizationRepository organizations,
    IUserRepository users) : IRequestHandler<ListUsersByOrgQuery, PagedResult<UserDto>>
{
    public async Task<PagedResult<UserDto>> Handle(ListUsersByOrgQuery request, CancellationToken cancellationToken)
    {
        var root = await organizations.FindByIdAsync(request.OrganizationId, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.OrganizationId);

        var orgIds = new List<Guid> { root.Id };
        if (request.IncludeSubOrgs)
        {
            var descendants = await organizations.GetDescendantsAsync(root.Path, cancellationToken);
            orgIds.AddRange(descendants.Select(d => d.Id));
        }

        var p = request.Pagination;
        var (items, total) = await users.SearchByOrgIdsAsync(orgIds, p.Page, p.PageSize, cancellationToken);

        return new PagedResult<UserDto>(
            items.Select(u => u.ToDto()).ToList(),
            p.Page,
            p.PageSize,
            total);
    }
}
