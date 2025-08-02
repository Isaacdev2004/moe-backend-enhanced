import { v4 as uuidv4 } from 'uuid';
import { DocumentModel } from '../models/Document.js';
import { DocumentVector } from '../types/vector-db.js';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  title: string;
  content: string;
  metadata: any;
  created_by: string;
  created_at: string;
  change_description?: string;
  previous_version_id?: string;
}

export interface VersionHistory {
  document_id: string;
  current_version: number;
  versions: DocumentVersion[];
  total_versions: number;
}

export class VersionControlService {
  private static instance: VersionControlService;
  private versions: Map<string, DocumentVersion[]> = new Map();

  private constructor() {}

  static getInstance(): VersionControlService {
    if (!VersionControlService.instance) {
      VersionControlService.instance = new VersionControlService();
    }
    return VersionControlService.instance;
  }

  /**
   * Create a new version of a document
   */
  async createVersion(
    documentId: string, 
    updatedDocument: Partial<DocumentVector>, 
    userId: string,
    changeDescription?: string
  ): Promise<string> {
    try {
      // Get current document
      const currentDocument = await DocumentModel.findOne({ id: documentId });
      if (!currentDocument) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (currentDocument.metadata.uploaded_by !== userId) {
        throw new Error('Unauthorized: Cannot create version for document not owned by user');
      }

      // Get existing versions for this document
      const existingVersions = this.versions.get(documentId) || [];
      const currentVersionNumber = existingVersions.length + 1;

      // Create version from current document state
      const newVersion: DocumentVersion = {
        id: uuidv4(),
        document_id: documentId,
        version_number: currentVersionNumber,
        title: currentDocument.title,
        content: currentDocument.content,
        metadata: {
          ...currentDocument.metadata,
          version_info: {
            version_number: currentVersionNumber,
            created_at: new Date().toISOString(),
            created_by: userId,
            change_description: changeDescription || 'Version created'
          }
        },
        created_by: userId,
        created_at: new Date().toISOString(),
        change_description: changeDescription,
        previous_version_id: existingVersions.length > 0 ? existingVersions[existingVersions.length - 1].id : undefined
      };

      // Save version
      existingVersions.push(newVersion);
      this.versions.set(documentId, existingVersions);

      // Update the main document with new content
      const updateData = {
        ...updatedDocument,
        updated_at: new Date().toISOString(),
        'metadata.version_info': {
          current_version: currentVersionNumber,
          last_modified_by: userId,
          last_modified_at: new Date().toISOString(),
          change_description: changeDescription
        }
      };

      await DocumentModel.updateOne({ id: documentId }, { $set: updateData });

      console.log(`✅ Created version ${currentVersionNumber} for document ${documentId}`);
      return newVersion.id;
    } catch (error) {
      console.error('Error creating document version:', error);
      throw new Error(`Failed to create version: ${error}`);
    }
  }

