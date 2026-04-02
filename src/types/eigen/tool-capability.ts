/**
 * EigenX Tool Capability — structured tool manifest for policy-aware routing.
 */
export type ToolMode = 'read' | 'write';
export type ApprovalPolicy = 'none_required' | 'user_approval' | 'admin_approval';

export interface ToolCapability {
  id: string;
  toolId: string;
  name: string;
  capabilityTags: string[];
  ioSchemaRef: string | null;
  mode: ToolMode;
  approvalPolicy: ApprovalPolicy;
  roleRequirements: string[];
  connectorDependencies: string[];
  blastRadius: string | null;
  fallbackMode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateToolCapabilityInput {
  toolId: string;
  name: string;
  capabilityTags?: string[];
  ioSchemaRef?: string | null;
  mode: ToolMode;
  approvalPolicy?: ApprovalPolicy;
  roleRequirements?: string[];
  connectorDependencies?: string[];
  blastRadius?: string | null;
  fallbackMode?: string | null;
}

export interface ToolCapabilityFilter {
  toolId?: string;
  mode?: ToolMode;
  approvalPolicy?: ApprovalPolicy;
}
