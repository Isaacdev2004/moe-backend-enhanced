// User types
export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
}

export interface UserWithoutPassword {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// JWT payload
export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// File upload types
export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedBy: string;
  uploadedAt: string;
}

// Request types
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// API Response types
export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
}

export interface AuthResponse {
  message: string;
  user: UserWithoutPassword;
  token: string;
}

export interface FileUploadResponse {
  message: string;
  file?: UploadedFile;
  files?: UploadedFile[];
  count?: number;
} 