using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class ModuleConfiguration : IEntityTypeConfiguration<Module>
{
    public void Configure(EntityTypeBuilder<Module> builder)
    {
        builder.ToTable("modules");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.GroupId).IsRequired();
        builder.Property(m => m.Code).IsRequired().HasMaxLength(100);
        builder.Property(m => m.Name).IsRequired().HasMaxLength(200);
        builder.Property(m => m.Description).HasMaxLength(500);
        builder.Property(m => m.SortOrder).IsRequired().HasDefaultValue(0);
        builder.Property(m => m.IsActive).IsRequired().HasDefaultValue(true);

        builder.HasIndex(m => m.Code).IsUnique();
        builder.HasIndex(m => new { m.GroupId, m.SortOrder });

        builder.HasOne(m => m.Group)
            .WithMany(g => g.Modules)
            .HasForeignKey(m => m.GroupId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
