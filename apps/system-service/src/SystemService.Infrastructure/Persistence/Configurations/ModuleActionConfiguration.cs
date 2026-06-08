using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class ModuleActionConfiguration : IEntityTypeConfiguration<ModuleAction>
{
    public void Configure(EntityTypeBuilder<ModuleAction> builder)
    {
        builder.ToTable("module_actions");

        builder.HasKey(ma => new { ma.ModuleId, ma.ActionId });

        builder.HasOne(ma => ma.Module)
            .WithMany(m => m.AllowedActions)
            .HasForeignKey(ma => ma.ModuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ma => ma.Action)
            .WithMany(a => a.ModuleActions)
            .HasForeignKey(ma => ma.ActionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
