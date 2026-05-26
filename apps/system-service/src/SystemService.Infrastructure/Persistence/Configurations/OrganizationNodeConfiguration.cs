using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence.Configurations;

public sealed class OrganizationNodeConfiguration : IEntityTypeConfiguration<OrganizationNode>
{
    public void Configure(EntityTypeBuilder<OrganizationNode> builder)
    {
        builder.ToTable("organization_nodes");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Code).IsRequired().HasMaxLength(64);
        builder.Property(o => o.Name).IsRequired().HasMaxLength(200);
        builder.Property(o => o.Level).IsRequired();
        builder.Property(o => o.Path).IsRequired().HasMaxLength(1024);

        builder.HasIndex(o => o.Code).IsUnique();
        builder.HasIndex(o => o.ParentId);
        builder.HasIndex(o => o.Path);

        builder.HasOne(o => o.Parent)
            .WithMany(p => p.Children)
            .HasForeignKey(o => o.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(o => o.Manager)
            .WithMany()
            .HasForeignKey(o => o.ManagerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(o => o.ManagerId);
    }
}
