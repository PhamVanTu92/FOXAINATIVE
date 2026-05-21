using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Permissions.GetPermission;
using SystemService.Application.Features.Permissions.ListPermissions;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class PermissionsGrpcService(ISender sender) : PermissionsService.PermissionsServiceBase
{
    public override async Task<ListPermissionsResponse> ListPermissions(
        ListPermissionsRequest request,
        ServerCallContext context)
    {
        var module = request.HasModule ? request.Module : null;
        var items = await sender.Send(new ListPermissionsQuery(module), context.CancellationToken);

        var response = new ListPermissionsResponse();
        response.Items.AddRange(items.Select(p => p.ToProto()));
        return response;
    }

    public override async Task<PermissionDto> GetPermission(GetPermissionRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.Id, out var id))
        {
            throw new DomainValidationException("Trường 'id' phải là UUID hợp lệ.");
        }
        var dto = await sender.Send(new GetPermissionQuery(id), context.CancellationToken);
        return dto.ToProto();
    }
}
