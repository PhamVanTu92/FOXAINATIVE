using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SystemService.Application.Abstractions.Security;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Infrastructure.Persistence.Seeding;

public static class DataSeeder
{
    public const string DefaultAdminEmail = "admin@foxai.local";
    public const string DefaultAdminUsername = "admin";
    public const string DefaultAdminPassword = "Admin@12345";

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<SystemDbContext>();
        var hasher = sp.GetRequiredService<IPasswordHasher>();
        var logger = sp.GetRequiredService<ILogger<SystemDbContext>>();

        await SeedPermissionActionsAsync(db, ct);
        await SeedModuleGroupsAndModulesAsync(db, ct);
        await SeedModuleActionsAsync(db, ct);
        await SeedRolesAsync(db, ct);
        await SeedAdminUserAsync(db, hasher, ct);

        var saved = await db.SaveChangesAsync(ct);
        if (saved > 0)
        {
            logger.LogInformation("Seed completed: {Count} change(s) applied", saved);
        }
    }

    private static async Task SeedPermissionActionsAsync(SystemDbContext db, CancellationToken ct)
    {
        var existing = (await db.PermissionActions.Select(a => a.Code).ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        foreach (var seed in PermissionActionSeedData.All)
        {
            if (existing.Contains(seed.Code)) continue;

            db.PermissionActions.Add(new PermissionAction
            {
                Id = Guid.NewGuid(),
                Code = seed.Code,
                Name = seed.Name,
                Description = seed.Description,
                SortOrder = seed.SortOrder,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedModuleGroupsAndModulesAsync(SystemDbContext db, CancellationToken ct)
    {
        var existingGroups = await db.ModuleGroups.ToDictionaryAsync(g => g.Code, ct);
        var existingModules = await db.Modules.ToDictionaryAsync(m => m.Code, ct);

        foreach (var groupSeed in ModuleSeedData.Groups)
        {
            if (!existingGroups.TryGetValue(groupSeed.Code, out var group))
            {
                group = new ModuleGroup
                {
                    Id = Guid.NewGuid(),
                    Code = groupSeed.Code,
                    Name = groupSeed.Name,
                    Description = groupSeed.Description,
                    SortOrder = groupSeed.SortOrder,
                    IsActive = true,
                };
                db.ModuleGroups.Add(group);
                existingGroups[group.Code] = group;
            }

            foreach (var moduleSeed in groupSeed.Modules)
            {
                if (existingModules.ContainsKey(moduleSeed.Code)) continue;

                db.Modules.Add(new Module
                {
                    Id = Guid.NewGuid(),
                    GroupId = group.Id,
                    Group = group,
                    Code = moduleSeed.Code,
                    Name = moduleSeed.Name,
                    Description = moduleSeed.Description,
                    SortOrder = moduleSeed.SortOrder,
                    IsActive = true,
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedModuleActionsAsync(SystemDbContext db, CancellationToken ct)
    {
        var allActions = await db.PermissionActions.ToDictionaryAsync(a => a.Code, ct);
        var allModules = await db.Modules.ToDictionaryAsync(m => m.Code, ct);

        var existing = await db.ModuleActions
            .Select(ma => new { ma.ModuleId, ma.ActionId })
            .ToListAsync(ct);
        var existingSet = existing.Select(ma => (ma.ModuleId, ma.ActionId)).ToHashSet();

        foreach (var groupSeed in ModuleSeedData.Groups)
        {
            foreach (var moduleSeed in groupSeed.Modules)
            {
                if (!allModules.TryGetValue(moduleSeed.Code, out var module)) continue;

                foreach (var actionCode in moduleSeed.ActionCodes)
                {
                    if (!allActions.TryGetValue(actionCode, out var action)) continue;
                    if (existingSet.Contains((module.Id, action.Id))) continue;

                    db.ModuleActions.Add(new ModuleAction
                    {
                        ModuleId = module.Id,
                        ActionId = action.Id,
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedRolesAsync(SystemDbContext db, CancellationToken ct)
    {
        var allActions = await db.PermissionActions.ToDictionaryAsync(a => a.Code, ct);
        var allModules = await db.Modules.ToDictionaryAsync(m => m.Code, ct);

        foreach (var seed in RoleSeedData.All)
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

            if (!RoleSeedData.Grants.TryGetValue(seed.Code, out var spec)) continue;

            var existingPairs = role.RolePermissions
                .Select(rp => (rp.ModuleId, rp.ActionId))
                .ToHashSet();

            var targetPairs = new HashSet<(Guid ModuleId, Guid ActionId)>();
            if (spec.GrantAll)
            {
                foreach (var module in allModules.Values)
                foreach (var action in allActions.Values)
                {
                    targetPairs.Add((module.Id, action.Id));
                }
            }
            else
            {
                foreach (var (moduleCode, actionCodes) in spec.Specific)
                {
                    if (!allModules.TryGetValue(moduleCode, out var module)) continue;
                    foreach (var actionCode in actionCodes)
                    {
                        if (!allActions.TryGetValue(actionCode, out var action)) continue;
                        targetPairs.Add((module.Id, action.Id));
                    }
                }
            }

            foreach (var pair in targetPairs)
            {
                if (existingPairs.Contains(pair)) continue;

                role.RolePermissions.Add(new RolePermission
                {
                    Role = role,
                    RoleId = role.Id,
                    ModuleId = pair.ModuleId,
                    ActionId = pair.ActionId,
                    GrantedAt = DateTime.UtcNow,
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedAdminUserAsync(SystemDbContext db, IPasswordHasher hasher, CancellationToken ct)
    {
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == DefaultAdminEmail, ct);
        if (existing is not null) return;

        var superAdmin = await db.Roles.FirstOrDefaultAsync(r => r.Code == RoleSeedData.SuperAdminCode, ct);
        if (superAdmin is null) return;

        var admin = new User
        {
            Id = Guid.NewGuid(),
            Username = DefaultAdminUsername,
            Email = DefaultAdminEmail,
            PasswordHash = hasher.Hash(DefaultAdminPassword),
            FullName = "System Administrator",
            Status = UserStatus.Active,
        };
        admin.UserRoles.Add(new UserRole
        {
            User = admin,
            Role = superAdmin,
            AssignedAt = DateTime.UtcNow,
        });

        db.Users.Add(admin);
        await db.SaveChangesAsync(ct);
    }
}
