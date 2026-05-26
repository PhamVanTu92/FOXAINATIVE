import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AccessToken, CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedRequestUser } from '../common/auth/jwt-auth.guard';
import { buildForwardMetadata } from '../common/grpc/grpc-metadata.helper';
import {
  CreateKnowledgeBaseDto,
  ListKnowledgeBasesQueryDto,
  UpdateKnowledgeBaseDto,
} from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('api/knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('stats')
  getStats(
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.getStats({}, buildForwardMetadata(token, user));
  }

  @Get()
  list(
    @Query() q: ListKnowledgeBasesQueryDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.listKnowledgeBases(
      {
        search: q.search,
        departmentId: q.departmentId,
        page: q.page ?? 1,
        pageSize: q.pageSize ?? 20,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.getKnowledgeBase({ id }, buildForwardMetadata(token, user));
  }

  @Post()
  create(
    @Body() dto: CreateKnowledgeBaseDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.createKnowledgeBase(
      {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        managingDepartmentId: dto.managingDepartmentId,
        managingDepartmentName: dto.managingDepartmentName,
        permittedDepartments: dto.permittedDepartments ?? [],
        createdBy: user.sub,
      },
      buildForwardMetadata(token, user),
    );
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
    @AccessToken() token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.knowledge.updateKnowledgeBase(
      {
        id,
        name: dto.name,
        description: dto.description,
        managingDepartmentId: dto.managingDepartmentId,
        managingDepartmentName: dto.managingDepartmentName,
        permittedDepartments: dto.permittedDepartments ?? [],
      },
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
    await this.knowledge.deleteKnowledgeBase({ id }, buildForwardMetadata(token, user));
  }
}
