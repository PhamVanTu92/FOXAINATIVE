using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Modules.CreateModule;
using SystemService.Application.Features.Modules.DeleteModule;
using SystemService.Application.Features.Modules.GetModule;
using SystemService.Application.Features.Modules.ListModules;
using SystemService.Application.Features.Modules.UpdateModule;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class ModulesGrpcService(ISender sender) : ModulesService.ModulesServiceBase
{
    public override async Task<ListModulesResponse> ListModules(ListModulesRequest request, ServerCallContext context)
    {
        Guid? groupId = request.HasGroupId ? ParseGuid(request.GroupId, "group_id") : null;
        var items = await sender.Send(new ListModulesQuery(groupId, request.ActiveOnly), context.CancellationToken);
        var resp = new ListModulesResponse();
        resp.Items.AddRange(items.Select(m => m.ToProto()));
        return resp;
    }

    public override async Task<ModuleDto> GetModule(GetModuleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new GetModuleQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ModuleDto> CreateModule(CreateModuleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new CreateModuleCommand(
                GroupId: ParseGuid(request.GroupId, "group_id"),
                Code: request.Code,
                Name: request.Name,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.SortOrder),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ModuleDto> UpdateModule(UpdateModuleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new UpdateModuleCommand(
                Id: ParseGuid(request.Id, "id"),
                GroupId: request.HasGroupId ? ParseGuid(request.GroupId, "group_id") : null,
                Name: request.HasName ? request.Name : null,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.HasSortOrder ? request.SortOrder : null,
                IsActive: request.HasIsActive ? request.IsActive : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeleteModule(DeleteModuleRequest request, ServerCallContext context)
    {
        await sender.Send(new DeleteModuleCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
        return new EmptyResponse();
    }

    private static Guid ParseGuid(string value, string field)
    {
        if (!Guid.TryParse(value, out var guid))
        {
            throw new DomainValidationException($"Trường '{field}' phải là UUID hợp lệ.");
        }
        return guid;
    }
}
