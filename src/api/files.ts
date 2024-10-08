import axios, { AxiosResponse } from 'axios'
import { api } from 'src/boot/axios.ts'
import { UploadedFileEntity } from 'src/types'

interface FileUploadResponse {
  file: UploadedFileEntity
  uploadSignedUrl: string
}

export async function apiFilesGetPreSigned (fileUpload: {
  fileName: string;
  fileSize: number;
}): Promise<AxiosResponse<FileUploadResponse>> {
  return api.post('/api/v1/files/upload', fileUpload).then()
}

export function apiFilesUpload (formData: FormData): Promise<AxiosResponse> {
  return api.post('/api/v1/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// Function to handle the entire file upload process
export async function apiUploadFileToS3 (file: File): Promise<UploadedFileEntity> {
  try {
    const response = await apiFilesGetPreSigned({
      fileName: file.name,
      fileSize: file.size
    })

    const { file: uploadedFile, uploadSignedUrl } = response.data
    await axios.put(uploadSignedUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    })

    return uploadedFile
  } catch (error) {
    console.error('Error during file upload:', error)
    throw error
  }
}

// Helper function to convert base64 string to Blob
function base64ToBlob (base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64.split(',')[1])
  const byteNumbers = new Array(byteCharacters.length)

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }

  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

// Function to handle the entire file upload process for base64
export async function apiUploadBase64ToS3 (base64Image: string, fileName: string, mimeType: string): Promise<UploadedFileEntity> {
  try {
    // Convert base64 to Blob
    const fileBlob = base64ToBlob(base64Image, mimeType)

    // Get pre-signed URL
    const response = await apiFilesGetPreSigned({
      fileName,
      fileSize: fileBlob.size
    })

    const { file: uploadedFile, uploadSignedUrl } = response.data

    // Upload file to S3 using pre-signed URL
    await axios.put(uploadSignedUrl, fileBlob, {
      headers: {
        'Content-Type': mimeType
      }
    })

    return uploadedFile
  } catch (error) {
    console.error('Error during file upload:', error)
    throw error
  }
}
