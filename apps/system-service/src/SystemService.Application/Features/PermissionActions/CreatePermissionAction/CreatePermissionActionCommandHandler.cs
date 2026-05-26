using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.PermissionActions.Dtos;
using SystemService.Application.Features.PermissionActions.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.PermissionActions.CreatePermissionAction;

public sealed class CreatePermissionActionCommandHandler(IPermissionActionRepository actions)
    : IRequestHandler<CreatePermissionActionCommand, PermissionActionDto>
{
    public async Task<PermissionActionDto> Handle(CreatePermissionActionCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await actions.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("PermissionAction", code);
        }

        var a = new PermissionAction
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            SortOrder = request.SortOrder,
            IsActive = true,
        };

        actions.Add(a);
        return a.ToDto();
    }
}
