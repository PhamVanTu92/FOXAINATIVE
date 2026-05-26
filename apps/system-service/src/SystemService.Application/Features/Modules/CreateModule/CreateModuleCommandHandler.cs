using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Modules.Dtos;
using SystemService.Application.Features.Modules.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Modules.CreateModule;

public sealed class CreateModuleCommandHandler(
    IModuleRepository modules,
    IModuleGroupRepository groups) : IRequestHandler<CreateModuleCommand, ModuleDto>
{
    public async Task<ModuleDto> Handle(CreateModuleCommand request, CancellationToken cancellationToken)
    {
        var group = await groups.FindByIdAsync(request.GroupId, cancellationToken)
                    ?? throw new NotFoundException("ModuleGroup", request.GroupId);

        var code = request.Code.Trim().ToUpperInvariant();
        if (await modules.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("Module", code);
        }

        var m = new Module
        {
            Id = Guid.NewGuid(),
            GroupId = group.Id,
            Group = group,
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            SortOrder = request.SortOrder,
            IsActive = true,
        };

        modules.Add(m);
        return m.ToDto();
    }
}