  /**
   * Get version history for a document
   */
  async getVersionHistory(documentId: string, userId: string): Promise<VersionHistory> {
    try {
      // Verify document exists and user has access
      const document = await DocumentModel.findOne({ id: documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.metadata.uploaded_by !== userId) {
        throw new Error('Unauthorized: Cannot access version history');
      }

      const versions = this.versions.get(documentId) || [];
      
      return {
        document_id: documentId,
        current_version: versions.length,
        versions: versions.sort((a, b) => b.version_number - a.version_number),
        total_versions: versions.length
      };
    } catch (error) {
      console.error('Error getting version history:', error);
      throw new Error(`Failed to get version history: ${error}`);
    }
  }

  /**
   * Restore document to a specific version
   */
  async restoreVersion(documentId: string, versionId: string, userId: string): Promise<void> {
    try {
      // Get document and verify permissions
      const document = await DocumentModel.findOne({ id: documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.metadata.uploaded_by !== userId) {
        throw new Error('Unauthorized: Cannot restore document version');
      }

      // Find the version to restore
      const versions = this.versions.get(documentId) || [];
      const versionToRestore = versions.find(v => v.id === versionId);
      
      if (!versionToRestore) {
        throw new Error('Version not found');
      }

      // Create a new version with current state before restoring
      await this.createVersion(
        documentId, 
        {}, 
        userId, 
        `Backup before restoring to version ${versionToRestore.version_number}`
      );

      // Restore document to the specified version
      const restoreData = {
        title: versionToRestore.title,
        content: versionToRestore.content,
        updated_at: new Date().toISOString(),
        'metadata.version_info': {
          current_version: versionToRestore.version_number,
          restored_from_version: versionToRestore.version_number,
          restored_at: new Date().toISOString(),
          restored_by: userId,
          change_description: `Restored to version ${versionToRestore.version_number}`
        }
      };

      await DocumentModel.updateOne({ id: documentId }, { $set: restoreData });

      console.log(`✅ Restored document ${documentId} to version ${versionToRestore.version_number}`);
    } catch (error) {
      console.error('Error restoring version:', error);
      throw new Error(`Failed to restore version: ${error}`);
    }
  }

  /**
   * Get specific version details
   */
  async getVersion(documentId: string, versionId: string, userId: string): Promise<DocumentVersion> {
    try {
      // Verify document access
      const document = await DocumentModel.findOne({ id: documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.metadata.uploaded_by !== userId) {
        throw new Error('Unauthorized: Cannot access document version');
      }

      const versions = this.versions.get(documentId) || [];
      const version = versions.find(v => v.id === versionId);
      
      if (!version) {
        throw new Error('Version not found');
      }

      return version;
    } catch (error) {
      console.error('Error getting version:', error);
      throw new Error(`Failed to get version: ${error}`);
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    documentId: string, 
    versionId1: string, 
    versionId2: string, 
    userId: string
  ): Promise<{
    version1: DocumentVersion;
    version2: DocumentVersion;
    differences: {
      title_changed: boolean;
      content_changed: boolean;
      content_diff_stats: {
        additions: number;
        deletions: number;
        changes: number;
      };
    };
  }> {
    try {
      const version1 = await this.getVersion(documentId, versionId1, userId);
      const version2 = await this.getVersion(documentId, versionId2, userId);

      // Simple difference calculation
      const titleChanged = version1.title !== version2.title;
      const contentChanged = version1.content !== version2.content;
      
      // Basic content difference statistics
      const content1Lines = version1.content.split('\n');
      const content2Lines = version2.content.split('\n');
      
      let additions = 0;
      let deletions = 0;
      let changes = 0;

      const maxLines = Math.max(content1Lines.length, content2Lines.length);
      for (let i = 0; i < maxLines; i++) {
        const line1 = content1Lines[i] || '';
        const line2 = content2Lines[i] || '';
        
        if (line1 && !line2) deletions++;
        else if (!line1 && line2) additions++;
        else if (line1 !== line2) changes++;
      }

      return {
        version1,
        version2,
        differences: {
          title_changed: titleChanged,
          content_changed: contentChanged,
          content_diff_stats: {
            additions,
            deletions,
            changes
          }
        }
      };
    } catch (error) {
      console.error('Error comparing versions:', error);
      throw new Error(`Failed to compare versions: ${error}`);
    }
  }

  /**
   * Delete a specific version (with restrictions)
   */
  async deleteVersion(documentId: string, versionId: string, userId: string): Promise<void> {
    try {
      // Verify document access
      const document = await DocumentModel.findOne({ id: documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      if (document.metadata.uploaded_by !== userId) {
        throw new Error('Unauthorized: Cannot delete document version');
      }

      const versions = this.versions.get(documentId) || [];
      
      // Don't allow deletion if it's the only version
      if (versions.length <= 1) {
        throw new Error('Cannot delete the only version of a document');
      }

      // Remove the version
      const filteredVersions = versions.filter(v => v.id !== versionId);
      
      if (filteredVersions.length === versions.length) {
        throw new Error('Version not found');
      }

      this.versions.set(documentId, filteredVersions);
      
      console.log(`✅ Deleted version ${versionId} from document ${documentId}`);
    } catch (error) {
      console.error('Error deleting version:', error);
      throw new Error(`Failed to delete version: ${error}`);
    }
  }

  /**
   * Get version statistics for analytics
   */
  getVersionStats(): {
    total_versioned_documents: number;
    total_versions: number;
    avg_versions_per_document: number;
  } {
    const versionedDocuments = this.versions.size;
    const totalVersions = Array.from(this.versions.values()).reduce((sum, versions) => sum + versions.length, 0);
    
    return {
      total_versioned_documents: versionedDocuments,
      total_versions: totalVersions,
      avg_versions_per_document: versionedDocuments > 0 ? totalVersions / versionedDocuments : 0
    };
  }
} 