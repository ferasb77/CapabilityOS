export type Participant = {
  id: string;
  workshopSlug: string;

  firstName: string;
  lastName: string;

  email: string;
  mobile: string;

  company: string;
  jobTitle: string;

  dietaryRequirements: string | null;

  checkedIn: boolean;
  checkedInAt: string;

  source: "QR";

  createdAt: string;
};

export type CheckInResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };