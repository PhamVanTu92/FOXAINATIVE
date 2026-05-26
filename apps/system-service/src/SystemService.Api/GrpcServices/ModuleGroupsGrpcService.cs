using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.ModuleGroups.CreateModuleGroup;
using SystemService.Application.Features.ModuleGroups.DeleteModuleGroup;
using SystemService.Application.Features.ModuleGroups.GetModuleGroup;
using SystemService.Application.Features.ModuleGroups.ListModuleGroups;
using SystemService.Application.Features.ModuleGroups.UpdateModuleGroup;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class ModuleGroupsGrpcService(ISender sender) : ModuleGroupsService.ModuleGroupsServiceBase
{
    public override async Task<ListModuleGroupsResponse> ListModuleGroups(
        ListModuleGroupsRequest request, ServerCallContext context)
    {
        var items = await sender.Send(new ListModuleGroupsQuery(request.ActiveOnly), context.CancellationToken);
        var resp = new ListModuleGroupsResponse();
        resp.Items.AddRange(items.Select(g => g.ToProto()));
        return resp;
    }

    public override async Task<ModuleGroupDto> GetModuleGroup(GetModuleGroupRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new GetModuleGroupQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ModuleGroupDto> CreateModuleGroup(CreateModuleGroupRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new CreateModuleGroupCommand(
                Code: request.Code,
                Name: request.Name,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.SortOrder),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ModuleGroupDto> UpdateModuleGroup(UpdateModuleGroupRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new UpdateModuleGroupCommand(
                Id: ParseGuid(request.Id, "id"),
                Name: request.HasName ? request.Name : null,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.HasSortOrder ? request.SortOrder : null,
                IsActive: request.HasIsActive ? request.IsActive : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeleteModuleGroup(DeleteModuleGroupRequest request, ServerCallContext context)
    {
        await sender.Send(new DeleteModuleGroupCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
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
