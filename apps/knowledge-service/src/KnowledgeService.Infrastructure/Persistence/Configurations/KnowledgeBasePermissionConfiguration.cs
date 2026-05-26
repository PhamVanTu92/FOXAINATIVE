using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeBasePermissionConfiguration : IEntityTypeConfiguration<KnowledgeBasePermission>
{
    public void Configure(EntityTypeBuilder<KnowledgeBasePermission> builder)
    {
        builder.ToTable("knowledge_base_permissions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.DepartmentName).IsRequired().HasMaxLength(200);

        builder.HasIndex(x => x.KnowledgeBaseId);
        builder.HasIndex(x => x.DepartmentId);
    }
}
