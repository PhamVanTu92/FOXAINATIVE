using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Application.Features.Organizations.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Organizations.UpdateNode;

public sealed class UpdateNodeCommandHandler(
    IOrganizationRepository organizations,
    IUserRepository users)
    : IRequestHandler<UpdateNodeCommand, OrganizationNodeDto>
{
    public async Task<OrganizationNodeDto> Handle(UpdateNodeCommand request, CancellationToken cancellationToken)
    {
        var node = await organizations.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("OrganizationNode", request.Id);

        if (request.Name is not null)
            node.Name = request.Name.Trim();

        if (request.ClearManager)
        {
            node.ManagerId = null;
        }
        else if (request.ManagerId is { } managerId)
        {
            if (!await users.ExistsAsync(managerId, cancellationToken))
                throw new NotFoundException("User", managerId);
            node.ManagerId = managerId;
        }

        return node.ToDto();
    }
}
