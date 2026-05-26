using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.PermissionActions.Dtos;
using SystemService.Application.Features.PermissionActions.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.PermissionActions.GetPermissionAction;

public sealed class GetPermissionActionQueryHandler(IPermissionActionRepository actions)
    : IRequestHandler<GetPermissionActionQuery, PermissionActionDto>
{
    public async Task<PermissionActionDto> Handle(GetPermissionActionQuery request, CancellationToken cancellationToken)
    {
        var a = await actions.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("PermissionAction", request.Id);
        return a.ToDto();
    }
}
