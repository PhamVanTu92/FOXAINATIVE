using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationManagerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "manager_id",
                table: "organization_nodes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_organization_nodes_manager_id",
                table: "organization_nodes",
                column: "manager_id");

            migrationBuilder.AddForeignKey(
                name: "fk_organization_nodes_users_manager_id",
                table: "organization_nodes",
                column: "manager_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_organization_nodes_users_manager_id",
                table: "organization_nodes");

            migrationBuilder.DropIndex(
                name: "ix_organization_nodes_manager_id",
                table: "organization_nodes");

            migrationBuilder.DropColumn(
                name: "manager_id",
                table: "organization_nodes");
        }
    }
}
