using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CascadeDeleteDocumentsOnKbDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.AddForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents",
                column: "knowledge_base_id",
                principalTable: "knowledge_bases",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.AddForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents",
                column: "knowledge_base_id",
                principalTable: "knowledge_bases",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
