using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.PermissionActions.CreatePermissionAction;
using SystemService.Application.Features.PermissionActions.DeletePermissionAction;
using SystemService.Application.Features.PermissionActions.GetPermissionAction;
using SystemService.Application.Features.PermissionActions.ListPermissionActions;
using SystemService.Application.Features.PermissionActions.UpdatePermissionAction;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class PermissionActionsGrpcService(ISender sender) : PermissionActionsService.PermissionActionsServiceBase
{
    public override async Task<ListPermissionActionsResponse> ListPermissionActions(
        ListPermissionActionsRequest request, ServerCallContext context)
    {
        var items = await sender.Send(new ListPermissionActionsQuery(request.ActiveOnly), context.CancellationToken);
        var resp = new ListPermissionActionsResponse();
        resp.Items.AddRange(items.Select(a => a.ToProto()));
        return resp;
    }

    public override async Task<PermissionActionDto> GetPermissionAction(
        GetPermissionActionRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new GetPermissionActionQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<PermissionActionDto> CreatePermissionAction(
        CreatePermissionActionRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new CreatePermissionActionCommand(
                Code: request.Code,
                Name: request.Name,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.SortOrder),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<PermissionActionDto> UpdatePermissionAction(
        UpdatePermissionActionRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new UpdatePermissionActionCommand(
                Id: ParseGuid(request.Id, "id"),
                Name: request.HasName ? request.Name : null,
                Description: request.HasDescription ? request.Description : null,
                SortOrder: request.HasSortOrder ? request.SortOrder : null,
                IsActive: request.HasIsActive ? request.IsActive : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeletePermissionAction(
        DeletePermissionActionRequest request, ServerCallContext context)
    {
        await sender.Send(new DeletePermissionActionCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
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
