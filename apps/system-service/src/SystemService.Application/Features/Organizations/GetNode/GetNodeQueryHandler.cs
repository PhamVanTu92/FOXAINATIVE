using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.GetNode;

public sealed class GetNodeQueryHandler(IOrganizationRepository organizations)
    : IRequestHandler<GetNodeQuery, OrganizationNodeDto>
{
    public async Task<OrganizationNodeDto> Handle(GetNodeQuery request, CancellationToken cancellationToken)
    {
        var node = await organizations.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.Id);
        return node.ToDto();
    }
}
