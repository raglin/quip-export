// Quip service-specific types and interfaces

import { QuipDocument, QuipFolder, DocumentExport } from '../../types';

export interface QuipApiResponse<T> {
  data: T;
  error?: string;
}

export interface QuipListResponse {
  [key: string]: QuipDocument | QuipFolder;
}

export interface IQuipService {
  getCurrentUser(): Promise<any>;
  listDocuments(): Promise<QuipDocument[]>;
  getDocument(documentId: string): Promise<QuipDocument>;
  exportDocument(documentId: string, format: 'docx' | 'html'): Promise<DocumentExport>;
  getFolderContents(folderId: string): Promise<QuipListResponse>;
}