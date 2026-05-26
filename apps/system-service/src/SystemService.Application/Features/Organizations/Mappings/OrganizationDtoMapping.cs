using SystemService.Application.Features.Organizations.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.Organizations.Mappings;

internal static class OrganizationDtoMapping
{
    public static OrganizationNodeDto ToDto(
        this OrganizationNode node,
        IReadOnlyList<OrganizationNodeDto>? children = null,
        string? parentName = null) =>
        new(
            Id: node.Id,
            Code: node.Code,
            Name: node.Name,
            ParentId: node.ParentId,
            ParentName: parentName ?? node.Parent?.Name,
            ManagerId: node.ManagerId,
            ManagerName: node.Manager is null ? null : node.Manager.FullName,
            Level: node.Level,
            Path: node.Path,
            CreatedAt: node.CreatedAt,
            UpdatedAt: node.UpdatedAt,
            Children: children ?? Array.Empty<OrganizationNodeDto>());

    public static IReadOnlyList<OrganizationNodeDto> BuildForest(IEnumerable<OrganizationNode> flat)
    {
        var nodes = flat.ToList();
        if (nodes.Count == 0)
        {
            return Array.Empty<OrganizationNodeDto>();
        }

        var nameMap = nodes.ToDictionary(n => n.Id, n => n.Name);
        var dtos = nodes.ToDictionary(
            n => n.Id,
            n => new MutableDto(n, n.ParentId is { } pid && nameMap.TryGetValue(pid, out var pn) ? pn : null));
        var roots = new List<MutableDto>();

        foreach (var node in nodes)
        {
            var dto = dtos[node.Id];
            if (node.ParentId is { } parentId && dtos.TryGetValue(parentId, out var parent))
            {
                parent.Children.Add(dto);
            }
            else
            {
                roots.Add(dto);
            }
        }

        return roots.Select(r => r.ToDto()).ToList();
    }

    private sealed class MutableDto(OrganizationNode node, string? parentName)
    {
        public OrganizationNode Source { get; } = node;
        public string? ParentName { get; } = parentName;
        public List<MutableDto> Children { get; } = new();

        public OrganizationNodeDto ToDto() =>
            Source.ToDto(
                Children.OrderBy(c => c.Source.Code).Select(c => c.ToDto()).ToList(),
                ParentName);
    }
}
