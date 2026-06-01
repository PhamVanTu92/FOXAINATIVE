using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeDocumentKnowledgeBaseOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                table: "knowledge_documents");

            migrationBuilder.AlterColumn<string>(
                name: "knowledge_base_name",
                table: "knowledge_documents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<Guid>(
                name: "knowledge_base_id",
                table: "knowledge_documents",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

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

            migrationBuilder.AlterColumn<string>(
                name: "knowledge_base_name",
                table: "knowledge_documents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "knowledge_base_id",
                table: "knowledge_documents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

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
