import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth.service';

export interface CustomerDocument {
  id: string;
  customerId: string;
  heading: string;
  description?: string;
  fileUrl?: string; // Keep for backward compatibility
  fileName?: string;
  filePath?: string; // Keep for backward compatibility
  fileData?: string; // Base64 file data
  fileSize?: number;
  fileType?: string;
  isPrivate: boolean;
  addedBy?: string;
  checkedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private documentsCollection: AngularFirestoreCollection<CustomerDocument>;

  constructor(
    private afs: AngularFirestore,
    private authService: AuthService
  ) {
    this.documentsCollection = this.afs.collection<CustomerDocument>('documents');
  }

  // Get all documents for a specific customer
  getDocumentsByCustomerId(customerId: string): Observable<CustomerDocument[]> {
    return this.afs.collection<CustomerDocument>('documents', ref => 
      ref.where('customerId', '==', customerId).orderBy('createdAt', 'desc')
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as CustomerDocument;
        const documentId = a.payload.doc.id;
        return { 
          ...data,
          id: documentId
        };
      }))
    );
  }

  // Convert file to base64
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  }

  // Add a new document (with base64 file storage)
  async addDocument(
    customerId: string, 
    data: { heading: string; description: string; isPrivate: boolean }, 
    file?: File
  ): Promise<void> {
    try {
      const docId = this.afs.createId();
      const currentUser = this.authService.currentUserValue;
      const docData: Partial<CustomerDocument> = {
        customerId: customerId,
        heading: data.heading,
        description: data.description,
        isPrivate: data.isPrivate,
        createdAt: new Date(),
        updatedAt: new Date(),
        addedBy: currentUser ? currentUser.displayName || currentUser.email : 'Unknown'
      };

      if (file) {
        console.log('Converting file to base64:', file.name);
        
        // Convert file to base64
        const base64Data = await this.fileToBase64(file);
        
        // Store file data
        docData.fileData = base64Data;
        docData.fileName = file.name;
        docData.fileSize = file.size;
        docData.fileType = file.type;
        
        console.log('File converted to base64 successfully');
      }

      // Save document to Firestore
      await this.documentsCollection.doc(docId).set(docData as CustomerDocument);
      console.log('Document saved successfully');
      
    } catch (error) {
      console.error('Error in addDocument:', error);
      throw error;
    }
  }

  // Download file from base64 data
  downloadFile(doc: CustomerDocument): void {
    if (!doc.fileData || !doc.fileName) {
      console.error('No file data available for download');
      alert('No file available for download');
      return;
    }

    try {
      // Convert base64 to blob
      const base64Data = doc.fileData.split(',')[1]; // Remove data:type;base64, prefix
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: doc.fileType || 'application/octet-stream' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('File download initiated:', doc.fileName);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file. Please try again.');
    }
  }

  // Update an existing document
  updateDocument(documentId: string, updates: Partial<CustomerDocument>): Promise<void> {
    return this.documentsCollection.doc(documentId).update({
      ...updates,
      updatedAt: new Date()
    });
  }

  // Delete a document (base64 data will be deleted with the document)
  async deleteDocument(doc: CustomerDocument): Promise<void> {
    const docRef = this.documentsCollection.doc(doc.id);
    
    try {
      // Delete the document from Firestore (base64 data included)
      await docRef.delete();
      console.log('Document deleted from Firestore');
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Helper method to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper method to get file icon based on file type
  getFileIcon(fileType: string): string {
    if (!fileType) return 'fa-file';
    
    if (fileType.includes('pdf')) return 'fa-file-pdf';
    if (fileType.includes('image')) return 'fa-file-image';
    if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fa-file-excel';
    if (fileType.includes('text')) return 'fa-file-alt';
    
    return 'fa-file';
  }
}