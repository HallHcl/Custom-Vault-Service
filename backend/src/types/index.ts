export type EntityType =
  | "client"
  | "project"
  | "environment"
  | "server"
  | "credential_reference"
  | "people"
  | "resource"
  | "resource_version"
  | "resource_attachment"
  | "schedule"
  | "expiration"
  | "user";

export type ActivityAction = "create" | "update" | "delete" | "restore";

export type ScheduleStatus = "pending" | "in_progress" | "done" | "cancelled";

export type ScheduleType = "PM" | "MA" | "other";

export type PeopleType =
  | "internal_engineer"
  | "vendor"
  | "client_contact"
  | "project_owner"
  | "approver";

export type ResourceType =
  | "runbook"
  | "sop"
  | "architecture"
  | "troubleshooting"
  | "faq"
  | "link"
  | "pdf";

export type ServiceType =
  | "application"
  | "database"
  | "proxy"
  | "monitoring"
  | "repository"
  | "metrics"
  | "jump_host"
  | "other";

export type AccessMethod = "ssh" | "rdp" | "telnet" | "web" | "other";

export interface Client {
  id: string;
  name: string;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: PeopleType;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface User {
  id: string;
  people_id: string | null;
  username: string;
  email: string;
  password_hash: string;
  theme_preference: "light" | "dark" | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
}

export interface PeopleClient {
  id: string;
  people_id: string;
  client_id: string;
  relationship_type: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  owner_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectPeople {
  id: string;
  project_id: string;
  people_id: string;
  role_in_project: string;
  created_at: string;
}

export type EnvironmentStatus =
  | "implementation"
  | "warranty"
  | "in_operation"
  | "on_hold"
  | "decommissioned";

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: EnvironmentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  vpn_resource_id: string | null;
}

export interface Server {
  id: string;
  environment_id: string;
  hostname: string;
  ip_address: string | null;
  tech_stack: unknown[];
  monitoring_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  display_name: string;
  service_type: ServiceType | null;
  access_method: AccessMethod | null;
  access_host: string;
  access_port: number | null;
  access_path: string | null;
  username: string | null;
  password: string | null;
}

export interface CredentialReference {
  id: string;
  server_id: string;
  label: string;
  reference_location: string;
  notes: string | null;
  created_at: string;
  applies_to_access_method: AccessMethod | null;
}

export interface Resource {
  id: string;
  project_id: string | null;
  type: ResourceType;
  title: string;
  category: string | null;
  tags: unknown[];
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ResourceVersion {
  id: string;
  resource_id: string;
  version_number: number;
  content: string | null;
  content_hash: string;
  external_url: string | null;
  file_path: string | null;
  commit_message: string | null;
  author_id: string;
  created_at: string;
}

export interface ResourceAttachment {
  id: string;
  resource_id: string;
  created_in_version_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ResourceAttachmentWithUploader extends ResourceAttachment {
  uploader: {
    id: string;
    name: string;
  };
}

export interface Schedule {
  id: string;
  project_id: string | null;
  server_id: string | null;
  title: string;
  type: ScheduleType;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  assigned_to: string;
  status: ScheduleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ExpirationType =
  | "ssl_certificate"
  | "hardware_ma"
  | "software_license"
  | "warranty"
  | "domain_or_cloud";

export type ExpirationStatus = "active" | "renewed" | "expired";

export interface Expiration {
  id: string;
  client_id: string;
  project_id: string | null;
  server_id: string | null;
  type: ExpirationType;
  name: string;
  provider_or_vendor: string | null;
  identifier: string | null;
  expiry_date: string;
  alert_threshold_days: number;
  status: ExpirationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpirationListItem extends Expiration {
  days_until_expiry: number;
  is_expired: boolean;
  is_critical: boolean;
  is_expiring_soon: boolean;
}

export interface ExpirationDetail extends ExpirationListItem {
  client: { id: string; name: string };
  project: { id: string; name: string } | null;
  server: { id: string; display_name: string } | null;
}

export interface ExpirationSummary {
  expired_count: number;
  critical_count: number;
  warning_count: number;
  upcoming_count: number;
}

export interface ActivityLog {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  action: ActivityAction;
  changed_by: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export interface AuthenticatedUser {
  id: string;
  peopleId: string | null;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
