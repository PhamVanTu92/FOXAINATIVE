using Foxai.Common;
using Foxai.System.V1;
using Grpc.Core;
using MediatR;
using SystemService.Api.Mapping;
using SystemService.Application.Features.Users.AssignRole;
using SystemService.Application.Features.Users.ChangePassword;
using SystemService.Application.Features.Users.ChangeStatus;
using SystemService.Application.Features.Users.CreateUser;
using SystemService.Application.Features.Users.DeleteUser;
using SystemService.Application.Features.Users.GetUserById;
using SystemService.Application.Features.Users.ListUsers;
using SystemService.Application.Features.Users.UnassignRole;
using SystemService.Application.Features.Users.UpdateUser;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.GrpcServices;

public sealed class UsersGrpcService(ISender sender) : UsersService.UsersServiceBase
{
    public override async Task<UserDto> CreateUser(CreateUserRequest request, ServerCallContext context)
    {
        var command = new CreateUserCommand(
            Email: request.Email,
            Password: request.Password,
            FullName: request.FullName,
            Phone: request.HasPhone ? request.Phone : null,
            OrganizationId: request.HasOrganizationId ? ParseGuid(request.OrganizationId, "organization_id") : null,
            RoleCodes: request.RoleCodes);

        var result = await sender.Send(command, context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<UserDto> GetUser(GetUserRequest request, ServerCallContext context)
    {
        var result = await sender.Send(new GetUserByIdQuery(ParseGuid(request.Id, "id")), context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<ListUsersResponse> ListUsers(ListUsersRequest request, ServerCallContext context)
    {
        var query = new ListUsersQuery(
            Pagination: request.Pagination.ToAppPageRequest(),
            Status: string.IsNullOrWhiteSpace(request.Status)
                ? null
                : UserMappings.ParseStatusOrThrow(request.Status),
            OrganizationId: request.HasOrganizationId ? ParseGuid(request.OrganizationId, "organization_id") : null);

        var page = await sender.Send(query, context.CancellationToken);
        var response = new ListUsersResponse
        {
            Page = CommonMappings.ToProtoPage(page),
        };
        response.Items.AddRange(page.Items.Select(u => u.ToProto()));
        return response;
    }

    public override async Task<UserDto> UpdateUser(UpdateUserRequest request, ServerCallContext context)
    {
        var command = new UpdateUserCommand(
            Id: ParseGuid(request.Id, "id"),
            FullName: request.HasFullName ? request.FullName : null,
            Phone: request.HasPhone ? request.Phone : null,
            AvatarUrl: request.HasAvatarUrl ? request.AvatarUrl : null,
            OrganizationId: request.HasOrganizationId ? ParseGuid(request.OrganizationId, "organization_id") : null);

        var result = await sender.Send(command, context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> DeleteUser(DeleteUserRequest request, ServerCallContext context)
    {
        await sender.Send(new DeleteUserCommand(ParseGuid(request.Id, "id")), context.CancellationToken);
        return new EmptyResponse();
    }

    public override async Task<EmptyResponse> ChangePassword(ChangePasswordRequest request, ServerCallContext context)
    {
        await sender.Send(
            new ChangePasswordCommand(
                UserId: ParseGuid(request.UserId, "user_id"),
                OldPassword: request.OldPassword,
                NewPassword: request.NewPassword),
            context.CancellationToken);
        return new EmptyResponse();
    }

    public override async Task<UserDto> ChangeStatus(ChangeStatusRequest request, ServerCallContext context)
    {
        var status = UserMappings.ParseStatusOrThrow(request.Status);
        var result = await sender.Send(
            new ChangeStatusCommand(ParseGuid(request.UserId, "user_id"), status),
            context.CancellationToken);
        return result.ToProto();
    }

    public override async Task<EmptyResponse> AssignRole(AssignRoleRequest request, ServerCallContext context)
    {
        await sender.Send(
            new AssignRoleCommand(ParseGuid(request.UserId, "user_id"), request.RoleCode),
            context.CancellationToken);
        return new EmptyResponse();
    }

    public override async Task<EmptyResponse> UnassignRole(UnassignRoleRequest request, ServerCallContext context)
    {
        await sender.Send(
            new UnassignRoleCommand(ParseGuid(request.UserId, "user_id"), request.RoleCode),
            context.CancellationToken);
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
