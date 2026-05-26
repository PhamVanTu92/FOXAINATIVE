using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class UserPermissionOverrideConfiguration : IEntityTypeConfiguration<UserPermissionOverride>
{
    public void Configure(EntityTypeBuilder<UserPermissionOverride> builder)
    {
        builder.ToTable("user_permission_overrides");

        builder.HasKey(up => new { up.UserId, up.ModuleId, up.ActionId });

        builder.Property(up => up.Effect)
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(up => up.GrantedAt).IsRequired();

        builder.HasOne(up => up.User)
            .WithMany(u => u.PermissionOverrides)
            .HasForeignKey(up => up.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(up => up.Module)
            .WithMany(m => m.UserPermissionOverrides)
            .HasForeignKey(up => up.ModuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(up => up.Action)
            .WithMany(a => a.UserPermissionOverrides)
            .HasForeignKey(up => up.ActionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(up => up.UserId);
        builder.HasIndex(up => up.ModuleId);
        builder.HasIndex(up => up.ActionId);
    }
}
