import {
  getFacilitatorPortalSessionContext,
  getFacilitatorProfileForEdit,
} from "@/features/facilitator-portal/data";
import { ProfileEditor } from "@/features/facilitator-portal/components/profile-editor";

export default async function FacilitatorProfilePage() {
  const sessionUser = await getFacilitatorPortalSessionContext();
  const profile = await getFacilitatorProfileForEdit(sessionUser.id);

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Profile record not found.
      </div>
    );
  }

  return <ProfileEditor facilitator={profile} />;
}
