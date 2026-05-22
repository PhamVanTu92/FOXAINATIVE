import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  CreateNodeRequest,
  DeleteNodeRequest,
  GetNodeRequest,
  GetTreeRequest,
  ListNodesRequest,
  ListNodesResponse,
  ListUsersByOrgRequest,
  ListUsersResponse,
  MoveNodeRequest,
  OrganizationNodeDto,
  OrganizationTreeResponse,
  OrganizationsGrpcService,
  UpdateNodeRequest,
} from '../grpc-interfaces';

@Injectable()
export class OrganizationsService implements OnModuleInit {
  private orgs!: OrganizationsGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.orgs = this.client.getService<OrganizationsGrpcService>('OrganizationsService');
  }

  create(req: CreateNodeRequest, md?: Metadata): Promise<OrganizationNodeDto> {
    return callGrpc(this.orgs.createNode(req, md));
  }
  get(req: GetNodeRequest, md?: Metadata): Promise<OrganizationNodeDto> {
    return callGrpc(this.orgs.getNode(req, md));
  }
  tree(req: GetTreeRequest, md?: Metadata): Promise<OrganizationTreeResponse> {
    return callGrpc(this.orgs.getTree(req, md));
  }
  list(req: ListNodesRequest, md?: Metadata): Promise<ListNodesResponse> {
    return callGrpc(this.orgs.listNodes(req, md));
  }
  update(req: UpdateNodeRequest, md?: Metadata): Promise<OrganizationNodeDto> {
    return callGrpc(this.orgs.updateNode(req, md));
  }
  move(req: MoveNodeRequest, md?: Metadata): Promise<OrganizationNodeDto> {
    return callGrpc(this.orgs.moveNode(req, md));
  }
  remove(req: DeleteNodeRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.orgs.deleteNode(req, md)).then(() => undefined);
  }
  listUsers(req: ListUsersByOrgRequest, md?: Metadata): Promise<ListUsersResponse> {
    return callGrpc(this.orgs.listUsersByOrg(req, md));
  }
}
