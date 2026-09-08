import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import LoginPage from "@/features/auth/LoginPage";
import ProjectsPage from "@/features/projects/ProjectsPage";
import ProjectDetailPage from "@/features/projects/ProjectDetailPage";
import EnvironmentsPage from "@/features/environments/EnvironmentsPage";
import EnvironmentDetailPage from "@/features/environments/EnvironmentDetailPage";
import ServersPage from "@/features/servers/ServersPage";
import ServerDetailPage from "@/features/servers/ServerDetailPage";
import ServerFormPage from "@/features/servers/ServerFormPage";
import OverviewPage from "@/features/overview/OverviewPage";
import InfrastructurePage from "@/features/infrastructure/InfrastructurePage";
import ResourcesPage from "@/features/resources/ResourcesPage";
import ResourceFormPage from "@/features/resources/ResourceFormPage";
import PeoplePage from "@/features/people/PeoplePage";
import SchedulePage from "@/features/schedule/SchedulePage";
import ScheduleFormPage from "@/features/schedule/ScheduleFormPage";
import ExpirationsPage from "@/features/expirations/ExpirationsPage";
import ExpirationFormPage from "@/features/expirations/ExpirationFormPage";
import ActivityPage from "@/features/activity/ActivityPage";
import ManageUsersPage from "@/features/settings/ManageUsersPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          {/* Client UI is hidden — any old /clients link lands on Overview. */}
          <Route path="clients" element={<Navigate to="/overview" replace />} />
          <Route path="clients/:id" element={<Navigate to="/overview" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="environments/:id" element={<EnvironmentDetailPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="servers/new" element={<ServerFormPage mode="create" />} />
          <Route path="servers/:id" element={<ServerDetailPage />} />
          <Route path="servers/:id/edit" element={<ServerFormPage mode="edit" />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="resources/new" element={<ResourceFormPage mode="create" />} />
          <Route path="resources/:id/new-version" element={<ResourceFormPage mode="new-version" />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="schedule/new" element={<ScheduleFormPage mode="create" />} />
          <Route path="schedule/:id/edit" element={<ScheduleFormPage mode="edit" />} />
          <Route path="expirations" element={<ExpirationsPage />} />
          <Route path="expirations/new" element={<ExpirationFormPage mode="create" />} />
          <Route path="expirations/:id/edit" element={<ExpirationFormPage mode="edit" />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings/manage-users" element={<ManageUsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
