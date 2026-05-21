using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

public class Permission : BaseEntity, IAggregateRoot
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Module { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string Resource { get; set; } = default!;

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
