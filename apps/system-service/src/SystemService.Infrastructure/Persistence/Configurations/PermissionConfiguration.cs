using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("permissions");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Code).IsRequired().HasMaxLength(100);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Module).IsRequired().HasMaxLength(50);
        builder.Property(p => p.Action).IsRequired().HasMaxLength(50);
        builder.Property(p => p.Resource).IsRequired().HasMaxLength(100);

        builder.HasIndex(p => p.Code).IsUnique();
        builder.HasIndex(p => p.Module);
    }
}
