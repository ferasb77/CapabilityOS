import { getFacilitatorPortalSessionContext } from "@/features/facilitator-portal/data";
import { getFacilitatorById } from "@/features/facilitators/data";
import { PersonalProfessionalSection } from "@/features/facilitator-portal/components/personal-professional-section";
import { ProfilePhotoUpload } from "@/features/facilitator-portal/components/profile-photo-upload";
import { ExpertiseSection } from "@/features/facilitator-portal/components/expertise-section";
import { LanguagesRegionsSection } from "@/features/facilitator-portal/components/languages-regions-section";
import { DocumentsSection } from "@/features/facilitator-portal/components/documents-section";

export default async function FacilitatorProfilePage() {
  const sessionUser = await getFacilitatorPortalSessionContext();
  const profile = await getFacilitatorById(sessionUser.id);

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Profile record not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ivory">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep your details current for coordinators assigning programs.</p>
      </div>

      <ProfilePhotoUpload facilitatorId={profile.id} fullName={profile.fullName} photoUrl={profile.photoUrl} />
      <PersonalProfessionalSection facilitator={profile} />
      <ExpertiseSection facilitator={profile} />
      <LanguagesRegionsSection facilitator={profile} />
      <DocumentsSection facilitator={profile} />
    </div>
  );
}
