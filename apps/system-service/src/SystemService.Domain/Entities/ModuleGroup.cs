using SystemService.Domain.Common;

namespace SystemService.Domain.Entities;

/// <summary>
/// Nhóm phân hệ cấp cao (vd "Tổng quan", "Cấu hình hệ thống", "Tri thức AI", ...).
/// Hiển thị làm row group trong UI grid phân quyền.
/// </summary>
public class ModuleGroup : BaseEntity, IAggregateRoot
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Module> Modules { get; set; } = new List<Module>();
}
