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
import { buildForwardMetadata } from '../../common/grpc/grpc-metadata.helper';
import {
  CreateNodeDto,
  GetTreeQueryDto,
  ListUsersByOrgQueryDto,
  MoveNodeDto,
  UpdateNodeDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(
    @Body() dto: CreateNodeDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.create(dto, buildForwardMetadata(token, user));
  }

  @Get('tree')
  tree(
    @Query() q: GetTreeQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.tree({ rootId: q.rootId }, buildForwardMetadata(token, user));
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.get({ id }, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNodeDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.orgs.update({ id, ...dto }, buildForwardMetadata(token, user));
  }

  @Post(':id/move')
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
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.orgs.remove({ id }, buildForwardMetadata(token, user));
  }

  @Get(':id/users')
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
