using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.ModuleGroups.Dtos;
using SystemService.Application.Features.ModuleGroups.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.ModuleGroups.CreateModuleGroup;

public sealed class CreateModuleGroupCommandHandler(IModuleGroupRepository groups)
    : IRequestHandler<CreateModuleGroupCommand, ModuleGroupDto>
{
    public async Task<ModuleGroupDto> Handle(CreateModuleGroupCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await groups.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("ModuleGroup", code);
        }

        var group = new ModuleGroup
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            SortOrder = request.SortOrder,
            IsActive = true,
        };

        groups.Add(group);
        return group.ToDto();
    }
}
