using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Roles.AssignPermissions;
using AppRolePermissionPair = SystemService.Application.Features.Roles.AssignPermissions.RolePermissionPair;
using SystemService.Application.Features.Roles.CreateRole;
using SystemService.Application.Features.Roles.DeleteRole;
using SystemService.Application.Features.Roles.GetRole;
using SystemService.Application.Features.Roles.ListRoles;
using SystemService.Application.Features.Roles.RevokePermissions;
using SystemService.Application.Features.Roles.UpdateRole;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class RolesGrpcService(ISender sender) : RolesService.RolesServiceBase
{
    public override async Task<RoleDto> CreateRole(CreateRoleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new CreateRoleCommand(
                Code: request.HasCode ? request.Code : null,
                Name: request.Name,
                Description: request.HasDescription ? request.Description : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<RoleDto> GetRole(GetRoleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new GetRoleQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ListRolesResponse> ListRoles(ListRolesRequest request, ServerCallContext context)
    {
        var query = new ListRolesQuery(
            Pagination: request.Pagination.ToAppPageRequest(),
            IncludeGrants: request.IncludeGrants);
        var page = await sender.Send(query, context.CancellationToken);

        var response = new ListRolesResponse
        {
            Page = CommonMappings.ToProtoPage(page),
        };
        response.Items.AddRange(page.Items.Select(r => r.ToProto()));
        return response;
    }

    public override async Task<RoleDto> UpdateRole(UpdateRoleRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new UpdateRoleCommand(
                Id: ParseGuid(request.Id, "id"),
                Name: request.HasName ? request.Name : null,
                Description: request.HasDescription ? request.Description : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeleteRole(DeleteRoleRequest request, ServerCallContext context)
    {
        await sender.Send(new DeleteRoleCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
        return new EmptyResponse();
    }

    public override async Task<RoleDto> AssignPermissions(AssignPermissionsRequest request, ServerCallContext context)
    {
        var pairs = request.Grants
            .Select(g => new AppRolePermissionPair(
                ParseGuid(g.ModuleId, "module_id"),
                ParseGuid(g.ActionId, "action_id")))
            .ToList();

        var result = await sender.Send(
            new AssignPermissionsCommand(ParseGuid(request.RoleId, "role_id"), pairs),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<RoleDto> RevokePermissions(RevokePermissionsRequest request, ServerCallContext context)
    {
        var pairs = request.Grants
            .Select(g => new AppRolePermissionPair(
                ParseGuid(g.ModuleId, "module_id"),
                ParseGuid(g.ActionId, "action_id")))
            .ToList();

        var result = await sender.Send(
            new RevokePermissionsCommand(ParseGuid(request.RoleId, "role_id"), pairs),
            context.CancellationToken);
        return result.ToProto();
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
