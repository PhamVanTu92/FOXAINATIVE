using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

public class OrganizationNode : BaseEntity, IAggregateRoot
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int Level { get; set; }
    public string Path { get; set; } = default!;
    public Guid? ParentId { get; set; }
    public Guid? ManagerId { get; set; }

    public OrganizationNode? Parent { get; set; }
    public User? Manager { get; set; }
    public ICollection<OrganizationNode> Children { get; set; } = new List<OrganizationNode>();
    public ICollection<User> Users { get; set; } = new List<User>();

    public static string BuildPath(string? parentPath, string code) =>
        string.IsNullOrEmpty(parentPath) ? $"/{code}" : $"{parentPath}/{code}";

    public bool IsDescendantOf(OrganizationNode other) =>
        Path.StartsWith(other.Path + "/", StringComparison.Ordinal) ||
        string.Equals(Path, other.Path, StringComparison.Ordinal);
}
