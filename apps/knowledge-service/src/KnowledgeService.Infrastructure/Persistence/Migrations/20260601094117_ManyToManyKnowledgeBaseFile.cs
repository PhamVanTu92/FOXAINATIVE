using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManyToManyKnowledgeBaseFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_knowledge_files_knowledge_bases_knowledge_base_id",
                table: "knowledge_files");

            migrationBuilder.DropIndex(
                name: "ix_knowledge_files_knowledge_base_id",
                table: "knowledge_files");

            migrationBuilder.DropColumn(
                name: "knowledge_base_id",
                table: "knowledge_files");

            migrationBuilder.CreateTable(
                name: "knowledge_base_files",
                columns: table => new
                {
                    knowledge_base_id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_file_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_base_files", x => new { x.knowledge_base_id, x.knowledge_file_id });
                    table.ForeignKey(
                        name: "fk_knowledge_base_files_knowledge_bases_knowledge_base_id",
                        column: x => x.knowledge_base_id,
                        principalTable: "knowledge_bases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_knowledge_base_files_knowledge_files_knowledge_file_id",
                        column: x => x.knowledge_file_id,
                        principalTable: "knowledge_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_base_files_knowledge_file_id",
                table: "knowledge_base_files",
                column: "knowledge_file_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "knowledge_base_files");

            migrationBuilder.AddColumn<Guid>(
                name: "knowledge_base_id",
                table: "knowledge_files",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_knowledge_base_id",
                table: "knowledge_files",
                column: "knowledge_base_id");

            migrationBuilder.AddForeignKey(
                name: "fk_knowledge_files_knowledge_bases_knowledge_base_id",
                table: "knowledge_files",
                column: "knowledge_base_id",
                principalTable: "knowledge_bases",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
