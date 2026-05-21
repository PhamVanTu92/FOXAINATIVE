using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.UpdateNode;

public sealed class UpdateNodeCommandHandler(IOrganizationRepository organizations)
    : IRequestHandler<UpdateNodeCommand, OrganizationNodeDto>
{
    public async Task<OrganizationNodeDto> Handle(UpdateNodeCommand request, CancellationToken cancellationToken)
    {
        var node = await organizations.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.Id);

        if (request.Name is not null)
        {
            node.Name = request.Name.Trim();
        }

        return node.ToDto();
    }
}
