using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.PermissionActions.Dtos;
using SystemService.Application.Features.PermissionActions.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.PermissionActions.UpdatePermissionAction;

public sealed class UpdatePermissionActionCommandHandler(IPermissionActionRepository actions)
    : IRequestHandler<UpdatePermissionActionCommand, PermissionActionDto>
{
    public async Task<PermissionActionDto> Handle(UpdatePermissionActionCommand request, CancellationToken cancellationToken)
    {
        var a = await actions.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("PermissionAction", request.Id);

        if (request.Name is not null) a.Name = request.Name.Trim();
        if (request.Description is not null)
        {
            a.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }
        if (request.SortOrder.HasValue) a.SortOrder = request.SortOrder.Value;
        if (request.IsActive.HasValue) a.IsActive = request.IsActive.Value;

        return a.ToDto();
    }
}
