using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;

namespace SystemService.Application.Features.Organizations.GetTree;

public sealed class GetTreeQueryHandler(IOrganizationRepository organizations)
    : IRequestHandler<GetTreeQuery, IReadOnlyList<OrganizationNodeDto>>
{
    public async Task<IReadOnlyList<OrganizationNodeDto>> Handle(GetTreeQuery request, CancellationToken cancellationToken)
    {
        var flat = await organizations.GetTreeAsync(request.RootId, cancellationToken);
        return OrganizationDtoMapping.BuildForest(flat);
    }
}
