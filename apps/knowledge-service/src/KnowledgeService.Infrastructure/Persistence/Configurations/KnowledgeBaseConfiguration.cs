using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeBaseConfiguration : IEntityTypeConfiguration<KnowledgeBase>
{
    public void Configure(EntityTypeBuilder<KnowledgeBase> builder)
    {
        builder.ToTable("knowledge_bases");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.ManagingDepartmentName).IsRequired().HasMaxLength(200);

        builder.Property(x => x.CollectionId); // nullable, không index

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.ManagingDepartmentId);
        builder.HasIndex(x => x.UpdatedAt);

        builder.HasMany(x => x.Permissions)
               .WithOne(x => x.KnowledgeBase)
               .HasForeignKey(x => x.KnowledgeBaseId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Files)
               .WithOne(x => x.KnowledgeBase)
               .HasForeignKey(x => x.KnowledgeBaseId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
