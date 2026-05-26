using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;

namespace SystemService.Application.Features.Organizations.ListNodes;

public sealed class ListNodesQueryHandler(IOrganizationRepository organizations)
    : IRequestHandler<ListNodesQuery, PagedResult<OrganizationNodeDto>>
{
    public async Task<PagedResult<OrganizationNodeDto>> Handle(ListNodesQuery request, CancellationToken cancellationToken)
    {
        var p = request.Pagination.Normalize();

        var (items, total) = await organizations.SearchAsync(
            p.Page,
            p.PageSize,
            p.Search,
            cancellationToken);

        // Build a name lookup so each flat node can show its parent's name.
        var nameMap = items.ToDictionary(n => n.Id, n => n.Name);

        var dtos = items
            .Select(n =>
            {
                var parentName = n.ParentId is { } pid && nameMap.TryGetValue(pid, out var pn) ? pn : null;
                return n.ToDto(parentName: parentName);
            })
            .ToList();

        return new PagedResult<OrganizationNodeDto>(dtos, p.Page, p.PageSize, total);
    }
}
