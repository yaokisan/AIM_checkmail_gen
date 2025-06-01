
export interface EmailFormData {
  videoUrl: string;
  instructionUrl: string;
  documentName: string;
}

export interface EmailDetails {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface User {
  name?: string;
  email?: string;
  imageUrl?: string;
}