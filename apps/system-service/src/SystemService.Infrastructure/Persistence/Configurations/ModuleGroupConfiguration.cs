using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class ModuleGroupConfiguration : IEntityTypeConfiguration<ModuleGroup>
{
    public void Configure(EntityTypeBuilder<ModuleGroup> builder)
    {
        builder.ToTable("module_groups");
        builder.HasKey(g => g.Id);

        builder.Property(g => g.Code).IsRequired().HasMaxLength(64);
        builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
        builder.Property(g => g.Description).HasMaxLength(500);
        builder.Property(g => g.SortOrder).IsRequired().HasDefaultValue(0);
        builder.Property(g => g.IsActive).IsRequired().HasDefaultValue(true);

        builder.HasIndex(g => g.Code).IsUnique();
        builder.HasIndex(g => g.SortOrder);
    }
}
