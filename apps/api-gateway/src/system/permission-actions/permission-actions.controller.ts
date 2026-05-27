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
  CreatePermissionActionDto,
  ListPermissionActionsQueryDto,
  UpdatePermissionActionDto,
} from './dto/permission-actions.dto';
import { PermissionActionsService } from './permission-actions.service';

@Controller('api/permission-actions')
export class PermissionActionsController {
  constructor(private readonly svc: PermissionActionsService) {}

  @Get()
  list(
    @Query() q: ListPermissionActionsQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.list({ activeOnly: q.activeOnly ?? false }, buildForwardMetadata(token, user));
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.get({ id }, buildForwardMetadata(token, user));
  }

  @Post()
  create(
    @Body() dto: CreatePermissionActionDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.create(dto, buildForwardMetadata(token, user));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionActionDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.svc.update({ id, ...dto }, buildForwardMetadata(token, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    await this.svc.remove({ id }, buildForwardMetadata(token, user));
  }
}
