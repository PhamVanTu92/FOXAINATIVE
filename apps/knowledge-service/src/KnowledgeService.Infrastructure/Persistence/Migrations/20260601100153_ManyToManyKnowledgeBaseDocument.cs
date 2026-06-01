using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManyToManyKnowledgeBaseDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.DropIndex(
                name: "ix_knowledge_documents_knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.DropColumn(
                name: "knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.DropColumn(
                name: "knowledge_base_name",
                table: "knowledge_documents");

            migrationBuilder.CreateTable(
                name: "knowledge_base_documents",
                columns: table => new
                {
                    knowledge_base_id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_base_documents", x => new { x.knowledge_base_id, x.knowledge_document_id });
                    table.ForeignKey(
                        name: "fk_knowledge_base_documents_knowledge_bases_knowledge_base_id",
                        column: x => x.knowledge_base_id,
                        principalTable: "knowledge_bases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_knowledge_base_documents_knowledge_documents_knowledge_docu",
                        column: x => x.knowledge_document_id,
                        principalTable: "knowledge_documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_base_documents_knowledge_document_id",
                table: "knowledge_base_documents",
                column: "knowledge_document_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "knowledge_base_documents");

            migrationBuilder.AddColumn<Guid>(
                name: "knowledge_base_id",
                table: "knowledge_documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "knowledge_base_name",
                table: "knowledge_documents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_documents_knowledge_base_id",
                table: "knowledge_documents",
                column: "knowledge_base_id");

            migrationBuilder.AddForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents",
                column: "knowledge_base_id",
                principalTable: "knowledge_bases",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
