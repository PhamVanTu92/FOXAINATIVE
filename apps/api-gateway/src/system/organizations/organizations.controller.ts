import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccessToken, CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../../common/auth/jwt-auth.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { buildForwardMetadata } from '../../common/grpc/grpc-metadata.helper';
import {
  CreateNodeDto,
  GetTreeQueryDto,
  ListNodesQueryDto,
  ListUsersByOrgQueryDto,
  MoveNodeDto,
  UpdateNodeDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  @RequirePermission('ORG_STRUCTURE', 'CREATE')
  create(
    @Body() dto: CreateNodeDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.create(dto, buildForwardMetadata(token, user));
  }

  @Get()
  @RequirePermission('ORG_STRUCTURE', 'READ')
  list(
    @Query() q: ListNodesQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.list(
      { pagination: { page: q.page, pageSize: q.pageSize, search: q.search } },
      buildForwardMetadata(token, user),
    );
  }

  @Get('tree')
  @RequirePermission('ORG_STRUCTURE', 'READ')
  tree(
    @Query() q: GetTreeQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.tree({ rootId: q.rootId }, buildForwardMetadata(token, user));
  }

  @Get(':id')
  @RequirePermission('ORG_STRUCTURE', 'READ')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.get({ id }, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  @RequirePermission('ORG_STRUCTURE', 'UPDATE')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNodeDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.update(
      { id, name: dto.name, managerId: dto.managerId, clearManager: dto.clearManager },
      buildForwardMetadata(token, user),
    );
  }

  @Post(':id/move')
  @RequirePermission('ORG_STRUCTURE', 'UPDATE')
  move(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MoveNodeDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.move(
      { id, newParentId: dto.newParentId },
      buildForwardMetadata(token, user),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ORG_STRUCTURE', 'DELETE')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.orgs.remove({ id }, buildForwardMetadata(token, user));
  }

  @Get(':id/users')
  @RequirePermission('ORG_STRUCTURE', 'READ')
  listUsers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: ListUsersByOrgQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.listUsers(
      {
        organizationId: id,
        pagination: { page: q.page, pageSize: q.pageSize },
        includeSubOrgs: q.includeSubOrgs,
      },
      buildForwardMetadata(token, user),
    );
  }
}
