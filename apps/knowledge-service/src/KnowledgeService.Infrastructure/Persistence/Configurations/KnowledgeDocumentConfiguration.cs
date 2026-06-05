using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeDocumentConfiguration : IEntityTypeConfiguration<KnowledgeDocument>
{
    public void Configure(EntityTypeBuilder<KnowledgeDocument> builder)
    {
        builder.ToTable("knowledge_documents");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.KnowledgeBaseName).HasMaxLength(200);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(500);
        builder.Property(x => x.FileType).HasConversion<string>().IsRequired().HasMaxLength(20);
        builder.Property(x => x.FileSizeMb).HasColumnType("decimal(10,4)");
        builder.Property(x => x.StoragePath).HasMaxLength(1000);
        builder.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(20);
        builder.Property(x => x.CurrentVersion).IsRequired().HasMaxLength(20);

        builder.HasIndex(x => x.KnowledgeBaseId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.UploadedAt);

        builder.HasOne<KnowledgeBase>()
            .WithMany()
            .HasForeignKey(x => x.KnowledgeBaseId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Versions)
            .WithOne(v => v.Document)
            .HasForeignKey(v => v.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
