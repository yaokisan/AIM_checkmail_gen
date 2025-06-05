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

// 撮影企画メール機能用の型定義
export interface ShootingPlanFormData {
  date: string;
  time: string;
  projects: string;
}

export interface ShootingPlan {
  number: string;
  title: string;
}

export interface ShootingEmailData {
  dateTime: string;
  formattedDateTime: string;
  plans: ShootingPlan[];
}