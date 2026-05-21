using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Organizations.CreateNode;
using SystemService.Application.Features.Organizations.DeleteNode;
using SystemService.Application.Features.Organizations.GetNode;
using SystemService.Application.Features.Organizations.GetTree;
using SystemService.Application.Features.Organizations.ListUsersByOrg;
using SystemService.Application.Features.Organizations.MoveNode;
using SystemService.Application.Features.Organizations.UpdateNode;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class OrganizationsGrpcService(ISender sender) : OrganizationsService.OrganizationsServiceBase
{
    public override async Task<OrganizationNodeDto> CreateNode(CreateNodeRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new CreateNodeCommand(
                Code: request.Code,
                Name: request.Name,
                ParentId: request.HasParentId ? ParseGuid(request.ParentId, "parent_id") : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<OrganizationNodeDto> GetNode(GetNodeRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new GetNodeQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<OrganizationTreeResponse> GetTree(GetTreeRequest request, ServerCallContext context)
    {
        Guid? rootId = request.HasRootId ? ParseGuid(request.RootId, "root_id") : null;
        var nodes = await sender.Send(new GetTreeQuery(rootId), context.CancellationToken);

        var response = new OrganizationTreeResponse();
        response.Nodes.AddRange(nodes.Select(n => n.ToProto()));
        return response;
    }

    public override async Task<OrganizationNodeDto> UpdateNode(UpdateNodeRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new UpdateNodeCommand(
                Id: ParseGuid(request.Id, "id"),
                Name: request.HasName ? request.Name : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<OrganizationNodeDto> MoveNode(MoveNodeRequest request, ServerCallContext context)
    {
        var result = await sender.Send(
            new MoveNodeCommand(
                Id: ParseGuid(request.Id, "id"),
                NewParentId: request.HasNewParentId ? ParseGuid(request.NewParentId, "new_parent_id") : null),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeleteNode(DeleteNodeRequest request, ServerCallContext context)
    {
        await sender.Send(new DeleteNodeCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
        return new EmptyResponse();
    }

    public override async Task<ListUsersResponse> ListUsersByOrg(ListUsersByOrgRequest request, ServerCallContext context)
    {
        var page = await sender.Send(
            new ListUsersByOrgQuery(
                OrganizationId: ParseGuid(request.OrganizationId, "organization_id"),
                Pagination: request.Pagination.ToAppPageRequest(),
                IncludeSubOrgs: request.IncludeSubOrgs),
            context.CancellationToken);

        var response = new ListUsersResponse
        {
            Page = CommonMappings.ToProtoPage(page),
        };
        response.Items.AddRange(page.Items.Select(u => u.ToProto()));
        return response;
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
