using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeDocumentVersionConfiguration : IEntityTypeConfiguration<KnowledgeDocumentVersion>
{
    public void Configure(EntityTypeBuilder<KnowledgeDocumentVersion> builder)
    {
        builder.ToTable("knowledge_document_versions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.VersionNumber).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ChangeNote).IsRequired().HasMaxLength(500);
        builder.Property(x => x.ContentSummary).HasColumnType("text");
        builder.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(20);

        builder.HasIndex(x => x.DocumentId);
    }
}
