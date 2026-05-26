using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions");

        // Composite PK: (role_id, module_id, action_id) = 1 ô trong grid phân quyền (Role × Module × Action)
        builder.HasKey(rp => new { rp.RoleId, rp.ModuleId, rp.ActionId });

        builder.Property(rp => rp.GrantedAt).IsRequired();

        builder.HasOne(rp => rp.Role)
            .WithMany(r => r.RolePermissions)
            .HasForeignKey(rp => rp.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(rp => rp.Module)
            .WithMany(m => m.RolePermissions)
            .HasForeignKey(rp => rp.ModuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(rp => rp.Action)
            .WithMany(a => a.RolePermissions)
            .HasForeignKey(rp => rp.ActionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(rp => rp.ModuleId);
        builder.HasIndex(rp => rp.ActionId);
    }
}
