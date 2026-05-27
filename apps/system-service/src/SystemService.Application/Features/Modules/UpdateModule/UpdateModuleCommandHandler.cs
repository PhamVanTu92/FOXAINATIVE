using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Modules.Dtos;
using SystemService.Application.Features.Modules.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Modules.UpdateModule;

public sealed class UpdateModuleCommandHandler(
    IModuleRepository modules,
    IModuleGroupRepository groups) : IRequestHandler<UpdateModuleCommand, ModuleDto>
{
    public async Task<ModuleDto> Handle(UpdateModuleCommand request, CancellationToken cancellationToken)
    {
        var m = await modules.FindByIdAsync(request.Id, cancellationToken)
                ?? throw new NotFoundException("Module", request.Id);

        if (request.GroupId.HasValue && request.GroupId.Value != Guid.Empty)
        {
            var newGroup = await groups.FindByIdAsync(request.GroupId.Value, cancellationToken)
                           ?? throw new NotFoundException("ModuleGroup", request.GroupId.Value);
            m.GroupId = newGroup.Id;
            m.Group = newGroup;
        }

        if (request.Name is not null) m.Name = request.Name.Trim();
        if (request.Description is not null)
        {
            m.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }
        if (request.SortOrder.HasValue) m.SortOrder = request.SortOrder.Value;
        if (request.IsActive.HasValue) m.IsActive = request.IsActive.Value;

        return m.ToDto();
    }
}
