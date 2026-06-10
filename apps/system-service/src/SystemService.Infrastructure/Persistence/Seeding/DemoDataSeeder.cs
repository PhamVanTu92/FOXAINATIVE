using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SystemService.Application.Abstractions.Security;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Infrastructure.Persistence.Seeding;

/// <summary>
/// Seeds realistic demo data: business roles, org chart, and 19 users.
/// Activated when SYSTEM_SERVICE_SEED_DEMO=true.
/// Safe to run multiple times (idempotent by email/code).
/// </summary>
public static class DemoDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<SystemDbContext>();
        var hasher = sp.GetRequiredService<IPasswordHasher>();
        var logger = sp.GetRequiredService<ILogger<SystemDbContext>>();

        await SeedBusinessRolesAsync(db, ct);
        await SeedOrgChartAsync(db, ct);
        await SeedDemoUsersAsync(db, hasher, ct);

        var saved = await db.SaveChangesAsync(ct);
        logger.LogInformation("[DemoSeed] Completed: {Count} change(s) applied", saved);
    }

    // ── 1. Business roles ─────────────────────────────────────────────────────
    private static async Task SeedBusinessRolesAsync(SystemDbContext db, CancellationToken ct)
    {
        var allActions = await db.PermissionActions.ToDictionaryAsync(a => a.Code, ct);
        var allModules = await db.Modules.ToDictionaryAsync(m => m.Code, ct);

        foreach (var seed in DemoRoleSeedData.All)
        {
            var role = await db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Code == seed.Code, ct);

            if (role is null)
            {
                role = new Role
                {
                    Id = Guid.NewGuid(),
                    Code = seed.Code,
                    Name = seed.Name,
                    Description = seed.Description,
                    IsSystem = seed.IsSystem,
                };
                db.Roles.Add(role);
            }

            if (!DemoRoleSeedData.Grants.TryGetValue(seed.Code, out var grantMap)) continue;

            var existingPairs = role.RolePermissions
                .Select(rp => (rp.ModuleId, rp.ActionId))
                .ToHashSet();

            foreach (var (moduleCode, actionCodes) in grantMap)
            {
                if (!allModules.TryGetValue(moduleCode, out var module)) continue;
                foreach (var actionCode in actionCodes)
                {
                    if (!allActions.TryGetValue(actionCode, out var action)) continue;
                    if (existingPairs.Contains((module.Id, action.Id))) continue;

                    role.RolePermissions.Add(new RolePermission
                    {
                        Role = role,
                        RoleId = role.Id,
                        ModuleId = module.Id,
                        ActionId = action.Id,
                        GrantedAt = DateTime.UtcNow,
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }

    // ── 2. Org chart ──────────────────────────────────────────────────────────
    private static async Task SeedOrgChartAsync(SystemDbContext db, CancellationToken ct)
    {
        var existing = await db.OrganizationNodes
            .ToDictionaryAsync(o => o.Code, ct);

        // Root node
        if (!existing.TryGetValue(DemoOrgSeedData.Root.Code, out var root))
        {
            root = new OrganizationNode
            {
                Id = Guid.NewGuid(),
                Code = DemoOrgSeedData.Root.Code,
                Name = DemoOrgSeedData.Root.Name,
                Level = DemoOrgSeedData.Root.Level,
                Path = DemoOrgSeedData.Root.Path,
                ParentId = null,
            };
            db.OrganizationNodes.Add(root);
            existing[root.Code] = root;
        }

        // Departments
        foreach (var dept in DemoOrgSeedData.Departments)
        {
            if (existing.ContainsKey(dept.Code)) continue;

            db.OrganizationNodes.Add(new OrganizationNode
            {
                Id = Guid.NewGuid(),
                Code = dept.Code,
                Name = dept.Name,
                Level = dept.Level,
                Path = dept.Path,
                ParentId = root.Id,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // ── 3. Demo users ─────────────────────────────────────────────────────────
    private static async Task SeedDemoUsersAsync(
        SystemDbContext db, IPasswordHasher hasher, CancellationToken ct)
    {
        var existingEmails = (await db.Users.Select(u => u.Email).ToListAsync(ct))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var roles = await db.Roles.ToDictionaryAsync(r => r.Code, ct);
        var orgs = await db.OrganizationNodes.ToDictionaryAsync(o => o.Code, ct);
        var passwordHash = hasher.Hash(DemoUserSeedData.DefaultPassword);

        foreach (var seed in DemoUserSeedData.All)
        {
            if (existingEmails.Contains(seed.Email)) continue;
            if (!roles.TryGetValue(seed.RoleCode, out var role)) continue;

            orgs.TryGetValue(seed.OrgCode, out var org);

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = seed.Username,
                Email = seed.Email,
                PasswordHash = passwordHash,
                FullName = seed.FullName,
                Phone = seed.Phone,
                Status = UserStatus.Active,
                OrganizationId = org?.Id,
            };

            user.UserRoles.Add(new UserRole
            {
                User = user,
                Role = role,
                AssignedAt = DateTime.UtcNow,
            });

            db.Users.Add(user);
        }
    }
}
